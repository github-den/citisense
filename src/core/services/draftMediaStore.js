const DB_NAME = 'citisense-draft-media';
const STORE_NAME = 'draft_media';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDraftMediaDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('draftId', 'draftId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open draft media database.'));
  });
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Draft media request failed.'));
  });
}

function inferFileExtension(type = 'image') {
  return type === 'video' ? 'mp4' : 'jpg';
}

function blobToFile(blob, name, mimeType) {
  if (blob instanceof File) return blob;
  return new File([blob], name, { type: mimeType || blob.type || '' });
}

export async function saveDraftMediaItems(draftId, items = []) {
  if (!draftId) return [];

  const mediaItems = Array.isArray(items) ? items : [];
  const remoteMetadata = mediaItems
    .filter((item) => !(item?.file instanceof Blob))
    .map((item) => ({
      id: String(item?.id ?? ''),
      label: String(item?.label ?? ''),
      type: item?.type === 'video' ? 'video' : 'image',
      isLocal: false,
      src: String(item?.src ?? ''),
    }))
    .filter((item) => item.id && item.src);

  const localItems = mediaItems.filter((item) => item?.file instanceof Blob);
  if (!canUseIndexedDb() || localItems.length === 0) return remoteMetadata;

  const db = await openDraftMediaDb();
  if (!db) return remoteMetadata;

  await deleteDraftMediaItems(draftId);

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const localMetadata = [];

  localItems.forEach((item) => {
    const itemId = String(item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    const type = item.type === 'video' ? 'video' : 'image';
    const file = item.file;
    const label = String(item.label ?? file?.name ?? '');
    const record = {
      key: `${draftId}:${itemId}`,
      draftId,
      itemId,
      label,
      type,
      blob: file,
      name: file?.name ?? `${itemId}.${inferFileExtension(type)}`,
      mimeType: file?.type ?? '',
    };

    store.put(record);
    localMetadata.push({
      id: itemId,
      label,
      type,
      isLocal: true,
    });
  });

  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save draft media.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to save draft media.'));
  });

  db.close();
  return [...localMetadata, ...remoteMetadata];
}

export async function loadDraftMediaItems(draft = null) {
  const metadata = Array.isArray(draft?.mediaItems) ? draft.mediaItems : [];
  if (metadata.length === 0) return [];

  const db = await openDraftMediaDb();
  const loadedItems = await Promise.all(metadata.map(async (item, index) => {
    const itemId = String(item?.id ?? `${index}`);
    const type = item?.type === 'video' ? 'video' : 'image';
    const label = String(item?.label ?? '');

    if (!item?.isLocal) {
      const src = String(item?.src ?? '');
      if (!src) return null;
      return {
        id: itemId,
        src,
        type,
        isLocal: false,
        label,
      };
    }

    if (!db || !draft?.id) return null;
    const record = await readRequest(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(`${draft.id}:${itemId}`),
    );
    if (!record?.blob) return null;

    const file = blobToFile(
      record.blob,
      record.name ?? `${itemId}.${inferFileExtension(type)}`,
      record.mimeType,
    );

    return {
      id: itemId,
      src: URL.createObjectURL(file),
      type,
      file,
      isLocal: true,
      label: label || file.name,
    };
  }));

  db?.close();
  return loadedItems.filter(Boolean);
}

export async function deleteDraftMediaItems(draftId) {
  if (!draftId || !canUseIndexedDb()) return;

  const db = await openDraftMediaDb();
  if (!db) return;

  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const index = store.index('draftId');
  const range = IDBKeyRange.only(draftId);
  const keys = await readRequest(index.getAllKeys(range));
  await Promise.all((keys ?? []).map((key) => readRequest(store.delete(key))));

  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to delete draft media.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to delete draft media.'));
  });

  db.close();
}
