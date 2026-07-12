import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

const MatchInviteContext = createContext(null);

export function MatchInviteProvider({ children }) {
  const { id: selfId } = useUser();
  const [received, setReceived] = useState([]); // pending invites addressed to me, with session + sender info

  const load = useCallback(async () => {
    if (!selfId) { setReceived([]); return; }
    const { data } = await supabase
      .from('match_invites')
      .select('id, session_id, sender_id, status, sessions(motion, tournament, date), profiles!match_invites_sender_id_fkey(name, username, avatar_url)')
      .eq('receiver_id', selfId)
      .eq('status', 'pending');
    setReceived(data || []);
  }, [selfId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selfId) return;
    const channel = supabase
      .channel(`match_invites_${selfId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'match_invites', filter: `receiver_id=eq.${selfId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selfId, load]);

  const acceptInvite = async (invite) => {
    const { error } = await supabase.rpc('accept_match_invite', { p_invite_id: invite.id });
    if (error) { console.error('接受比赛记录邀请失败:', error.message); return; }
    setReceived(prev => prev.filter(i => i.id !== invite.id));
  };

  const declineInvite = async (invite) => {
    await supabase.from('match_invites').update({ status: 'declined' }).eq('id', invite.id);
    setReceived(prev => prev.filter(i => i.id !== invite.id));
  };

  return (
    <MatchInviteContext.Provider value={{ received, acceptInvite, declineInvite }}>
      {children}
    </MatchInviteContext.Provider>
  );
}

export const useMatchInvite = () => useContext(MatchInviteContext);
