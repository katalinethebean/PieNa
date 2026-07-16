import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useFriend } from '../contexts/FriendContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

// 发现辩手：按姓名/用户名搜索并加好友。桌面「发现更多辩手」和手机顶栏
// 的「发现好友」入口共用同一个弹窗。
export default function DebaterModal({ onClose }) {
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [greetingFor, setGreetingFor] = useState(null);
  const [greetingDraft, setGreetingDraft] = useState('');
  const { id: selfId } = useUser();
  const { friends, sentRequests, receivedRequests, sendRequest, cancelRequest, acceptRequest } = useFriend();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const term = q.trim().toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('id, username, name, school, is_public, avatar_url')
        .or(`username.ilike.%${term}%,and(name.ilike.%${term}%,is_public.eq.true)`)
        .neq('id', selfId)
        .limit(20);
      setResults(data || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [q, selfId]);

  const statusOf = id => {
    if (friends.includes(id)) return 'friend';
    if (sentRequests.includes(id)) return 'sent';
    if (receivedRequests.includes(id)) return 'received';
    return 'none';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(44,48,37,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass-card"
        style={{ width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: 'rgba(248,244,238,0.97)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(200,184,154,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', marginBottom: '2px' }}>{t('debater.title')}</h2>
              <p style={{ fontSize: '11px', color: '#7d6b55' }}>{t('debater.subtitle')}</p>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(200,184,154,0.3)', border: '1px solid rgba(200,184,154,0.4)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', color: '#5a4a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7d6b55" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              autoFocus
              value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('debater.placeholder')}
              style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '8px', fontSize: '13px', color: '#2C3025', background: 'rgba(255,255,255,0.65)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
          {loading && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#9a8570', padding: '24px 0' }}>{t('debater.searching')}</p>
          )}
          {!loading && q && results.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#7d6b55', padding: '32px 0' }}>{t('debater.not_found')}</p>
          )}
          {!loading && !q && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#9a8570', padding: '32px 0', lineHeight: 1.7 }}>{t('debater.prompt')}</p>
          )}
          {results.map(d => {
            const st = statusOf(d.id);
            const isPrivate = !d.is_public;
            const displayName = d.name;
            return (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid rgba(200,184,154,0.15)' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'rgba(44,48,37,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '14px', fontWeight: 700, overflow: 'hidden' }}>
                  {d.avatar_url
                    ? <img src={d.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : displayName.slice(0, 1).toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link to={`/profile/${d.id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: isPrivate ? '#7d6b55' : '#2C3025', marginBottom: '1px' }}>
                      {displayName}
                      {isPrivate && <span style={{ fontSize: '10px', color: '#9a8570', marginLeft: '5px', fontWeight: 400 }}>{t('debater.private_badge')}</span>}
                    </p>
                  </Link>
                  <p style={{ fontSize: '10px', color: '#8a7560' }}>@{d.username}{!isPrivate && d.school ? ` · ${d.school}` : ''}</p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {st === 'friend' && <span style={{ fontSize: '11px', color: '#5a8f7a', background: 'rgba(90,143,122,0.1)', border: '1px solid rgba(90,143,122,0.25)', padding: '4px 10px', borderRadius: '20px' }}>{t('debater.is_friend')}</span>}
                  {st === 'sent' && <button onClick={() => cancelRequest(d.id)} style={{ fontSize: '11px', color: '#7d6b55', background: 'rgba(200,184,154,0.25)', border: '1px solid rgba(200,184,154,0.4)', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('debater.sent')}</button>}
                  {st === 'received' && <button onClick={() => acceptRequest(d.id)} style={{ fontSize: '11px', color: '#c07a3a', background: 'rgba(192,122,58,0.1)', border: '1px solid rgba(192,122,58,0.25)', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('notif.accept')}</button>}
                  {st === 'none' && greetingFor !== d.id && <button onClick={() => { setGreetingFor(d.id); setGreetingDraft(''); }} style={{ fontSize: '11px', color: '#3a6b5c', background: 'rgba(90,143,122,0.1)', border: '1px solid rgba(90,143,122,0.25)', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('discover.add_friend')}</button>}
                  {st === 'none' && greetingFor === d.id && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '160px' }}>
                      <input autoFocus value={greetingDraft} onChange={e => setGreetingDraft(e.target.value.slice(0, 20))}
                        placeholder={t('discover.say_hi')} maxLength={20}
                        onKeyDown={e => { if (e.key === 'Enter') { sendRequest(d.id, greetingDraft); setGreetingFor(null); } if (e.key === 'Escape') setGreetingFor(null); }}
                        style={{ padding: '5px 8px', border: '1px solid rgba(90,143,122,0.4)', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', background: 'rgba(255,255,255,0.7)', color: '#2C3025' }} />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { sendRequest(d.id, greetingDraft); setGreetingFor(null); }} style={{ flex: 1, padding: '4px', fontSize: '10px', fontWeight: 600, background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('common.send')}</button>
                        <button onClick={() => setGreetingFor(null)} style={{ padding: '4px 6px', fontSize: '10px', background: 'transparent', color: '#9a8570', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
