import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContext';
import { useFriend } from './FriendContext';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { id: selfId } = useUser();
  const { friends } = useFriend();
  const [conversations, setConversations] = useState([]);
  const [blockedIds, setBlockedIds] = useState(new Set());
  const [convoSettings, setConvoSettings] = useState({});

  const load = useCallback(async () => {
    if (!selfId) { setConversations([]); return; }
    const { data } = await supabase
      .from('messages')
      .select('sender_id, receiver_id, content, created_at, read_at')
      .or(`sender_id.eq.${selfId},receiver_id.eq.${selfId}`)
      .order('created_at', { ascending: true });

    const rows = data || [];
    const byOther = {};
    rows.forEach(m => {
      const otherId = m.sender_id === selfId ? m.receiver_id : m.sender_id;
      const bucket = byOther[otherId] || { otherId, unreadCount: 0 };
      bucket.lastMessage = m.content;
      bucket.lastMessageTime = m.created_at;
      if (m.receiver_id === selfId && !m.read_at) bucket.unreadCount += 1;
      byOther[otherId] = bucket;
    });

    const otherIds = Object.keys(byOther);
    const profiles = {};
    if (otherIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, name, username, avatar_url')
        .in('id', otherIds);
      (profileRows || []).forEach(p => { profiles[p.id] = p; });
    }

    const list = otherIds
      .map(otherId => ({ ...byOther[otherId], otherProfile: profiles[otherId] || null }))
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    setConversations(list);
  }, [selfId]);

  const loadBlocks = useCallback(async () => {
    if (!selfId) return;
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', selfId);
    setBlockedIds(new Set((data || []).map(r => r.blocked_id)));
  }, [selfId]);

  const loadSettings = useCallback(async () => {
    if (!selfId) return;
    const { data } = await supabase.from('conversation_settings').select('*').eq('user_id', selfId);
    const map = {};
    (data || []).forEach(r => { map[r.other_user_id] = r; });
    setConvoSettings(map);
  }, [selfId]);

  useEffect(() => { load(); loadBlocks(); loadSettings(); }, [load, loadBlocks, loadSettings]);

  useEffect(() => {
    if (!selfId) return;
    // No column filter — RLS (sender_id=auth.uid() OR receiver_id=auth.uid()) ensures
    // only this user's messages fire the event. Column filters on postgres_changes
    // require REPLICA IDENTITY FULL and are unreliable without it.
    const channel = supabase
      .channel(`messages_${selfId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selfId, load]);

  const blockUser = async (otherId) => {
    await supabase.from('blocks').insert({ blocker_id: selfId, blocked_id: otherId });
    setBlockedIds(prev => new Set([...prev, otherId]));
  };

  const unblockUser = async (otherId) => {
    await supabase.from('blocks').delete().eq('blocker_id', selfId).eq('blocked_id', otherId);
    setBlockedIds(prev => { const s = new Set(prev); s.delete(otherId); return s; });
  };

  const clearChat = async (otherId) => {
    const now = new Date().toISOString();
    await supabase.from('conversation_settings')
      .upsert({ user_id: selfId, other_user_id: otherId, cleared_at: now }, { onConflict: 'user_id,other_user_id' });
    setConvoSettings(prev => ({ ...prev, [otherId]: { ...(prev[otherId] || {}), cleared_at: now } }));
  };

  const deleteChat = async (otherId) => {
    const now = new Date().toISOString();
    await supabase.from('conversation_settings')
      .upsert({ user_id: selfId, other_user_id: otherId, cleared_at: now, hidden_after: now }, { onConflict: 'user_id,other_user_id' });
    setConvoSettings(prev => ({ ...prev, [otherId]: { ...(prev[otherId] || {}), cleared_at: now, hidden_after: now } }));
  };

  const saveNote = async (otherId, note) => {
    await supabase.from('conversation_settings')
      .upsert({ user_id: selfId, other_user_id: otherId, note: note || null }, { onConflict: 'user_id,other_user_id' });
    setConvoSettings(prev => ({ ...prev, [otherId]: { ...(prev[otherId] || {}), note: note || null } }));
  };

  const conversationsWithMeta = conversations
    .map(c => ({ ...c, isFriend: friends.includes(c.otherId) }))
    .filter(c => {
      const s = convoSettings[c.otherId];
      if (s?.hidden_after && (!c.lastMessageTime || c.lastMessageTime <= s.hidden_after)) return false;
      return true;
    });

  const totalUnread = conversationsWithMeta.reduce((sum, c) => sum + c.unreadCount, 0);

  const sendMessage = async (otherId, content) => {
    const trimmed = content.trim();
    if (!trimmed) return { error: 'empty' };
    const { data, error } = await supabase.from('messages').insert({
      sender_id: selfId,
      receiver_id: otherId,
      content: trimmed,
    }).select().single();
    if (!error) load();
    return { data, error };
  };

  const markRead = async (otherId) => {
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherId)
      .eq('receiver_id', selfId)
      .is('read_at', null);
    setConversations(prev => prev.map(c => c.otherId === otherId ? { ...c, unreadCount: 0 } : c));
  };

  return (
    <ChatContext.Provider value={{
      conversations: conversationsWithMeta,
      totalUnread,
      sendMessage,
      markRead,
      reload: load,
      blockedIds,
      convoSettings,
      blockUser,
      unblockUser,
      clearChat,
      deleteChat,
      saveNote,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
