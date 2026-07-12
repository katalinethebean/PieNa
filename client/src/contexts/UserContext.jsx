import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { user: authUser, loading: authLoading } = useAuth();

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [id, setId] = useState('');
  const [username, setUsername] = useState('');
  const [region, setRegion] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [team, setTeam] = useState('');
  const [honors, setHonors] = useState(['', '', '', '', '']);
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [credits, setCredits] = useState(3);
  const [wechat, setWechat] = useState('');

  useEffect(() => {
    if (!isConfigured || authLoading) return;

    if (!authUser) {
      setId('');
      setUsername('');
      setRegion('');
      setName('');
      setBio('');
      setTeam('');
      setHonors(['', '', '', '', '']);
      setIsPublic(false);
      setAvatarUrl(null);
      setSessions([]);
      setCredits(3);
      setWechat('');
      setProfileLoaded(false);
      return;
    }

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !data) {
        setProfileLoaded(true);
        return;
      }

      setId(data.id);
      setUsername(data.username ?? '');
      setRegion(data.region ?? '');
      setName(data.name ?? '');
      setBio(data.bio ?? '');
      setTeam(data.team ?? '');
      setHonors(data.honors?.length ? data.honors : ['', '', '', '', '']);
      setIsPublic(data.is_public ?? false);
      setAvatarUrl(data.avatar_url ?? null);
      setCredits(data.credits ?? 3);
      setWechat(data.user_wechat ?? '');
      setProfileLoaded(true);
    }

    async function loadSessions() {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', authUser.id)
        .order('date', { ascending: false });
      setSessions(data || []);
    }

    loadProfile();
    loadSessions();
  }, [authUser, authLoading]);

  const byDateDesc = (a, b) => (b.date || '') < (a.date || '') ? -1 : (b.date || '') > (a.date || '') ? 1 : 0;
  const addSession = (session) => setSessions(prev => [session, ...prev].sort(byDateDesc));
  const removeSession = (sessionId) => setSessions(prev => prev.filter(s => s.id !== sessionId));
  const updateSession = (sessionId, patch) => setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...patch } : s).sort(byDateDesc));
  const spendCredit = () => setCredits(prev => Math.max(prev - 1, 0));

  const analyzedSessions = sessions.filter(s => Number.isFinite(s.avg_score));
  const avgScore = analyzedSessions.length
    ? analyzedSessions.reduce((sum, s) => sum + s.avg_score, 0) / analyzedSessions.length
    : 0;

  return (
    <UserContext.Provider value={{
      id,
      username,
      region,
      profileLoaded: !isConfigured || profileLoaded,
      avg_score: Number.isFinite(avgScore) ? Math.round(avgScore * 10) / 10 : 0,
      credits,
      spendCredit,
      name, setName,
      bio, setBio,
      team, setTeam,
      honors, setHonors,
      isPublic, setIsPublic,
      avatarUrl, setAvatarUrl,
      wechat, setWechat,
      sessions, addSession, removeSession, updateSession,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
