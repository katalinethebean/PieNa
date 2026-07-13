import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useFriend } from '../contexts/FriendContext';
import LoginPromptModal from './LoginPromptModal';
import { isConfigured } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useMatchInvite } from '../contexts/MatchInviteContext';
import { useChat } from '../contexts/ChatContext';
import { supabase } from '../lib/supabase';
import { formatChineseDate } from '../lib/utils';
const NAV = [
  {
    to: '/discover', label: '发现', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor"/>
        <path d="M9 22V12h6v10" stroke="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/review', label: '复盘', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
      </svg>
    ),
  },
  // { to: '/network', label: '关系网', hidden: true },
  {
    to: '/chat', label: '聊天', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor"/>
      </svg>
    ),
  },
];

const spring = { type: 'spring', stiffness: 400, damping: 28 };

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { receivedRequests, acceptRequest, declineRequest } = useFriend();
  const { received: matchInvites, acceptInvite, declineInvite } = useMatchInvite();
  const { totalUnread } = useChat();
  const { name, avatarUrl } = useUser();
  const { user: authUser } = useAuth();
  const guest = isConfigured && !authUser;
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);
  const [senderProfiles, setSenderProfiles] = useState({});
  const [likeNotifs, setLikeNotifs] = useState([]);

  const { id: selfId } = useUser();

  useEffect(() => {
    if (!selfId) return;
    const load = () => supabase
      .from('notifications')
      .select('id, type, actor_id, post_id, read, created_at, profiles!actor_id(name, avatar_url), recruit_posts(role, note)')
      .eq('user_id', selfId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLikeNotifs(data || []));
    load();
    const channel = supabase.channel('like-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${selfId}` }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selfId]);

  const markLikesRead = async () => {
    const unread = likeNotifs.filter(n => !n.read);
    if (unread.length === 0) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', selfId).eq('read', false);
    setLikeNotifs(ns => ns.map(n => ({ ...n, read: true })));
  };

  const unreadLikeCount = likeNotifs.filter(n => !n.read).length;

  useEffect(() => {
    if (receivedRequests.length === 0) { setSenderProfiles({}); return; }
    supabase
      .from('profiles')
      .select('id, name, avatar_url, is_public')
      .in('id', receivedRequests)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(p => { map[p.id] = p; });
        setSenderProfiles(map);
      });
  }, [receivedRequests]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <>
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '60px',
      background: 'rgba(44,48,37,0.97)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
    }}>
      {/* Logo */}
      <Link to="/discover" style={{ textDecoration: 'none', marginRight: '40px', flexShrink: 0 }}>
        <span style={{ fontSize: '16px', fontWeight: 700, color: '#E8E4DC', letterSpacing: '0.05em', fontFamily: 'inherit' }}>
          撇捺
        </span>
      </Link>

      {/* Nav tabs */}
      <motion.div layoutRoot style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
        {NAV.map(({ to, label, icon }) => {
          const active = pathname.startsWith(to);
          const showUnreadDot = to === '/chat' && totalUnread > 0;
          // 访客只能停留在「发现」，点其他 tab 弹登录提示
          const locked = guest && to !== '/discover';
          const inner = (
              <motion.div
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                  padding: '6px 24px', borderRadius: '8px', cursor: 'pointer',
                  color: active ? '#E8E4DC' : 'rgba(232,228,220,0.45)',
                  position: 'relative', minWidth: '88px',
                }}
                whileHover={{ color: 'rgba(232,228,220,0.85)' }}
                transition={spring}
              >
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  {icon}
                  {showUnreadDot && (
                    <span style={{
                      position: 'absolute', top: '-2px', right: '-4px',
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: '#c07a3a', border: '1.5px solid #2C3025',
                    }} />
                  )}
                </span>
                <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, letterSpacing: '0.08em' }}>
                  {label}
                </span>
                {active && (
                  <motion.div
                    layoutId="nav-underline"
                    style={{
                      position: 'absolute', bottom: '-1px', left: '20px', right: '20px',
                      height: '2px', backgroundColor: '#a4b9b5', borderRadius: '1px',
                    }}
                    transition={spring}
                  />
                )}
              </motion.div>
          );
          if (locked) {
            return (
              <div key={to} onClick={() => setShowLoginPrompt(true)}>
                {inner}
              </div>
            );
          }
          return (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              {inner}
            </Link>
          );
        })}
      </motion.div>

      {/* Right section: notification bell + profile avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, marginLeft: '40px' }}>
        {guest ? (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            style={{ padding: '8px 20px', background: '#a4b9b5', color: '#2C3025', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
          >
            登录 / 注册
          </motion.button>
        ) : (
        <>
        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <motion.button
            onClick={() => setShowNotif(v => !v)}
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.92 }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: (receivedRequests.length + matchInvites.length + unreadLikeCount) > 0 ? '#c07a3a' : 'rgba(232,228,220,0.45)',
              position: 'relative',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {(receivedRequests.length + matchInvites.length + unreadLikeCount) > 0 && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '14px', height: '14px', background: '#c07a3a',
                borderRadius: '50%', fontSize: '8px', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, lineHeight: 1,
              }}>
                {receivedRequests.length + matchInvites.length + unreadLikeCount}
              </span>
            )}
          </motion.button>

          {/* Notification dropdown */}
          <AnimatePresence>
            {showNotif && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 12px)', right: '-12px',
                  background: 'rgba(30,34,22,0.98)', backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px',
                  padding: '8px 0', width: '300px', zIndex: 200,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                }}
              >
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(232,228,220,0.35)', letterSpacing: '0.12em', padding: '8px 16px 10px' }}>
                  好友请求
                </p>

                {receivedRequests.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(232,228,220,0.3)', textAlign: 'center', padding: '12px 16px 16px' }}>
                    暂无新通知
                  </p>
                ) : (
                  receivedRequests.map(rid => {
                    const person = senderProfiles[rid];
                    const displayName = person ? person.name : '…';
                    return (
                      <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px' }}>
                        <Link to={`/profile/${rid}`} onClick={() => setShowNotif(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, textDecoration: 'none' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: '#2C3025', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', color: '#a4b9b5', fontSize: '13px', fontWeight: 700,
                            overflow: 'hidden',
                          }}>
                            {person?.avatar_url
                              ? <img src={person.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                              : displayName.slice(0, 1)
                            }
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#E8E4DC', marginBottom: '1px' }}>
                              {displayName}
                            </p>
                            <p style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)' }}>
                              请求加您为好友
                            </p>
                          </div>
                        </Link>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => acceptRequest(rid)}
                            style={{
                              padding: '5px 10px', background: 'rgba(90,143,122,0.2)',
                              border: '1px solid rgba(90,143,122,0.35)', borderRadius: '20px',
                              fontSize: '11px', color: '#5a8f7a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                            }}
                          >
                            接受
                          </button>
                          <button
                            onClick={() => declineRequest(rid)}
                            style={{
                              padding: '5px 10px', background: 'none',
                              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
                              fontSize: '11px', color: 'rgba(232,228,220,0.35)', cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                {likeNotifs.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(232,228,220,0.35)', letterSpacing: '0.12em', padding: '12px 16px 10px', borderTop: receivedRequests.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', marginTop: receivedRequests.length > 0 ? '4px' : 0 }}>
                      招募点赞
                    </p>
                    {likeNotifs.slice(0, 5).map(n => {
                      const actor = n.profiles;
                      const preview = n.recruit_posts?.note?.slice(0, 30);
                      return (
                        <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: '#2C3025', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a4b9b5', fontSize: '13px', fontWeight: 700, overflow: 'hidden' }}>
                            {actor?.avatar_url
                              ? <img src={actor.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                              : (actor?.name || '?').slice(0, 1)}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#E8E4DC', marginBottom: '1px' }}>
                              {actor?.name} 赞了你的招募
                            </p>
                            {preview && <p style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}…</p>}
                          </div>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="#c07a3a" style={{ flexShrink: 0 }}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        </div>
                      );
                    })}
                    <div style={{ padding: '8px 16px' }}>
                      <button onClick={markLikesRead} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '11px', color: 'rgba(232,228,220,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        标为已读
                      </button>
                    </div>
                  </>
                )}

                {matchInvites.length > 0 && (
                  <>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(232,228,220,0.35)', letterSpacing: '0.12em', padding: '12px 16px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px' }}>
                      比赛记录邀请
                    </p>
                    {matchInvites.map(inv => {
                      const sender = inv.profiles;
                      const sessionInfo = inv.sessions;
                      return (
                        <div key={inv.id} style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                              background: '#2C3025', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', color: '#a4b9b5', fontSize: '13px', fontWeight: 700,
                              overflow: 'hidden',
                            }}>
                              {sender?.avatar_url
                                ? <img src={sender.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                : (sender?.name || '?').slice(0, 1)
                              }
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: '#E8E4DC', marginBottom: '1px' }}>
                                {sender?.name} 记录了一场比赛
                              </p>
                              <p style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {sessionInfo?.motion}{sessionInfo?.date ? ` · ${formatChineseDate(sessionInfo.date)}` : ''}
                              </p>
                            </div>
                          </div>
                          <p style={{ fontSize: '11px', color: 'rgba(232,228,220,0.5)', margin: '0 0 8px' }}>要把这场比赛也记录到你的档案吗？</p>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => acceptInvite(inv)}
                              style={{
                                padding: '5px 10px', background: 'rgba(90,143,122,0.2)',
                                border: '1px solid rgba(90,143,122,0.35)', borderRadius: '20px',
                                fontSize: '11px', color: '#5a8f7a', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                              }}
                            >
                              加入我的记录
                            </button>
                            <button
                              onClick={() => declineInvite(inv)}
                              style={{
                                padding: '5px 10px', background: 'none',
                                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px',
                                fontSize: '11px', color: 'rgba(232,228,220,0.35)', cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              不需要
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile avatar — direct link to profile */}
        <Link to="/me" style={{ textDecoration: 'none' }}>
          <motion.div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            whileHover={{ opacity: 0.8 }}
            transition={spring}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: pathname === '/me' ? '#a4b9b5' : '#7d9b96',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2C3025', fontSize: '13px', fontWeight: 700,
              border: pathname === '/me' ? '2px solid rgba(164,185,181,0.6)' : '2px solid transparent',
              transition: 'all 0.2s', overflow: 'hidden', flexShrink: 0,
            }}>
              {avatarUrl
                ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : name.slice(0, 1)
              }
            </div>
          </motion.div>
        </Link>
        </>
        )}
      </div>
    </nav>
    {/* backdrop-filter 会把 fixed 定位钉在 nav 内，弹窗必须放在 nav 外 */}
    <AnimatePresence>
      {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
    </AnimatePresence>
    </>
  );
}
