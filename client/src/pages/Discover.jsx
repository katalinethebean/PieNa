import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_UPCOMING_TOURNAMENTS } from '../lib/mockData';
import { useAuth } from '../contexts/AuthContext';
import { useFriend } from '../contexts/FriendContext';
import { useUser } from '../contexts/UserContext';
import { supabase, isConfigured } from '../lib/supabase';
import LoginPromptModal from '../components/LoginPromptModal';
import ConfirmModal from '../components/ConfirmModal';
import DebaterModal from '../components/DebaterModal';
import { useIsMobile } from '../lib/useIsMobile';

const spring = { type: 'spring', stiffness: 300, damping: 22 };

// ─── Left rail ───────────────────────────────────────────────────────────────

function MiniProfile() {
  const { friends } = useFriend();
  const { name, avatarUrl, avg_score, sessions } = useUser();
  const winRate = sessions && sessions.length > 0
    ? Math.round(sessions.filter(s => s.won).length / sessions.length * 100)
    : 0;
  const displayAvg = avg_score ? avg_score.toFixed(1) : '—';

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '12px' }}>
      <div style={{ height: '64px', borderRadius: '15px 15px 0 0', background: 'linear-gradient(135deg, rgba(125,155,150,0.4), rgba(90,143,122,0.3))', margin: '-24px -24px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '-28px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#2C3025', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8E4DC', fontSize: '24px', fontWeight: 700, border: '3px solid rgba(232,228,220,0.9)', marginBottom: '14px', overflow: 'hidden', flexShrink: 0 }}>
          {avatarUrl
            ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : (name || '?').slice(0, 1)
          }
        </div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#2C3025', marginBottom: '18px' }}>{name || '—'}</p>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          {[
            { v: displayAvg, l: '均分' },
            { v: sessions?.length ?? 0, l: '场次' },
            { v: friends.length, l: '好友' },
            { v: `${winRate}%`, l: '胜率' },
          ].map(({ v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '22px', fontWeight: 700, color: '#7d9b96', display: 'block' }}>{v}</span>
              <span style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.06em' }}>{l}</span>
            </div>
          ))}
        </div>
        <Link to="/me" style={{ textDecoration: 'none', width: '100%' }}>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ width: '100%', padding: '11px', textAlign: 'center', background: 'rgba(44,48,37,0.08)', border: '1px solid rgba(44,48,37,0.18)', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: '#2C3025', letterSpacing: '0.04em', cursor: 'pointer' }}>
            查看我的档案
          </motion.div>
        </Link>
      </div>
    </div>
  );
}

const RANK_BOARDS = [
  { key: '1', label: '一辩' },
  { key: '2', label: '二辩' },
  { key: '3', label: '三辩' },
  { key: '4', label: '四辩' },
  { key: 'overall', label: '全能' },
];

function formatRank(rank) {
  if (rank == null) return '-';
  return rank > 50 ? '50+' : rank;
}

const RANK_COLUMNS = '0.9fr 0.65fr 0.65fr 0.75fr 0.95fr';

function LeaderboardCard() {
  const [self, setSelf] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc('get_leaderboards').then(({ data, error }) => {
      setSelf(error ? null : (data?.self || null));
      setLoading(false);
    });
  }, []);

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '12px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.1em', marginBottom: '14px' }}>我的撇捺积分</p>
      {loading ? (
        <p style={{ fontSize: '12px', color: '#9a8570', textAlign: 'center', padding: '12px 0' }}>加载中…</p>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: RANK_COLUMNS, gap: '2px', paddingBottom: '6px', marginBottom: '2px', borderBottom: '1px solid rgba(200,184,154,0.4)' }}>
            {['辩位', '场次', '佳辩', '积分', '全服排名'].map((c, i) => (
              <span key={c} style={{ fontSize: '10px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.01em', textAlign: i === 0 ? 'left' : 'center' }}>{c}</span>
            ))}
          </div>
          {RANK_BOARDS.map(b => {
            const entry = self?.[b.key];
            return (
              <div key={b.key} style={{ display: 'grid', gridTemplateColumns: RANK_COLUMNS, gap: '2px', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(217,205,181,0.2)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#2C3025' }}>{b.label}</span>
                <span style={{ fontSize: '12px', color: '#6b5c45', textAlign: 'center' }}>{entry?.matches ?? 0}</span>
                <span style={{ fontSize: '12px', color: '#6b5c45', textAlign: 'center' }}>{entry?.mvp_count ?? 0}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#5a8f7a', textAlign: 'center' }}>{entry?.points ?? 0}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#c07a3a', textAlign: 'center' }}>{formatRank(entry?.rank)}</span>
              </div>
            );
          })}
        </div>
      )}
      <Link to="/leaderboard" style={{ textDecoration: 'none' }}>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(200,184,154,0.3)', textAlign: 'center', fontSize: '12px', color: '#7d9b96', fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }}>
          查看总榜 →
        </motion.div>
      </Link>
    </div>
  );
}

// ─── Right rail ───────────────────────────────────────────────────────────────

function PeopleSuggestions({ onShowMore }) {
  const { friends, sentRequests, receivedRequests, sendRequest } = useFriend();
  const { id: selfId } = useUser();
  const [suggestions, setSuggestions] = useState([]);
  const [greetingFor, setGreetingFor] = useState(null);
  const [greetingDraft, setGreetingDraft] = useState('');

  useEffect(() => {
    if (!selfId) return;
    supabase.rpc('get_people_suggestions').then(({ data }) => setSuggestions(data || []));
  }, [selfId, friends]);

  const slots = [...suggestions];
  while (slots.length < 3) slots.push(null);

  return (
    <div className="glass-card" style={{ padding: '20px', flexShrink: 0 }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.1em', marginBottom: '16px' }}>你可能认识</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {slots.map((d, i) => d ? (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to={`/profile/${d.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'rgba(44,48,37,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '12px', fontWeight: 700, overflow: 'hidden' }}>
                {d.avatar_url
                  ? <img src={d.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (d.name || '?').slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#2C3025', marginBottom: '1px' }}>{d.name}</p>
                <p style={{ fontSize: '10px', color: '#9a8570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.mutual_count > 0 ? `${d.mutual_count} 位共同好友` : ''}{d.mutual_count > 0 && d.same_school ? ' · ' : ''}{d.same_school ? '同校' : d.school || ''}
                </p>
              </div>
            </Link>
            <div style={{ flexShrink: 0 }}>
              {friends.includes(d.id) ? (
                <span style={{ fontSize: '11px', color: '#5a8f7a' }}>✓</span>
              ) : sentRequests.includes(d.id) ? (
                <span style={{ fontSize: '10px', color: '#c8b89a' }}>已发送</span>
              ) : receivedRequests.includes(d.id) ? (
                <button onClick={() => {}} style={{ fontSize: '10px', color: '#c07a3a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>接受</button>
              ) : greetingFor === d.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                  <input autoFocus value={greetingDraft} onChange={e => setGreetingDraft(e.target.value.slice(0, 20))}
                    placeholder="打个招呼（可选）" maxLength={20}
                    onKeyDown={e => { if (e.key === 'Enter') { sendRequest(d.id, greetingDraft); setGreetingFor(null); } if (e.key === 'Escape') setGreetingFor(null); }}
                    style={{ padding: '4px 7px', border: '1px solid rgba(125,155,150,0.4)', borderRadius: '5px', fontSize: '10px', outline: 'none', fontFamily: 'inherit', background: 'rgba(255,255,255,0.7)', color: '#2C3025' }} />
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <button onClick={() => { sendRequest(d.id, greetingDraft); setGreetingFor(null); }} style={{ flex: 1, padding: '3px', fontSize: '9px', fontWeight: 600, background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>发送</button>
                    <button onClick={() => setGreetingFor(null)} style={{ padding: '3px 5px', fontSize: '9px', background: 'transparent', color: '#9a8570', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setGreetingFor(d.id); setGreetingDraft(''); }} style={{ fontSize: '10px', color: '#7d9b96', background: 'none', border: '1px solid rgba(125,155,150,0.35)', padding: '3px 8px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit' }}>+ 加好友</button>
              )}
            </div>
          </div>
        ) : (
          <div key={`empty-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.4 }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0, background: 'rgba(44,48,37,0.08)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ width: '58%', height: '10px', borderRadius: '4px', background: 'rgba(44,48,37,0.08)', marginBottom: '6px' }} />
              <div style={{ width: '38%', height: '8px', borderRadius: '4px', background: 'rgba(44,48,37,0.06)' }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={onShowMore} style={{ width: '100%', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(200,184,154,0.3)', textAlign: 'center', fontSize: '12px', color: '#7d9b96', fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
        发现更多辩手 →
      </button>
    </div>
  );
}

function EditRecruitModal({ post, onClose, onSaved }) {
  const [form, setForm] = useState({ role: post.role || ROLE_OPTIONS[0], note: post.note || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '8px', fontSize: '13px', color: '#2C3025', background: 'rgba(255,255,255,0.65)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const { error: err } = await supabase.from('recruit_posts').update({ role: form.role, note: form.note.trim() }).eq('id', post.id);
    setSaving(false);
    if (err) { setError('保存失败，请重试'); return; }
    onSaved({ ...post, role: form.role, note: form.note.trim() });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(44,48,37,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass-card" style={{ width: '100%', maxWidth: '480px', padding: 0, overflow: 'hidden', background: 'rgba(248,244,238,0.97)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(200,184,154,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025' }}>编辑招募帖</h2>
          <button onClick={onClose} style={{ background: 'rgba(200,184,154,0.3)', border: '1px solid rgba(200,184,154,0.4)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', color: '#5a4a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: '6px' }}>身份 *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ROLE_OPTIONS.map(r => (
                <div key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                  style={{ padding: '7px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer', fontWeight: 600, border: form.role === r ? '1px solid #2C3025' : '1px solid rgba(200,184,154,0.5)', background: form.role === r ? '#2C3025' : 'rgba(255,255,255,0.65)', color: form.role === r ? '#E8E4DC' : '#5a4a3a' }}>{r}</div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#5a4a3a' }}>详情 *</label>
              <span style={{ fontSize: '11px', color: form.note.length >= 500 ? '#c0392b' : '#9a8570' }}>{form.note.length}/500</span>
            </div>
            <textarea required maxLength={500} value={form.note} onChange={set('note')} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          {error && <p style={{ fontSize: '12px', color: '#c0392b', textAlign: 'center' }}>{error}</p>}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit" disabled={saving}
            style={{ padding: '11px', background: saving ? '#9a8570' : '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? '保存中…' : '保存修改'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function MyRecruits({ refreshKey, onPostChange }) {
  const { id: selfId } = useUser();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);

  const load = () => {
    if (!selfId) return;
    setLoading(true);
    supabase
      .from('recruit_posts')
      .select('id, role, note, archived, created_at')
      .eq('user_id', selfId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false); });
  };

  useEffect(() => { load(); }, [selfId, refreshKey]);

  const toggleArchive = async (id, archived) => {
    await supabase.from('recruit_posts').update({ archived }).eq('id', id);
    setPosts(ps => ps.map(p => p.id === id ? { ...p, archived } : p));
    onPostChange?.();
  };

  const deletePost = async (id) => {
    await supabase.from('recruit_posts').delete().eq('id', id);
    setPosts(ps => ps.filter(p => p.id !== id));
    setConfirmDeleteId(null);
    onPostChange?.();
  };

  if (!selfId) return null;

  const sorted = [...posts].sort((a, b) => (a.archived === b.archived ? 0 : a.archived ? 1 : -1));

  return (
    <>
    {confirmDeleteId && (
      <ConfirmModal
        title="删除招募帖"
        message="确定要删除这条招募帖吗？删除后无法恢复。"
        confirmLabel="删除"
        danger
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => deletePost(confirmDeleteId)}
      />
    )}
    <AnimatePresence>
      {editingPost && (
        <EditRecruitModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={(updated) => {
            setPosts(ps => ps.map(p => p.id === updated.id ? updated : p));
            setEditingPost(null);
            onPostChange?.();
          }}
        />
      )}
    </AnimatePresence>
    <div className="glass-card" style={{ padding: '20px', marginTop: '12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.1em', marginBottom: '16px', flexShrink: 0 }}>我的招募</p>
      {loading ? (
        <p style={{ fontSize: '12px', color: '#9a8570', textAlign: 'center', padding: '12px 0' }}>加载中…</p>
      ) : sorted.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#9a8570', textAlign: 'center', padding: '12px 0' }}>还没有发布过招募</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '2px' }}>
          <AnimatePresence initial={false}>
            {sorted.map(p => (
              <motion.div key={p.id} layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ layout: { type: 'spring', stiffness: 260, damping: 30 }, opacity: { duration: 0.2 } }}
                style={{
                  padding: '12px 14px', borderRadius: '10px', position: 'relative', overflow: 'hidden',
                  flexShrink: 0,
                  background: p.archived ? 'rgba(154,133,112,0.12)' : 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(200,184,154,0.3)',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                    background: p.archived ? 'rgba(154,133,112,0.18)' : 'rgba(90,143,122,0.14)',
                    color: p.archived ? '#8a7560' : '#5a8f7a',
                  }}>{p.role || '其他'}{p.archived ? ' · 已归档' : ''}</span>
                  <span style={{ fontSize: '10px', color: '#9a8570', flexShrink: 0 }}>
                    {new Date(p.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
                <p style={{
                  fontSize: '12px', color: p.archived ? '#9a8570' : '#5a4a3a', marginBottom: '4px', lineHeight: 1.5,
                  paddingRight: '52px', whiteSpace: 'pre-wrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 10, WebkitBoxOrient: 'vertical',
                }}>{p.note}</p>
                <div style={{ position: 'absolute', right: '10px', bottom: '10px', display: 'flex', gap: '6px' }}>
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                    onClick={() => setEditingPost(p)}
                    title="编辑"
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(90,143,122,0.08)', border: '1px solid rgba(90,143,122,0.25)', borderRadius: '7px', cursor: 'pointer', color: '#5a8f7a', padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                    onClick={() => toggleArchive(p.id, !p.archived)}
                    title={p.archived ? '取消归档' : '归档'}
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(200,184,154,0.3)', border: '1px solid rgba(200,184,154,0.45)', borderRadius: '7px', cursor: 'pointer', color: '#7d6b55', padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v9a2 2 0 002 2h10a2 2 0 002-2V9"/><path d="M10 13h4"/>
                    </svg>
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                    onClick={() => setConfirmDeleteId(p.id)}
                    title="删除"
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(160,48,48,0.08)', border: '1px solid rgba(160,48,48,0.25)', borderRadius: '7px', cursor: 'pointer', color: '#a03030', padding: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Center tabs ──────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  '开放报名': '#5a8f7a',
  '即将开赛': '#c07a3a',
  '已截止': '#9a8570',
};

function TournamentCard({ t }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLOR[t.status] || '#9a8570';

  return (
    <motion.div
      className="glass-card"
      style={{ marginBottom: '10px', overflow: 'hidden', cursor: 'pointer' }}
      whileHover={{ y: -2, transition: spring }}
      onClick={() => setExpanded(v => !v)}
    >
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#2C3025', lineHeight: 1.4, flex: 1 }}>{t.name}</p>
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30`, flexShrink: 0 }}>
            {t.status}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {t.ageGroup && <span style={{ fontSize: '11px', color: '#6b5c45' }}>{t.ageGroup}</span>}
          {t.date && <><span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '10px' }}>·</span><span style={{ fontSize: '11px', color: '#9a8570' }}>{t.date.replace(/-/g, '/')} · {t.location}</span></>}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(200,184,154,0.3)', paddingTop: '12px' }}>
              {t.format && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(164,185,181,0.15)', border: '1px solid rgba(164,185,181,0.3)', padding: '3px 10px', borderRadius: '20px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#7d9b96', fontWeight: 600 }}>{t.format}</span>
                </div>
              )}
              {t.description && (
                <p style={{ fontSize: '12px', color: '#6b5c45', lineHeight: 1.75 }}>{t.description}</p>
              )}
              {t.deadline && (
                <p style={{ fontSize: '11px', color: '#9a8570', marginTop: '8px' }}>
                  报名截止：<span style={{ color: '#6b5c45', fontWeight: 600 }}>{t.deadline}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyState({ icon, title, sub, action, onAction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(200,184,154,0.2)', border: '1px solid rgba(200,184,154,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '22px' }}>
        {icon}
      </div>
      <p style={{ fontSize: '15px', fontWeight: 700, color: '#2C3025', marginBottom: '6px' }}>{title}</p>
      <p style={{ fontSize: '12px', color: '#9a8570', lineHeight: 1.7, maxWidth: '260px', marginBottom: action ? '24px' : '0' }}>{sub}</p>
      {action && (
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onAction}
          style={{ padding: '10px 24px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
        >
          {action}
        </motion.button>
      )}
    </div>
  );
}

function TournamentsTab() {
  return (
    <div>
      {MOCK_UPCOMING_TOURNAMENTS.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="暂无比赛信息"
          sub="比赛信息由官方账号发布，敬请期待"
        />
      ) : (
        MOCK_UPCOMING_TOURNAMENTS.map(t => <TournamentCard key={t.id} t={t} />)
      )}
    </div>
  );
}

const ROLE_OPTIONS = ['找队友', '找评委', '找教练', '其他'];

function RecruitModal({ onClose, onPosted }) {
  const { id: userId } = useUser();
  const [form, setForm] = useState({ role: ROLE_OPTIONS[0], note: '' });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { error: err } = await supabase.from('recruit_posts').insert({
      user_id: userId,
      role: form.role,
      note: form.note.trim(),
    });
    if (err) { setError('发布失败，请重试'); return; }
    setSubmitted(true);
    onPosted?.();
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', border: '1px solid rgba(200,184,154,0.5)',
    borderRadius: '8px', fontSize: '13px', color: '#2C3025',
    background: 'rgba(255,255,255,0.65)', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
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
        style={{ width: '100%', maxWidth: '480px', padding: 0, overflow: 'hidden', background: 'rgba(248,244,238,0.97)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(200,184,154,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', marginBottom: '2px' }}>发起招募</h2>
            <p style={{ fontSize: '11px', color: '#7d6b55' }}>发布招募帖，找到你的辩论搭档</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(200,184,154,0.3)', border: '1px solid rgba(200,184,154,0.4)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', color: '#5a4a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {submitted ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🎉</div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', marginBottom: '8px' }}>招募帖已发布！</p>
            <p style={{ fontSize: '13px', color: '#7d6b55', marginBottom: '24px' }}>其他辩手会看到你的招募信息</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClose}
              style={{ padding: '10px 28px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              好的
            </motion.button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#5a4a3a', display: 'block', marginBottom: '6px' }}>身份 *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {ROLE_OPTIONS.map(r => (
                  <div key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                    style={{
                      padding: '7px 14px', borderRadius: '16px', fontSize: '12px', cursor: 'pointer',
                      fontWeight: 600, letterSpacing: '0.02em',
                      border: form.role === r ? '1px solid #2C3025' : '1px solid rgba(200,184,154,0.5)',
                      background: form.role === r ? '#2C3025' : 'rgba(255,255,255,0.65)',
                      color: form.role === r ? '#E8E4DC' : '#5a4a3a',
                    }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#5a4a3a' }}>详情 *</label>
                <span style={{ fontSize: '11px', color: form.note.length >= 500 ? '#c0392b' : '#9a8570' }}>{form.note.length}/500</span>
              </div>
              <textarea required maxLength={500} value={form.note} onChange={set('note')} placeholder="赛事、招募辩位、要求、时间安排等…" rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
            </div>
            {error && <p style={{ fontSize: '12px', color: '#c0392b', textAlign: 'center' }}>{error}</p>}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} type="submit"
              style={{ padding: '11px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
              发布招募帖
            </motion.button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

function RecruitPostModal({ post, onClose, guest, onRequireLogin }) {
  const guardProfileClick = (e) => {
    if (guest) { e.preventDefault(); onRequireLogin?.(); return; }
    onClose();
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
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid rgba(200,184,154,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <Link to={`/profile/${post.user_id}`} onClick={guardProfileClick} style={{ flexShrink: 0 }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(44,48,37,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '13px', fontWeight: 700, overflow: 'hidden' }}>
                {post.profiles?.avatar_url
                  ? <img src={post.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (post.profiles?.name || '?').slice(0, 1)
                }
              </div>
            </Link>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <Link to={`/profile/${post.user_id}`} onClick={guardProfileClick} style={{ textDecoration: 'none', minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#2C3025', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{post.profiles?.name}</p>
                </Link>
                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: 'rgba(90,143,122,0.14)', color: '#5a8f7a', flexShrink: 0 }}>{post.role || '其他'}</span>
              </div>
              {post.profiles?.school && <p style={{ fontSize: '11px', color: '#9a8570' }}>{post.profiles.school}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(200,184,154,0.3)', border: '1px solid rgba(200,184,154,0.4)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '13px', color: '#5a4a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px' }}>✕</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <p style={{ fontSize: '13px', color: '#5a4a3a', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{post.note}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

const FEED_FILTERS = ['全部', '我的', '好友', '找队友', '找评委', '找教练', '其他'];

function TeammatesTab({ onRecruit, refreshKey, guest, onRequireLogin, onPostChange }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState(null);
  const [likes, setLikes] = useState([]); // { post_id, user_id }
  const [filters, setFilters] = useState([]); // 多选；空数组 = 全部
  const [seed, setSeed] = useState(() => Math.random());
  const { id: selfId } = useUser();

  const loadPosts = async () => {
    // 「我的」走独立的 MyRecruits 组件展示自己的招募帖，不查询公共 feed
    if (filters.includes('我的')) { setLoading(false); return; }
    setLoading(true);
    // 走 get_recruit_feed：按亲密度+新鲜度+热度+随机(seed)排序，不再一次性拉全平台
    const { data: postData } = await supabase.rpc('get_recruit_feed', {
      p_roles: filters.length ? filters : null,
      p_seed: seed,
      p_limit: 15,
    });
    // RPC 返回扁平字段，映射回卡片期望的 profiles 结构
    const posts = (postData || []).map(r => ({
      id: r.id, user_id: r.user_id, role: r.role, note: r.note, created_at: r.created_at,
      profiles: { name: r.name, school: r.school, avatar_url: r.avatar_url },
    }));
    setPosts(posts);
    if (posts.length > 0) {
      const { data: likeData } = await supabase
        .from('recruit_likes')
        .select('post_id, user_id')
        .in('post_id', posts.map(p => p.id));
      setLikes(likeData || []);
    } else {
      setLikes([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadPosts(); }, [refreshKey, filters, seed]);

  const toggleFilter = (f) => {
    if (f === '全部') { setFilters([]); return; }
    // 「我的」是独占模式（切到自己的招募列表），与身份多选筛选互斥
    if (f === '我的') { setFilters(prev => prev.includes('我的') ? [] : ['我的']); return; }
    setFilters(prev => {
      const withoutMine = prev.filter(x => x !== '我的');
      return withoutMine.includes(f) ? withoutMine.filter(x => x !== f) : [...withoutMine, f];
    });
  };

  const refresh = () => setSeed(Math.random());

  const toggleLike = async (e, postId, postOwnerId) => {
    e.stopPropagation();
    if (!selfId) { onRequireLogin?.(); return; }
    const hasLiked = likes.some(l => l.post_id === postId && l.user_id === selfId);
    if (hasLiked) {
      setLikes(prev => prev.filter(l => !(l.post_id === postId && l.user_id === selfId)));
      await supabase.from('recruit_likes').delete().eq('post_id', postId).eq('user_id', selfId);
    } else {
      setLikes(prev => [...prev, { post_id: postId, user_id: selfId }]);
      await supabase.from('recruit_likes').insert({ post_id: postId, user_id: selfId });
    }
  };

  const filterBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', flex: 1, minWidth: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {FEED_FILTERS.map(f => {
          const active = f === '全部' ? filters.length === 0 : filters.includes(f);
          return (
            <button key={f} onClick={() => toggleFilter(f)}
              style={{
                flexShrink: 0,
                padding: '5px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', border: 'none', transition: 'all .15s',
                background: active ? '#2C3025' : 'rgba(44,48,37,0.06)',
                color: active ? '#E8E4DC' : '#7d6b55',
                whiteSpace: 'nowrap',
              }}>{f}</button>
          );
        })}
      </div>
      {!filters.includes('我的') && (
        <motion.button
          whileHover={{ rotate: 90 }} whileTap={{ scale: 0.85 }} onClick={refresh}
          title="换一批"
          style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(44,48,37,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a4a3a' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
        </motion.button>
      )}
    </div>
  );

  if (filters.includes('我的')) return (
    <div>
      {filterBar}
      <MyRecruits refreshKey={refreshKey} onPostChange={onPostChange} />
    </div>
  );

  if (loading) return (
    <div>
      {filterBar}
      <p style={{ textAlign: 'center', padding: '48px 0', fontSize: '13px', color: '#9a8570' }}>加载中…</p>
    </div>
  );

  if (posts.length === 0) return (
    <div>
      {filterBar}
      <EmptyState
        icon="🤝"
        title={filters.length === 0 ? '还没有招募帖' : '没有符合筛选的招募'}
        sub={filters.length === 0 ? '成为第一个发起招募的人，找到你的辩论搭档' : '试试切换其他分类，或换一批看看'}
        action="发起招募"
        onAction={onRecruit}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {filterBar}
      {posts.map(p => {
        const likeCount = likes.filter(l => l.post_id === p.id).length;
        const hasLiked = likes.some(l => l.post_id === p.id && l.user_id === selfId);
        return (
          <motion.div key={p.id} whileHover={{ y: -2, transition: spring }} onClick={() => setOpenPost(p)}
            className="glass-card" style={{ padding: '16px 18px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Link to={`/profile/${p.user_id}`} onClick={e => { e.stopPropagation(); if (guest) { e.preventDefault(); onRequireLogin?.(); } }} style={{ flexShrink: 0 }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(44,48,37,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '11px', fontWeight: 700, overflow: 'hidden' }}>
                    {p.profiles?.avatar_url
                      ? <img src={p.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : (p.profiles?.name || '?').slice(0, 1)}
                  </div>
                </Link>
                <Link to={`/profile/${p.user_id}`} onClick={e => { e.stopPropagation(); if (guest) { e.preventDefault(); onRequireLogin?.(); } }} style={{ textDecoration: 'none', minWidth: 0 }}>
                  <p style={{ fontSize: '12px', color: '#5a4a3a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.profiles?.name}{p.profiles?.school ? ` · ${p.profiles.school}` : ''}
                  </p>
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: 'rgba(90,143,122,0.14)', color: '#5a8f7a' }}>{p.role || '其他'}</span>
                <span style={{ fontSize: '11px', color: '#9a8570' }}>
                  {new Date(p.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                </span>
              </div>
            </div>
            {p.note && (
              <p style={{ fontSize: '12px', color: '#7d6b55', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: '3.2em', overflow: 'hidden' }}>{p.note}</p>
            )}
            {/* 展开 + like 同一行 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '12px', color: '#7d9b96', fontWeight: 600, visibility: p.note && (p.note.length > 60 || (p.note.match(/\n/g) || []).length >= 2) ? 'visible' : 'hidden' }}>[展开]</span>
              <motion.button
                whileTap={{ scale: 0.8 }}
                onClick={e => toggleLike(e, p.id, p.user_id)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill={hasLiked ? '#e05a6a' : 'none'} stroke={hasLiked ? '#e05a6a' : '#c8b89a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
                <span style={{ fontSize: '11px', color: hasLiked ? '#e05a6a' : '#9a8570', fontWeight: 500, width: '16px', lineHeight: '14px', display: 'inline-block' }}>
                  {likeCount > 0 ? likeCount : ''}
                </span>
              </motion.button>
            </div>
          </motion.div>
        );
      })}
      <AnimatePresence>
        {openPost && <RecruitPostModal post={openPost} onClose={() => setOpenPost(null)} guest={guest} onRequireLogin={onRequireLogin} />}
      </AnimatePresence>
    </div>
  );
}

function ChallengeTab() {
  return (
    <EmptyState
      icon="⚔️"
      title="还没有约战帖"
      sub="向其他辩手发起约战，约定一场切磋"
      action="发起约战"
      onAction={() => {}}
    />
  );
}

function CenterFeed({ onRecruit, recruitRefreshKey, guest, onRequireLogin, isMobile, onPostChange }) {
  const teammates = (
    <TeammatesTab onRecruit={guest ? onRequireLogin : onRecruit} refreshKey={recruitRefreshKey} guest={guest} onRequireLogin={onRequireLogin} onPostChange={onPostChange} />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
        <p style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.04em' }}>招募大厅</p>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={guest ? onRequireLogin : onRecruit}
          style={{ padding: '9px 18px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
        >
          + 发起招募
        </motion.button>
      </div>

      {/* Content — 手机端随页面滚动，桌面端内部滚动 */}
      {isMobile ? teammates : (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto' }}>
            {teammates}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Discover() {
  const { user: authUser, loading: authLoading } = useAuth();
  const guest = isConfigured && !authLoading && !authUser;
  const [showModal, setShowModal] = useState(false);
  const [showRecruit, setShowRecruit] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [recruitRefreshKey, setRecruitRefreshKey] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const isMobile = useIsMobile();

  if (isConfigured && authLoading) return null;

  const feed = (
    <CenterFeed
      onRecruit={() => setShowRecruit(true)}
      recruitRefreshKey={recruitRefreshKey}
      guest={guest}
      onRequireLogin={() => setShowLoginPrompt(true)}
      isMobile={isMobile}
      onPostChange={() => setRecruitRefreshKey(k => k + 1)}
    />
  );

  // 手机端：招募大厅为主，个人卡/积分榜/好友推荐收进顶部「更多」折叠面板；
  // 我的招募改到招募大厅筛选栏里的「我的」tab（见 TeammatesTab）
  if (isMobile) {
    return (
      <div style={{ padding: '12px 16px 0' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => guest ? setShowLoginPrompt(true) : setShowMore(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', marginBottom: '12px', background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(200,184,154,0.35)', borderRadius: '14px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2C3025' }}>
            我的档案 · 积分榜 · 发现好友
          </span>
          <motion.svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7d6b55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            animate={{ rotate: showMore ? 180 : 0 }} transition={{ duration: 0.2 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </motion.button>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingBottom: '4px' }}>
                <MiniProfile />
                <LeaderboardCard />
                <PeopleSuggestions onShowMore={() => setShowModal(true)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {feed}
        <AnimatePresence>
          {showModal && <DebaterModal onClose={() => setShowModal(false)} />}
          {showRecruit && <RecruitModal onClose={() => setShowRecruit(false)} onPosted={() => { setShowRecruit(false); setRecruitRefreshKey(k => k + 1); }} />}
          {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  // 访客模式下左右栏保留但灰化，点击任意位置弹登录提示
  const railGuestStyle = guest ? { opacity: 0.45, filter: 'grayscale(0.4)', cursor: 'pointer' } : {};
  const railGuestProps = guest ? {
    onClickCapture: (e) => { e.preventDefault(); e.stopPropagation(); setShowLoginPrompt(true); },
  } : {};

  return (
    <div style={{ height: 'calc(100dvh - 60px)', overflow: 'hidden' }}>
      <div style={{
        width: '100%', height: '100%',
        padding: '0 32px', boxSizing: 'border-box',
        display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px',
      }}>
        {/* Left rail */}
        <aside style={{ paddingTop: '32px', paddingBottom: '32px', overflowY: 'hidden', ...railGuestStyle }} {...railGuestProps}>
          <MiniProfile />
          <LeaderboardCard />
        </aside>

        {/* Center */}
        <main style={{ paddingTop: '32px', paddingBottom: '32px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {feed}
        </main>

        {/* Right rail */}
        <aside style={{ paddingTop: '32px', paddingBottom: '32px', overflowY: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', ...railGuestStyle }} {...railGuestProps}>
          <PeopleSuggestions onShowMore={() => setShowModal(true)} />
          <MyRecruits refreshKey={recruitRefreshKey} onPostChange={() => setRecruitRefreshKey(k => k + 1)} />
        </aside>
      </div>

      <AnimatePresence>
        {showModal && <DebaterModal onClose={() => setShowModal(false)} />}
        {showRecruit && <RecruitModal onClose={() => setShowRecruit(false)} onPosted={() => { setShowRecruit(false); setRecruitRefreshKey(k => k + 1); }} />}
        {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
      </AnimatePresence>
    </div>
  );
}
