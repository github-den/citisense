import { useState, useEffect } from 'react';
import { supabase } from '@core/lib/supabase.js';
import { useAuth } from '@core/context/AuthContext.jsx';

export function useProfile(userId, options = {}) {
  const { session } = useAuth();
  const { username: targetUsername } = options;
  
  const uid = userId ?? (!targetUsername ? session?.user?.id : null);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase || (!uid && !targetUsername)) { 
      setLoading(false); 
      return; 
    }

    if (uid && String(uid).startsWith('demo-')) {
      const demoFollows = JSON.parse(localStorage.getItem('citisense_demo_follows') || '[]');
      const demoRaises = JSON.parse(localStorage.getItem('citisense_demo_raises') || '{}');
      
      setProfile({
        id: uid,
        username: session?.user?.user_metadata?.username || (String(uid).includes('admin') ? 'demo_admin' : 'demo_citizen'),
        avatar: session?.user?.user_metadata?.avatar || '/avatars/avatar_1.png',
        role: session?.user?.user_metadata?.role || (String(uid).includes('admin') ? 'admin' : 'citizen'),
        barangay: session?.user?.user_metadata?.barangay || 'Poblacion',
        setup_complete: true,
        following_count: demoFollows.length,
        followers_count: 0, // Mocked for demo
        raises_count: Object.keys(demoRaises).length,
      });
      setLoading(false);
      return;
    }

    let query = supabase
      .from('profiles')
      .select('id, username, avatar, location, created_at, raises_count, following_count, followers_count, resolved_count');

    if (uid) {
      query = query.eq('id', uid);
    } else if (targetUsername) {
      query = query.ilike('username', targetUsername);
    }

    query.single().then((profileRes) => {
      if (profileRes.error) {
        setError(profileRes.error);
      } else {
        setProfile({
          ...profileRes.data,
          barangay: profileRes.data.location,
          raisesCount: profileRes.data.raises_count || 0,
          resolvedCount: profileRes.data.resolved_count || 0
        });
      }
      setLoading(false);
    });

  }, [uid, targetUsername, session]);

  return { profile, loading, error };
}
