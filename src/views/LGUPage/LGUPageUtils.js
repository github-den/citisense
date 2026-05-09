import { URDANETA_BARANGAYS } from '../../constants/index.js';
import { normalizeIncidentLocationLabel } from '../../core/utils/location.js';
import { formatMoodLabel, getMoodEmoji as getSharedMoodEmoji, summarizeMoodFromPosts } from '../../core/utils/mood.js';

export const URDANETA_CENTER = { latitude: 15.9763, longitude: 120.565, zoom: 12.65 };
export const URDANETA_MAX_BOUNDS = [
  [15.930, 120.490], // Southern/Western allowance
  [16.015, 120.630], // Northern/Eastern allowance
];

export const URDANETA_BARANGAY_COORDINATES = [
  { name: 'Anonas', lat: 15.9867, lng: 120.5846 },
  { name: 'Bactad East', lat: 15.9790, lng: 120.6219 },
  { name: 'Bayaoas', lat: 15.9761, lng: 120.5772 },
  { name: 'Bolaoen', lat: 15.9926, lng: 120.6060 },
  { name: 'Cabaruan', lat: 15.9453, lng: 120.5236 },
  { name: 'Cabuloan', lat: 15.9764, lng: 120.6014 },
  { name: 'Camanang', lat: 15.9612, lng: 120.5938 },
  { name: 'Camantiles', lat: 15.9615, lng: 120.5673 },
  { name: 'Casantaan', lat: 15.9838, lng: 120.6043 },
  { name: 'Catablan', lat: 15.9686, lng: 120.4979 },
  { name: 'Cayambanan', lat: 15.9602, lng: 120.5768 },
  { name: 'Consolacion', lat: 15.9532, lng: 120.5985 },
  { name: 'Dilan-Paurido', lat: 15.9388, lng: 120.5143 },
  { name: 'Labit Proper', lat: 15.9567, lng: 120.5301 },
  { name: 'Labit West', lat: 15.9571, lng: 120.5151 },
  { name: 'Mabanogbog', lat: 15.9768, lng: 120.5546 },
  { name: 'Macalong', lat: 15.9546, lng: 120.5501 },
  { name: 'Nancalobasaan', lat: 15.9926, lng: 120.5909 },
  { name: 'Nancamaliran East', lat: 15.9762, lng: 120.5592 },
  { name: 'Nancamaliran West', lat: 15.9770, lng: 120.5418 },
  { name: 'Nancayasan', lat: 15.9669, lng: 120.5658 },
  { name: 'Oltama', lat: 15.9778, lng: 120.5847 },
  { name: 'Palina East', lat: 15.9458, lng: 120.5530 },
  { name: 'Palina West', lat: 15.9464, lng: 120.5429 },
  { name: 'Pedro T. Orata', lat: 15.9769, lng: 120.6082 },
  { name: 'Pinmaludpod', lat: 15.9810, lng: 120.5324 },
  { name: 'Poblacion', lat: 15.9757, lng: 120.5660 },
  { name: 'San Jose', lat: 15.9657, lng: 120.5845 },
  { name: 'San Vicente', lat: 15.9792, lng: 120.5710 },
  { name: 'Santa Lucia', lat: 15.9961, lng: 120.5746 },
  { name: 'Santo Domingo', lat: 15.9602, lng: 120.5516 },
  { name: 'Sugcong', lat: 15.9371, lng: 120.5297 },
  { name: 'Tipuso', lat: 15.9676, lng: 120.6104 },
  { name: 'Tulong', lat: 16.0102, lng: 120.5719 },
];

const BARANGAY_COORDINATE_MAP = new Map(
  URDANETA_BARANGAY_COORDINATES.map((barangay) => [barangay.name.toLowerCase(), barangay]),
);

export const VERIFIED_STATUSES = ['In Progress', 'On hold', 'Resolved'];
export const NOT_ACCEPTED_STATUSES = ['Dismissed', 'Closed', 'Invalid'];

export const TYPE_COLORS = {
  complaint: '#dc2626',
  suggestion: '#d97706',
  compliment: '#16a34a',
};

export function normalizeLocation(post) {
  const barangay = normalizeIncidentLocationLabel(post?.raw?.barangay);
  if (URDANETA_BARANGAYS.includes(barangay)) return barangay;

  const location = normalizeIncidentLocationLabel(post?.location);
  if (!location) return null;

  const match = URDANETA_BARANGAYS.find((name) => location.toLowerCase().includes(name.toLowerCase()));
  return match ?? null;
}

export function getBarangayAnchor(location) {
  const coordinate = BARANGAY_COORDINATE_MAP.get(String(location ?? '').toLowerCase());
  if (coordinate) {
    return {
      latitude: coordinate.lat,
      longitude: coordinate.lng,
    };
  }

  const index = Math.max(URDANETA_BARANGAYS.indexOf(location), 0);
  const ring = Math.floor(index / 9) + 1;
  const steps = ring === 1 ? 9 : ring === 2 ? 12 : 13;
  const ringIndex = index - (ring === 1 ? 0 : ring === 2 ? 9 : 21);
  const angle = ((ringIndex % steps) / steps) * Math.PI * 2 - (Math.PI / 2) + (ring * 0.14);
  const latRadius = 0.0065 + (ring * 0.0032);
  const lngRadius = 0.0088 + (ring * 0.0037);

  return {
    latitude: Number((URDANETA_CENTER.latitude + Math.sin(angle) * latRadius).toFixed(6)),
    longitude: Number((URDANETA_CENTER.longitude + Math.cos(angle) * lngRadius).toFixed(6)),
  };
}

export function getMarkerTone(signal) {
  if (signal.complaint >= signal.suggestion && signal.complaint >= signal.compliment) return 'complaint';
  if (signal.suggestion >= signal.compliment) return 'suggestion';
  return 'compliment';
}

export function buildMapSignals(posts) {
  const byLocation = new Map();

  posts.forEach((post) => {
    const location = normalizeLocation(post);
    if (!location) return;
    const current = byLocation.get(location) ?? {
      location,
      total: 0,
      complaint: 0,
      suggestion: 0,
      compliment: 0,
      underReview: 0,
      inProgress: 0,
      onHold: 0,
      resolved: 0,
      dismissed: 0,
      closed: 0,
      invalid: 0,
    };

    current.total += 1;
    current[post.type] += 1;

    if (post.status === 'Under Review') current.underReview += 1;
    if (post.status === 'In Progress') current.inProgress += 1;
    if (post.status === 'On hold') current.onHold += 1;
    if (post.status === 'Resolved') current.resolved += 1;
    if (post.status === 'Dismissed') current.dismissed += 1;
    if (post.status === 'Closed') current.closed += 1;
    if (post.status === 'Invalid') current.invalid += 1;

    byLocation.set(location, current);
  });

  return [...byLocation.values()]
    .sort((a, b) => b.total - a.total)
    .map((signal) => ({
      ...signal,
      coordinates: getBarangayAnchor(signal.location),
      markerColor: TYPE_COLORS[getMarkerTone(signal)],
    }));
}

export const TIME_FILTER_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '15', label: 'Last 15 days' },
  { value: '30', label: 'Last 30 days' },
];

export function filterPosts(posts, service, location, timeRange = 'all') {
  return posts.filter((post) => {
    if (service !== 'all' && post.service !== service) return false;
    if (location !== 'all' && normalizeLocation(post) !== location) return false;
    
    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      const postDate = new Date(post.created_at).getTime();
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      if (postDate < cutoff) return false;
    }

    return true;
  });
}

export function deriveFilteredMood(posts, cityMood) {
  const summary = summarizeMoodFromPosts(posts);
  if (summary.mood) {
    return {
      label: formatMoodLabel(summary.mood),
      value: Math.round(summary.confidence * 100),
    };
  }

  if (posts.length === 0) {
    return {
      label: cityMood?.mood ? formatMoodLabel(cityMood.mood) : 'No mood data yet',
      value: 0,
    };
  }

  return {
    label: 'No mood data yet',
    value: 0,
  };
}

export function getMoodEmoji(label) {
  return getSharedMoodEmoji(String(label ?? '').toLowerCase());
}

export function estimateAverageResponseHours(posts) {
  if (posts.length === 0) return 0;

  const totalDays = posts.reduce((sum, post) => {
    const ageMs = Math.max(1, Date.now() - new Date(post.created_at ?? Date.now()).getTime());
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (post.status === 'Resolved') return sum + Math.max(0.16, ageDays * 0.42);
    if (post.status === 'In Progress') return sum + Math.max(0.2, ageDays * 0.58);
    if (post.status === 'On hold') return sum + Math.max(0.32, ageDays * 0.74);
    if (post.status === 'Dismissed' || post.status === 'Invalid') return sum + Math.max(0.18, ageDays * 0.35);
    return sum + Math.max(0.14, ageDays * 0.48);
  }, 0);

  return Math.max(1, Math.round((totalDays / posts.length) * 24));
}

export function formatHourMetric(hours) {
  if (hours < 24) return `${hours} hr`;
  const days = Math.max(1, Math.round(hours / 24));
  return `${days} day${days > 1 ? 's' : ''}`;
}
