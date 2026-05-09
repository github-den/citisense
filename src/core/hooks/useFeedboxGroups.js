import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { mapPosts } from '@core/utils/postMapper.js';
import { normalizeIncidentLocationLabel } from '@core/utils/location.js';
import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '@/constants/index.js';

function computeStatusBreakdown(rows) {
  return rows.reduce((acc, row) => {
    if (row.status === 'resolved') acc.resolved += 1;
    else if (row.status === 'in_progress' || row.status === 'under_review' || row.status === null) acc.active += 1;
    else acc.others += 1;
    return acc;
  }, { active: 0, resolved: 0, others: 0 });
}

function normalizeLocationGroup(value) {
  const text = normalizeIncidentLocationLabel(value);
  if (!text) return 'Other Locations';

  const lower = text.toLowerCase();
  if (lower.includes('old city hall') || lower.includes('poblacion')) return 'Old City Hall (Poblacion)';
  if (lower.includes('new city hall') || lower.includes('anonas')) return 'New City Hall (Anonas)';

  for (const barangay of URDANETA_BARANGAYS) {
    const label = barangay.toLowerCase();
    if (lower.includes(label)) return barangay;

    const withoutSuffix = label
      .replace(/^old city hall\s*\(poblacion\)$/i, 'poblacion')
      .replace(/^new city hall\s*\(anonas\)$/i, 'anonas');
    if (withoutSuffix && lower.includes(`barangay ${withoutSuffix}`)) return barangay;
  }

  const cleaned = text.replace(/^barangay\s+/i, '').trim();
  const directMatch = URDANETA_BARANGAYS.find((barangay) => barangay.toLowerCase() === cleaned.toLowerCase());
  return directMatch ?? cleaned ?? 'Other Locations';
}

async function fetchProfileMap(userIds) {
  if (!supabase || userIds.length === 0) return new Map();

  const profileResult = await supabase
    .from('profiles')
    .select('id, username, avatar')
    .in('id', userIds);

  if (!profileResult.error) {
    return new Map((profileResult.data ?? []).map((profile) => [profile.id, profile]));
  }

  const usersResult = await supabase
    .from('users')
    .select('id, username, avatar_url')
    .in('id', userIds);

  if (usersResult.error) return new Map();

  return new Map((usersResult.data ?? []).map((user) => [
    user.id,
    {
      username: user.username,
      avatar: user.avatar_url ?? null,
    },
  ]));
}

async function hydrateProfiles(rows) {
  const userIds = [...new Set((rows ?? []).map((row) => row?.user_id).filter(Boolean))];
  const profileMap = await fetchProfileMap(userIds);
  return (rows ?? []).map((row) => ({
    ...row,
    profiles: row.profiles ?? profileMap.get(row.user_id) ?? null,
  }));
}

function buildGroup(kind, label, rows) {
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return {
    id: `${kind}:${label}`,
    kind,
    label,
    feedback_count: rows.length,
    raises_count: rows.reduce((sum, row) => sum + Number(row.raises_count ?? 0), 0),
    reacts_count: rows.reduce((sum, row) => sum + Number(row.reacts_count ?? 0), 0),
    discuss_count: rows.reduce((sum, row) => sum + Number(row.discuss_count ?? 0), 0),
    created_at: sorted[0]?.created_at ?? null,
    service: kind === 'service' ? label : null,
    location: kind === 'location' ? label : null,
    status_breakdown: computeStatusBreakdown(rows),
    rows: sorted,
  };
}

export function useFeedboxGroups() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const baseQuery = supabase
        .from('feedbacks')
        .select(`
          id, user_id, caption, type, status, service,
          location:incident_location, feedback_no, raises_count, discuss_count,
          reacts_count, created_at, updated_at, image_url, image_urls,
          profiles ( username, avatar )
        `)
        .order('created_at', { ascending: false })
        .limit(5000);

      const { data, error: primaryError } = await baseQuery;
      if (!mounted) return;

      if (!primaryError) {
        const hydrated = await hydrateProfiles(data ?? []);
        if (!mounted) return;
        setRows(hydrated.map((row) => ({
          ...row,
          location_group: normalizeLocationGroup(row.location),
        })));
        setLoading(false);
        return;
      }

      const message = String(primaryError?.message ?? '').toLowerCase();
      const needsFallback = message.includes('relationship') || message.includes('schema cache') || message.includes('could not find');
      if (!needsFallback) {
        setError(primaryError);
        setRows([]);
        setLoading(false);
        return;
      }

      const { data: flat, error: flatError } = await supabase
        .from('feedbacks')
        .select('id, user_id, caption, type, status, service, location:incident_location, feedback_no, raises_count, discuss_count, reacts_count, created_at, updated_at, image_url, image_urls')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!mounted) return;
      if (flatError) {
        setError(flatError);
        setRows([]);
        setLoading(false);
        return;
      }

      const hydrated = await hydrateProfiles(flat ?? []);
      if (!mounted) return;
      setRows(hydrated.map((row) => ({
        ...row,
        location_group: normalizeLocationGroup(row.location),
      })));
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const posts = useMemo(() => mapPosts(rows), [rows]);

  const serviceGroups = useMemo(() => {
    return SERVICE_CATEGORIES
      .map((category) => buildGroup('service', category, rows.filter((row) => row.service === category)))
      .sort((a, b) => {
        const countDelta = b.feedback_count - a.feedback_count;
        return countDelta !== 0 ? countDelta : a.label.localeCompare(b.label);
      });
  }, [rows]);

  const locationGroups = useMemo(() => {
    return URDANETA_BARANGAYS
      .map((barangay) => buildGroup('location', barangay, rows.filter((row) => row.location_group === barangay)))
      .sort((a, b) => {
        const countDelta = b.feedback_count - a.feedback_count;
        return countDelta !== 0 ? countDelta : a.label.localeCompare(b.label);
      });
  }, [rows]);

  const allGroups = useMemo(() => {
    return [...serviceGroups, ...locationGroups]
      .filter((group) => group.feedback_count > 0)
      .sort((a, b) => {
        const scoreA = a.feedback_count + a.raises_count + a.reacts_count + a.discuss_count;
        const scoreB = b.feedback_count + b.raises_count + b.reacts_count + b.discuss_count;
        return scoreB - scoreA;
      });
  }, [locationGroups, serviceGroups]);

  return { rows, posts, serviceGroups, locationGroups, allGroups, loading, error };
}
