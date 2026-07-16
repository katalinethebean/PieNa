import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useChat } from '../contexts/ChatContext';
import { useFriend } from '../contexts/FriendContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { useIsMobile, MOBILE_FULL_HEIGHT } from '../lib/useIsMobile';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Avatar({ profile, size = 38 }) {
  const name = profile?.name || '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#2C3025', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#E8E4DC', fontSize: size * 0.37, fontWeight: 700, overflow: 'hidden',
    }}>
      {profile?.avatar_url
        ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        : name.slice(0, 1)}
    </div>
  );
}

function SendingSpinner() {
  return (
    <motion.svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="5" cy="5" r="3.5" stroke="#c8b89a" strokeWidth="1.5" strokeDasharray="5 5" />
    </motion.svg>
  );
}

const menuPanelStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: '200px',
  background: 'rgba(255,253,248,0.98)', border: '1px solid rgba(200,184,154,0.4)',
  borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden',
};

function MenuBtn({ onClick, danger, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none',
      textAlign: 'left', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
      color: danger ? '#a03030' : '#2C3025',
    }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: 'rgba(200,184,154,0.3)' }} />;
}

function MoreMenu({ otherId, onDelete }) {
  const { blockedIds, convoSettings, blockUser, unblockUser, clearChat, deleteChat, saveNote } = useChat();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('main');
  const [noteDraft, setNoteDraft] = useState('');
  const menuRef = useRef(null);

  const isBlocked = blockedIds.has(otherId);
  const currentNote = convoSettings[otherId]?.note || '';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false); setMode('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const close = () => { setOpen(false); setMode('main'); };

  const subStyle = { padding: '12px 14px' };
  const subLabel = { fontSize: '12px', color: '#9a8570', margin: '0 0 8px', lineHeight: 1.4 };
  const actionRow = { display: 'flex', gap: '6px', marginTop: '8px' };
  const btnPrimary = (danger) => ({
    flex: 1, padding: '7px', border: 'none', borderRadius: '6px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit',
    background: danger ? '#a03030' : '#2C3025',
    color: '#fff',
  });
  const btnGhost = {
    flex: 1, padding: '7px', background: 'transparent', color: '#9a8570',
    border: '1px solid rgba(200,184,154,0.5)', borderRadius: '6px', fontSize: '12px',
    cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); setMode('main'); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '6px 8px',
          color: '#9a8570', fontSize: '20px', letterSpacing: '2px', lineHeight: 1,
          borderRadius: '6px', fontFamily: 'inherit',
        }}
      >
        ···
      </button>

      {open && (
        <div style={menuPanelStyle}>
          {mode === 'main' && (
            <>
              <MenuBtn onClick={() => { setNoteDraft(currentNote); setMode('note'); }}>
                备注{currentNote ? `（${currentNote}）` : ''}
              </MenuBtn>
              <Divider />
              <MenuBtn onClick={() => setMode('confirmClear')}>清空聊天记录</MenuBtn>
              <Divider />
              <MenuBtn onClick={async () => { isBlocked ? await unblockUser(otherId) : await blockUser(otherId); close(); }}>
                {isBlocked ? '取消拉黑' : '拉黑'}
              </MenuBtn>
              <MenuBtn onClick={() => setMode('confirmDelete')} danger>删除对话</MenuBtn>
            </>
          )}

          {mode === 'note' && (
            <div style={subStyle}>
              <p style={subLabel}>备注名（仅自己可见，最多 20 字）</p>
              <input
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                maxLength={20}
                placeholder="给对方起个备注…"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') { saveNote(otherId, noteDraft.trim()); close(); }
                  if (e.key === 'Escape') close();
                }}
                style={{
                  width: '100%', padding: '7px 10px', border: '1px solid rgba(200,184,154,0.5)',
                  borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit',
                  color: '#2C3025', background: 'rgba(255,255,255,0.8)', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={actionRow}>
                <button style={btnPrimary(false)} onClick={() => { saveNote(otherId, noteDraft.trim()); close(); }}>保存</button>
                <button style={btnGhost} onClick={close}>取消</button>
              </div>
            </div>
          )}

          {mode === 'confirmClear' && (
            <div style={subStyle}>
              <p style={subLabel}>清空后记录仅在你这端消失，对方仍可看到。</p>
              <div style={actionRow}>
                <button style={btnPrimary(true)} onClick={async () => { await clearChat(otherId); close(); }}>确认清空</button>
                <button style={btnGhost} onClick={() => setMode('main')}>取消</button>
              </div>
            </div>
          )}

          {mode === 'confirmDelete' && (
            <div style={subStyle}>
              <p style={subLabel}>对话从列表消失，对方再次发消息后重新出现。</p>
              <div style={actionRow}>
                <button style={btnPrimary(true)} onClick={async () => { await deleteChat(otherId); close(); onDelete(); }}>确认删除</button>
                <button style={btnGhost} onClick={() => setMode('main')}>取消</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationRow({ conversation, active, onClick, note }) {
  const { otherProfile, lastMessage, lastMessageTime, unreadCount } = conversation;
  const displayName = note || otherProfile?.name || '…';
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ backgroundColor: 'rgba(200,184,154,0.12)' }}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer',
        background: active ? 'rgba(125,155,150,0.14)' : 'transparent',
        borderLeft: active ? '3px solid #7d9b96' : '3px solid transparent',
      }}
    >
      <Avatar profile={otherProfile} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2C3025', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          <span style={{ fontSize: '10px', color: '#c8b89a', flexShrink: 0 }}>{formatTime(lastMessageTime)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#9a8570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lastMessage}
          </span>
          {unreadCount > 0 && (
            <span style={{
              flexShrink: 0, minWidth: '16px', height: '16px', borderRadius: '8px', background: '#c07a3a',
              color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '0 4px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChatThread({ otherId, showBack }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { id: selfId } = useUser();
  const { sendMessage, markRead, conversations, convoSettings, blockedIds } = useChat();
  const { friends } = useFriend();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otherProfile, setOtherProfile] = useState(null);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const composingRef = useRef(false);
  const bottomRef = useRef(null);

  const isFriend = friends.includes(otherId);
  const isBlocked = blockedIds.has(otherId);
  const clearedAt = convoSettings[otherId]?.cleared_at;
  const currentNote = convoSettings[otherId]?.note || '';

  const visibleMessages = clearedAt
    ? messages.filter(m => m.sending || m.created_at > clearedAt)
    : messages;

  const load = useCallback(async () => {
    if (!selfId || !otherId) return;
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(`and(sender_id.eq.${selfId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${selfId})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  }, [selfId, otherId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setDraft(''); setSendError(''); }, [otherId]);

  useEffect(() => {
    const known = conversations.find(c => c.otherId === otherId);
    if (known?.otherProfile) { setOtherProfile(known.otherProfile); return; }
    supabase.from('profiles').select('id, name, username, avatar_url').eq('id', otherId).single()
      .then(({ data }) => setOtherProfile(data || null));
  }, [otherId, conversations]);

  useEffect(() => { markRead(otherId); }, [otherId, markRead]);

  // Direct realtime subscription for incoming messages in this thread
  useEffect(() => {
    if (!selfId || !otherId) return;
    const channel = supabase
      .channel(`thread_${selfId}_${otherId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${otherId}`,
      }, payload => {
        const msg = payload.new;
        if (msg.receiver_id !== selfId) return;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markRead(otherId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selfId, otherId, markRead]);

  // Piggyback on ChatContext's reliable realtime: whenever the conversation's
  // lastMessageTime changes (ChatContext already detected a new message), re-fetch
  // the thread so both sides stay in sync without relying on column-filtered subscriptions.
  const conversationLastMessageTime = conversations.find(c => c.otherId === otherId)?.lastMessageTime;
  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationLastMessageTime]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || !isFriend) return;

    const tempId = `pending-${Date.now()}`;
    setDraft('');
    setSendError('');
    setMessages(prev => [...prev, {
      id: tempId, sender_id: selfId, receiver_id: otherId,
      content: trimmed, created_at: new Date().toISOString(), sending: true,
    }]);

    const { data, error } = await sendMessage(otherId, trimmed);

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setSendError('发送失败，请重试');
      setDraft(trimmed);
      return;
    }
    setMessages(prev => {
      const without = prev.filter(m => m.id !== tempId);
      if (data && !without.some(m => m.id === data.id)) return [...without, data];
      return without;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px',
        borderBottom: '1px solid rgba(200,184,154,0.3)', flexShrink: 0,
      }}>
        {showBack && (
          <button
            onClick={() => navigate('/chat')}
            aria-label="返回"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', marginLeft: '-4px', color: '#2C3025', display: 'flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <Avatar profile={otherProfile} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link to={`/profile/${otherId}`} style={{ fontSize: '14px', fontWeight: 600, color: '#2C3025', textDecoration: 'none', display: 'block' }}>
            {currentNote || otherProfile?.name || '…'}
          </Link>
          {currentNote && (
            <span style={{ fontSize: '11px', color: '#9a8570' }}>{otherProfile?.name}</span>
          )}
        </div>
        {isBlocked && (
          <span style={{
            fontSize: '11px', color: '#c07a3a', background: 'rgba(192,122,58,0.1)',
            padding: '2px 8px', borderRadius: '10px', flexShrink: 0,
          }}>
            已拉黑
          </span>
        )}
        <MoreMenu otherId={otherId} onDelete={() => navigate('/chat')} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {!loading && visibleMessages.length === 0 && (
          <p style={{ fontSize: '13px', color: '#c8b89a', textAlign: 'center', margin: 'auto 0' }}>{t('chat.empty')}</p>
        )}
        {visibleMessages.map(m => {
          const mine = m.sender_id === selfId;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%', padding: '9px 14px', borderRadius: '16px', fontSize: '13px', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: mine ? '#2C3025' : 'rgba(255,255,255,0.6)',
                color: mine ? '#E8E4DC' : '#2C3025',
                border: mine ? 'none' : '1px solid rgba(200,184,154,0.35)',
                opacity: m.sending ? 0.55 : 1,
                transition: 'opacity 0.2s',
              }}>
                {m.content}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', padding: '0 4px' }}>
                {m.sending
                  ? <SendingSpinner />
                  : <span style={{ fontSize: '10px', color: '#c8b89a' }}>{formatTime(m.created_at)}</span>
                }
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(200,184,154,0.3)', flexShrink: 0 }}>
        {isFriend ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) { e.preventDefault(); handleSend(); } }}
              placeholder={t('chat.placeholder')}
              maxLength={2000}
              style={{
                flex: 1, padding: '10px 14px', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '20px',
                fontSize: '13px', color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.6)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleSend} disabled={!draft.trim()}
              style={{
                padding: '10px 20px', borderRadius: '20px', border: 'none', fontFamily: 'inherit',
                fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em',
                background: draft.trim() ? '#2C3025' : 'rgba(200,184,154,0.4)',
                color: draft.trim() ? '#E8E4DC' : '#9a8570',
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}>
              {t('chat.send')}
            </motion.button>
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: '#c8b89a', textAlign: 'center', margin: 0 }}>你们已不是好友，无法发送新消息</p>
        )}
        {sendError && <p style={{ fontSize: '11px', color: '#a03030', marginTop: '6px', marginBottom: 0 }}>{sendError}</p>}
      </div>
    </div>
  );
}

export default function Chat() {
  const { id: otherId } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { conversations, convoSettings } = useChat();
  const isMobile = useIsMobile();

  const list = (
    <>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.12em', padding: '16px 16px 10px' }}>{t('chat.title')}</p>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 && (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: '#c8b89a' }}>{t('chat.empty')}</p>
          </div>
        )}
        {conversations.map(c => (
          <ConversationRow
            key={c.otherId}
            conversation={c}
            active={c.otherId === otherId}
            onClick={() => navigate(`/chat/${c.otherId}`)}
            note={convoSettings[c.otherId]?.note}
          />
        ))}
      </div>
    </>
  );

  // 手机端：一次只显示一屏 —— 有 otherId 显示对话（带返回），否则显示会话列表
  if (isMobile) {
    return (
      <div style={{ height: MOBILE_FULL_HEIGHT, display: 'flex', flexDirection: 'column', background: 'rgba(244,240,232,0.5)' }}>
        {otherId
          ? <ChatThread key={otherId} otherId={otherId} showBack />
          : list}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px', height: 'calc(100dvh - 60px - 48px)' }}>
      <div className="glass-card" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Conversation list */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(200,184,154,0.3)' }}>
          {list}
        </div>

        {/* Thread */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {otherId ? (
            <ChatThread key={otherId} otherId={otherId} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: '13px', color: '#c8b89a' }}>{t('chat.select')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
