import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { formatTime } from '@core/utils/format.js';
import { notificationItems as demoNotificationItems } from '../../data/notifications.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketFor(isoString) {
  if (!isoString) return 'Earlier';
  const created = new Date(isoString);
  const now = new Date();
  const createdDay = startOfDay(created).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.floor((today - createdDay) / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays <= 6) return 'This Week';
  return 'Earlier';
}

function normalizeType(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'System';
  const lower = raw.toLowerCase();
  if (lower.includes('raise')) return 'Raises';
  if (lower.includes('reply') || lower.includes('discussion') || lower.includes('comment')) return 'Replies';
  if (lower.includes('react') || lower.includes('like') || lower.includes('heart')) return 'React';
  return raw[0].toUpperCase() + raw.slice(1);
}

function normalizeUnread(row) {
  if (typeof row?.unread === 'boolean') return row.unread;
  if (typeof row?.is_unread === 'boolean') return row.is_unread;
  if (typeof row?.is_read === 'boolean') return !row.is_read;
  if (row?.read_at != null) return false;
  if (row?.seen_at != null) return false;
  return true;
}

function normalizePage(row) {
  return row?.page ?? row?.target_page ?? row?.route ?? row?.href ?? null;
}

function normalizeActor(row) {
  const fromJoin = row?.actor_profile?.username ?? row?.profiles?.username ?? row?.profile?.username;
  return row?.actor_name ?? row?.actor ?? fromJoin ?? 'CitiSense';
}

function mapRowToItem(row) {
  const createdAt = row?.created_at ?? row?.createdAt ?? row?.inserted_at ?? row?.timestamp ?? null;
  const type = normalizeType(row?.type ?? row?.notification_type ?? row?.kind);
  const message = row?.message ?? row?.body ?? row?.content ?? row?.title ?? '';
  const actor = normalizeActor(row);
  const unread = normalizeUnread(row);
  const page = normalizePage(row);

  return {
    id: String(row?.id ?? row?.notification_id ?? `${type}-${createdAt ?? Math.random()}`),
    bucket: row?.bucket ?? bucketFor(createdAt),
    type,
    actor,
    message,
    time: row?.time ?? formatTime(createdAt),
    unread,
    page,
    createdAt,
    raw: row,
  };
}

function isSchemaMismatch(error) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

async function fetchNotificationRows(userId, limit = 60) {
  if (!supabase || !userId) return { data: [], error: null };

  // Try common table/view names in order.
  const candidates = [
    { table: 'notifications', userKey: 'user_id' },
    { table: 'user_notifications', userKey: 'user_id' },
    { table: 'notifications', userKey: 'recipient_id' },
    { table: 'user_notifications', userKey: 'recipient_id' },
  ];

  for (const candidate of candidates) {
    const { table, userKey } = candidate;
    const result = await supabase
      .from(table)
      .select('*')
      .eq(userKey, userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!result.error) return result;
    if (!isSchemaMismatch(result.error)) return result;
  }

  return { data: [], error: null };
}

export function useNotifications({ userId, limit = 60 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalUserId = userId ?? (await supabase.auth.getUser()).data?.user?.id ?? null;

      // Demo users: keep the existing mocked experience.
      if (finalUserId?.startsWith('demo-')) {
        setRows(demoNotificationItems.map((item) => ({
          ...item,
          created_at: new Date().toISOString(),
          read_at: item.unread ? null : new Date().toISOString(),
        })));
        setLoading(false);
        return;
      }

      const { data, error: err } = await fetchNotificationRows(finalUserId, limit);
      if (err) throw err;
      setRows(data ?? []);
    } catch (err) {
      setError(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [limit, userId]);

  useEffect(() => {
    let mounted = true;
    refresh().then(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [refresh]);

  const notifications = useMemo(() => (rows ?? []).map(mapRowToItem), [rows]);
  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

  const markRead = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const normalized = list.map(String).filter(Boolean);
    if (!normalized.length) return;

    // Optimistic local update first.
    setRows((prev) => (prev ?? []).map((row) => {
      const id = String(row?.id ?? row?.notification_id ?? '');
      if (!id || !normalized.includes(id)) return row;
      return { ...row, unread: false, is_unread: false, is_read: true, read_at: row?.read_at ?? new Date().toISOString() };
    }));

    if (!supabase) return;
    try {
      const finalUserId = userId ?? (await supabase.auth.getUser()).data?.user?.id ?? null;
      if (!finalUserId || finalUserId.startsWith('demo-')) return;

      await Promise.all([
        supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', normalized),
        supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).in('id', normalized),
      ]);
    } catch {
      // Ignore: local state already updated; server schema may differ.
    }
  }, [userId]);

  return { notifications, unreadCount, loading, error, refresh, markRead };
}

