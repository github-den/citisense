export const routes = {
  root: '/',
  auth: '/auth',
  setup: '/setup',
  feed: '/feed',
  homeForYou: '/feed/for-you',
  homeFollowing: '/feed/following',
  homeBarangay: '/feed/barangay',
  feedbox: '/feedbox',
  yourCity: '/city',
  lgu: '/lgu',
  lguPerformance: '/lgu',
  charter: '/charter',
  citizenCharter: '/charter',
  profile: '/profile',
  profileTimeline: '/profile/timeline',
  profileActivityLog: '/profile/activity-log',
  editProfile: '/profile/edit',
  notifications: '/notifications',
  profileSaved: '/profile/saved',
  profileDrafts: '/profile/drafts',
  profileSettings: '/profile/settings',
  profileSupport: '/profile/support',
  search: '/search',
  track: '/track',
  write: '/write',
};

export function slugifySegment(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function discussRoute(id) {
  return `/post/${id}`;
}

export function yourCityTabRoute(tab) {
  if (tab === 'citizen-charter' || tab === 'charter') return routes.charter;
  return routes.lgu;
}
