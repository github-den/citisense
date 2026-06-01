const DEMO_POSTS_KEY = 'citisense-demo-posts-v1';

const DEFAULT_DEMO_POSTS = [
  {
    id: 'demo-1',
    content: 'The street lights along Main Street have been out for a week now. It\'s becoming a safety concern for pedestrians at night. Please address this issue urgently.',
    service: 'Street Lighting',
    location: 'Main Street',
    barangay: 'Barangay 1',
    type: 'complaint',
    status: 'Under Review',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    user_id: 'demo-user-1',
    profiles: {
      username: 'citizen_jane',
      avatar: '/avatars/avatar_1.png'
    },
    raises_count: 12,
    shares_count: 5
  },
  {
    id: 'demo-2',
    content: 'I suggest adding more trash bins in the public park near the city hall. During weekends, the area gets crowded and trash accumulates quickly.',
    service: 'Waste Management',
    location: 'City Hall Park',
    barangay: 'Barangay 3',
    type: 'suggestion',
    status: 'In Progress',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    user_id: 'demo-user-2',
    profiles: {
      username: 'mark_citizen',
      avatar: '/avatars/avatar_2.png'
    },
    raises_count: 8,
    shares_count: 3
  },
  {
    id: 'demo-3',
    content: 'I want to commend the city maintenance team for the quick response to the pothole repair on Oak Avenue. The road is now smooth and safe for motorists. Great job!',
    service: 'Road Maintenance',
    location: 'Oak Avenue',
    barangay: 'Barangay 2',
    type: 'compliment',
    status: 'Resolved',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    user_id: 'demo-user-3',
    profiles: {
      username: 'grateful_resident',
      avatar: '/avatars/avatar_3.png'
    },
    raises_count: 25,
    shares_count: 12
  }
];

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

export function listDemoPosts() {
  const raw = window.localStorage.getItem(DEMO_POSTS_KEY);
  const parsed = safeParse(raw ?? '[]', []);
  const posts = Array.isArray(parsed) ? parsed : [];
  
  // Initialize with default demo posts if empty
  if (posts.length === 0) {
    window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(DEFAULT_DEMO_POSTS));
    return DEFAULT_DEMO_POSTS;
  }
  
  return posts;
}

export function upsertDemoPost(row) {
  const existing = listDemoPosts().filter((item) => item?.id !== row?.id);
  const next = [row, ...existing].slice(0, 50);
  window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(next));
  return row;
}

export function updateDemoPost(postId, updater) {
  const existing = listDemoPosts();
  const next = existing.map((row) => {
    if (row?.id !== postId) return row;
    return typeof updater === 'function' ? updater(row) : { ...row, ...updater };
  });
  window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(next));
  return next.find((row) => row?.id === postId) ?? null;
}

export function searchDemoPosts(query) {
  const q = (query ?? '').trim().toLowerCase();
  if (!q) return [];
  return listDemoPosts().filter((row) => {
    const hay = `${row?.content ?? ''} ${row?.service ?? ''} ${row?.location ?? ''} ${row?.barangay ?? ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export function deleteDemoPost(postId) {
  const existing = listDemoPosts();
  const next = existing.filter((row) => row?.id !== postId);
  window.localStorage.setItem(DEMO_POSTS_KEY, JSON.stringify(next));
}
