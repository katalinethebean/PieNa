import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';

const FriendContext = createContext(null);

export function FriendProvider({ children }) {
  const { id: selfId } = useUser();
  const [friends, setFriends] = useState([]);       // array of user IDs
  const [sentRequests, setSentRequests] = useState([]);     // array of receiver IDs
  const [receivedRequests, setReceivedRequests] = useState([]); // array of sender IDs

  const load = useCallback(async () => {
    if (!selfId) {
      // 登出后清空上一个账号残留的好友数据
      setFriends([]);
      setSentRequests([]);
      setReceivedRequests([]);
      return;
    }
    const { data } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`sender_id.eq.${selfId},receiver_id.eq.${selfId}`);

    const rows = data || [];
    const f = [], sent = [], recv = [];
    rows.forEach(r => {
      if (r.status === 'accepted') {
        f.push(r.sender_id === selfId ? r.receiver_id : r.sender_id);
      } else if (r.status === 'pending') {
        if (r.sender_id === selfId) sent.push(r.receiver_id);
        else recv.push(r.sender_id);
      }
    });
    setFriends(f);
    setSentRequests(sent);
    setReceivedRequests(recv);
  }, [selfId]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Realtime subscription — reloads whenever a relevant row changes
  useEffect(() => {
    if (!selfId) return;
    const channel = supabase
      .channel(`friend_requests_${selfId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${selfId}`,
      }, () => load())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `sender_id=eq.${selfId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selfId, load]);

  const sendRequest = async (receiverId) => {
    if (friends.includes(receiverId) || sentRequests.includes(receiverId)) return;
    const { error } = await supabase.from('friend_requests').insert({
      sender_id: selfId,
      receiver_id: receiverId,
      status: 'pending',
    });
    if (!error) setSentRequests(p => [...p, receiverId]);
  };

  const cancelRequest = async (receiverId) => {
    await supabase.from('friend_requests').delete()
      .eq('sender_id', selfId).eq('receiver_id', receiverId);
    setSentRequests(p => p.filter(x => x !== receiverId));
  };

  const acceptRequest = async (senderId) => {
    await supabase.from('friend_requests')
      .update({ status: 'accepted' })
      .eq('sender_id', senderId).eq('receiver_id', selfId);
    setReceivedRequests(p => p.filter(x => x !== senderId));
    setFriends(p => [...p, senderId]);
  };

  const declineRequest = async (senderId) => {
    await supabase.from('friend_requests').delete()
      .eq('sender_id', senderId).eq('receiver_id', selfId);
    setReceivedRequests(p => p.filter(x => x !== senderId));
  };

  const unfriend = async (otherId) => {
    await supabase.from('friend_requests').delete()
      .or(`and(sender_id.eq.${selfId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${selfId})`);
    setFriends(p => p.filter(x => x !== otherId));
  };

  return (
    <FriendContext.Provider value={{
      friends, sentRequests, receivedRequests,
      sendRequest, cancelRequest, acceptRequest, declineRequest, unfriend,
    }}>
      {children}
    </FriendContext.Provider>
  );
}

export const useFriend = () => useContext(FriendContext);
