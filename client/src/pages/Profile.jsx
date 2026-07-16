import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useFriend } from '../contexts/FriendContext';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatChineseDate, API_URL } from '../lib/utils';
import { supabase, isConfigured } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import TeamPicker from '../components/TeamPicker';
import { useIsMobile } from '../lib/useIsMobile';

const SCORE_LABELS = [
  { key: 'fluency_score', label: '流畅' },
  { key: 'originality_score', label: '原创' },
  { key: 'flexibility_score', label: '灵活' },
  { key: 'targetedness_score', label: '针对' },
  { key: 'logicality_score', label: '逻辑' },
  { key: 'effectiveness_score', label: '有效' },
  { key: 'clarity_score', label: '清晰' },
  { key: 'appeal_score', label: '吸引' },
];

const scoreColor = s => s >= 8 ? 'var(--color-success)' : s >= 7 ? 'var(--color-sage-dark)' : '#c07a3a';
const spring = { type: 'spring', stiffness: 300, damping: 22 };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 24 } } };
const ctr = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(44,48,37,0.5)',
  backdropFilter: 'blur(4px)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
};

function AnimatedNumber({ value, decimals = 1, style: s }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const dur = 1200, t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (value * e).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    }
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);
  return <span ref={ref} style={{ ...s, fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(decimals)}</span>;
}

function avgByDimension(sessions) {
  // Average each dimension only over sessions that actually have it — old-rubric
  // sessions (argument/structure/fluency columns) must not drag new dimensions to 0.
  return SCORE_LABELS.map(({ key, label }) => {
    const vals = sessions.map(s => s[key]).filter(v => Number.isFinite(v));
    return {
      subject: label,
      score: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
      fullMark: 10,
    };
  });
}

function FriendButton({ id }) {
  const { lang, t } = useLanguage();
  const { friends, sentRequests, receivedRequests, sendRequest, cancelRequest, acceptRequest, unfriend } = useFriend();
  const [confirmingUnfriend, setConfirmingUnfriend] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);
  const [greetingDraft, setGreetingDraft] = useState('');
  const isFriend = friends.includes(id);
  const hasSent = sentRequests.includes(id);
  const hasReceived = receivedRequests.includes(id);
  const btnBase = { padding: '8px 18px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', fontWeight: 600, border: 'none' };
  const inputSt = { padding: '7px 11px', border: '1px solid rgba(200,184,154,0.6)', borderRadius: '8px', fontSize: '12px', color: '#2C3025', background: 'rgba(255,255,255,0.6)', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
  if (isFriend) return (
    <>
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setConfirmingUnfriend(true)}
        style={{ ...btnBase, background: 'rgba(90,143,122,0.12)', border: '1px solid rgba(90,143,122,0.3)', color: 'var(--color-success)' }}>
        {t('profile.already_friends')}
      </motion.button>
      {confirmingUnfriend && (
        <ConfirmModal
          title="删除好友"
          message="确定要删除这位好友吗？删除后需要重新发送好友请求。"
          confirmLabel="删除"
          danger
          onCancel={() => setConfirmingUnfriend(false)}
          onConfirm={() => { unfriend(id); setConfirmingUnfriend(false); }}
        />
      )}
    </>
  );
  if (hasSent) return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={() => cancelRequest(id)}
      style={{ ...btnBase, background: 'rgba(217,205,181,0.4)', border: '1px solid rgba(200,184,154,0.4)', color: '#9a8570' }}>
      {t('profile.friend_sent')}
    </motion.button>
  );
  if (hasReceived) return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={() => acceptRequest(id)}
      style={{ ...btnBase, background: 'rgba(192,122,58,0.12)', border: '1px solid rgba(192,122,58,0.3)', color: '#c07a3a' }}>
      接受好友请求
    </motion.button>
  );
  if (!greetingOpen) return (
    <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setGreetingOpen(true); setGreetingDraft(''); }}
      style={{ ...btnBase, background: '#2C3025', color: '#E8E4DC' }}>
      {t('profile.add_friend')}
    </motion.button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
      <input autoFocus value={greetingDraft} onChange={e => setGreetingDraft(e.target.value.slice(0, 20))}
        placeholder="打个招呼吧（可选，20字内）" style={inputSt}
        onKeyDown={e => { if (e.key === 'Enter') { sendRequest(id, greetingDraft); setGreetingOpen(false); } if (e.key === 'Escape') setGreetingOpen(false); }} />
      <div style={{ display: 'flex', gap: '6px' }}>
        <motion.button whileTap={{ scale: 0.96 }}
          onClick={() => { sendRequest(id, greetingDraft); setGreetingOpen(false); }}
          style={{ ...btnBase, padding: '7px 14px', background: '#2C3025', color: '#E8E4DC' }}>{t('profile.add_friend')}</motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => setGreetingOpen(false)}
          style={{ ...btnBase, padding: '7px 14px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', color: '#9a8570' }}>{t('profile.cancel')}</motion.button>
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ user, onClose, navigate }) {
  const { lang, t } = useLanguage();
  const { user: authUser } = useAuth();
  const [email, setEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [wechat, setWechat] = useState(user.wechat || '');
  const [isPublic, setIsPublic] = useState(user.isPublic);
  const [msg, setMsg] = useState({});
  const [deleteStep, setDeleteStep] = useState(0);
  const [busy, setBusy] = useState('');

  async function changeUsername() {
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setMsg(m => ({ ...m, username: '用户名只能含英文字母、数字和下划线' })); return; }
    setBusy('username');
    const { data: available } = await supabase.rpc('is_username_available', { p_username: trimmed });
    if (!available) { setMsg(m => ({ ...m, username: '该用户名已被使用，请换一个' })); setBusy(''); return; }
    const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
    setBusy('');
    if (error) { setMsg(m => ({ ...m, username: '修改失败：' + error.message })); return; }
    user.setUsername?.(trimmed);
    setMsg(m => ({ ...m, username: '用户名已更新' }));
    setNewUsername('');
  }

  async function changeEmail() {
    if (!email.trim()) return;
    setBusy('email');
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy('');
    setMsg(error ? { email: '修改失败：' + error.message } : { email: '确认邮件已发送，请查收邮箱' });
  }

  async function saveWechat() {
    setBusy('wechat');
    user.setWechat(wechat);
    if (isConfigured && user.id) {
      await supabase.from('profiles').update({ user_wechat: wechat }).eq('id', user.id);
    }
    setBusy('');
    setMsg({ wechat: t('settings.saved') });
  }

  async function togglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    user.setIsPublic(next);
    if (isConfigured && user.id) {
      await supabase.from('profiles').update({ is_public: next }).eq('id', user.id);
    }
    setMsg({ privacy: t('settings.saved') });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  async function deleteAccount() {
    setBusy('delete');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error();
      await supabase.auth.signOut();
      navigate('/');
    } catch {
      setMsg({ delete: '删除失败，请稍后重试' });
      setBusy('');
    }
  }

  const inputStyle = {
    flex: 1, padding: '8px 12px', border: '1px solid rgba(200,184,154,0.5)',
    fontSize: '13px', color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.6)',
    outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
  };
  const rowStyle = { display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '20px', borderBottom: '1px solid rgba(200,184,154,0.25)' };
  const labelStyle = { fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.08em' };
  const feedbackStyle = ok => ({ fontSize: '11px', color: ok ? 'var(--color-success)' : '#a03030' });
  const saveBtn = (label, onClick, loading) => (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={!!loading}
      style={{ padding: '8px 16px', background: loading ? '#c8b89a' : '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
      {loading ? '…' : label}
    </motion.button>
  );

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ width: '100%', maxWidth: '420px', background: '#F2EDE4', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', margin: 0 }}>{t('settings.title')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        {/* Username */}
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.username_section')}</span>
          <p style={{ fontSize: '11px', color: '#9a8570', margin: 0 }}>{t('settings.username_current', { username: user.username })}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={inputStyle} placeholder={t('settings.username_placeholder')} value={newUsername}
              onChange={e => { setNewUsername(e.target.value); setMsg(m => ({ ...m, username: '' })); }} />
            {saveBtn(t('settings.confirm'), changeUsername, busy === 'username')}
          </div>
          {msg.username && <span style={feedbackStyle(msg.username === '用户名已更新')}>{msg.username}</span>}
        </div>

        {/* Email */}
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.email_section')}</span>
          <p style={{ fontSize: '11px', color: '#9a8570', margin: 0 }}>{t('settings.email_current', { email: authUser?.email ?? '' })}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={inputStyle} type="email" placeholder={t('settings.email_placeholder')} value={email} onChange={e => { setEmail(e.target.value); setMsg(m => ({ ...m, email: '' })); }} />
            {saveBtn(t('settings.confirm'), changeEmail, busy === 'email')}
          </div>
          {msg.email && <span style={feedbackStyle(!msg.email.startsWith('修改失败'))}>{msg.email}</span>}
        </div>

        {/* WeChat */}
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.wechat_section')}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input style={inputStyle} placeholder={t('settings.wechat_placeholder')} value={wechat} onChange={e => { setWechat(e.target.value); setMsg(m => ({ ...m, wechat: '' })); }} />
            {saveBtn(t('settings.confirm'), saveWechat, busy === 'wechat')}
          </div>
          {msg.wechat && <span style={feedbackStyle(true)}>{t('settings.saved')}</span>}
        </div>

        {/* Public/Private */}
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.privacy_section')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <motion.div onClick={togglePublic} whileTap={{ scale: 0.95 }}
              style={{ width: '38px', height: '22px', position: 'relative', cursor: 'pointer', backgroundColor: isPublic ? 'var(--color-sage-dark)' : 'rgba(200,184,154,0.5)', borderRadius: '11px', transition: 'background-color 0.2s', flexShrink: 0 }}>
              <motion.div animate={{ left: isPublic ? '18px' : '3px' }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                style={{ position: 'absolute', top: '3px', width: '16px', height: '16px', backgroundColor: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
            </motion.div>
            <span style={{ fontSize: '13px', color: '#6b5c45' }}>{isPublic ? t('settings.public') : t('settings.private')}</span>
          </div>
          {msg.privacy && <span style={feedbackStyle(true)}>{msg.privacy}</span>}
        </div>

        {/* Logout */}
        <div style={rowStyle}>
          <span style={labelStyle}>{t('settings.logout')}</span>
          <motion.button whileTap={{ scale: 0.97 }} onClick={logout}
            style={{ padding: '10px', background: 'rgba(44,48,37,0.07)', border: '1px solid rgba(200,184,154,0.4)', borderRadius: '8px', fontSize: '13px', color: '#6b5c45', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left' }}>
            {t('settings.logout')}
          </motion.button>
        </div>

        {/* Delete account */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={labelStyle}>{t('settings.delete')}</span>
          {deleteStep === 0 && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setDeleteStep(1)}
              style={{ padding: '10px', background: 'rgba(160,48,48,0.06)', border: '1px solid rgba(160,48,48,0.2)', borderRadius: '8px', fontSize: '13px', color: '#a03030', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, textAlign: 'left' }}>
              {t('settings.delete')}
            </motion.button>
          )}
          {deleteStep === 1 && (
            <div style={{ background: 'rgba(160,48,48,0.06)', border: '1px solid rgba(160,48,48,0.2)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '13px', color: '#a03030', margin: 0, lineHeight: 1.6 }}>{t('settings.delete_confirm')}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <motion.button whileTap={{ scale: 0.97 }} onClick={deleteAccount} disabled={busy === 'delete'}
                  style={{ flex: 1, padding: '8px', background: '#a03030', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: busy === 'delete' ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {busy === 'delete' ? '…' : t('settings.confirm')}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setDeleteStep(0)}
                  style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '8px', fontSize: '12px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t('profile.cancel')}
                </motion.button>
              </div>
              {msg.delete && <span style={feedbackStyle(false)}>{msg.delete}</span>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Friends Modal ─────────────────────────────────────────────────────────────
function FriendsModal({ friendIds, onClose, navigate }) {
  const { lang, t } = useLanguage();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendIds.length) { setLoading(false); return; }
    if (!isConfigured) { setLoading(false); return; }
    supabase.from('profiles')
      .select('id, name, username, avatar_url, team')
      .in('id', friendIds)
      .then(({ data }) => { setProfiles(data || []); setLoading(false); });
  }, [friendIds]);

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ width: '100%', maxWidth: '380px', background: '#F2EDE4', borderRadius: '16px', padding: '28px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', margin: 0 }}>{t('profile.friends')} · {friendIds.length}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && <p style={{ color: '#9a8570', fontSize: '13px', textAlign: 'center', padding: '24px' }}>…</p>}
          {!loading && friendIds.length === 0 && (
            <p style={{ color: '#c8b89a', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>{t('profile.no_history')}</p>
          )}
          {!loading && profiles.map(p => (
            <motion.div key={p.id} whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}
              onClick={() => { onClose(); navigate(`/profile/${p.id}`); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(200,184,154,0.3)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#2C3025', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8E4DC', fontSize: '14px', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                {p.avatar_url ? <img src={p.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : (p.name || '?').slice(0, 1)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#2C3025', margin: 0 }}>{p.name || '—'}</p>
                <p style={{ fontSize: '11px', color: '#9a8570', margin: 0 }}>@{p.username}{p.team ? ` · ${p.team}` : ''}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}


// ── Match Card ─────────────────────────────────────────────────────────────────
function MatchCard({ s, index }) {
  const { lang, t } = useLanguage();
  return (
    <Link to={`/report/${s.id}`} style={{ textDecoration: 'none' }}>
      <motion.div className="glass-card"
        style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '4px 1fr auto', gap: '16px', alignItems: 'center', cursor: 'pointer' }}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.1 + index * 0.05 }}
        whileHover={{ y: -3, scale: 1.003, transition: spring }}
        whileTap={{ scale: 0.98 }}
      >
        <div style={{ width: '4px', alignSelf: 'stretch', minHeight: '36px', backgroundColor: s.won === true ? 'var(--color-success)' : s.won === false ? '#a03030' : '#c8b89a', borderRadius: '2px' }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#2C3025', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{s.motion}</p>
          <p style={{ fontSize: '11px', color: '#9a8570' }}>{s.date ? new Date(s.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}{s.score ? ` · ${s.score}` : ''}</p>
        </div>
        <span style={{ fontSize: Number.isFinite(s.avg_score) ? '24px' : '14px', fontWeight: 800, color: Number.isFinite(s.avg_score) ? scoreColor(s.avg_score) : '#c8b89a', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {Number.isFinite(s.avg_score) ? s.avg_score.toFixed(1) : 'N/A'}
        </span>
      </motion.div>
    </Link>
  );
}

// ── Main Profile Page ─────────────────────────────────────────────────────────
export default function Profile({ self }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { friends } = useFriend();
  const user = useUser();
  const { lang, t } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftTeam, setDraftTeam] = useState('');
  const [draftRegion, setDraftRegion] = useState('');
  const [draftHonors, setDraftHonors] = useState(['', '', '', '', '']);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const fileInputRef = useRef(null);
  const isMobile = useIsMobile();

  const isSelf = self || !id;

  const [otherProfile, setOtherProfile] = useState(null);
  const [otherSessions, setOtherSessions] = useState([]);
  const [otherLimited, setOtherLimited] = useState(false);
  const [loadingOther, setLoadingOther] = useState(!isSelf);
  const [otherNotFound, setOtherNotFound] = useState(false);

  useEffect(() => {
    if (isSelf || !id) return;
    setLoadingOther(true);
    setOtherNotFound(false);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_profile_view', { p_id: id });
        if (error || !data || data.not_found) { setOtherNotFound(true); return; }
        setOtherProfile(data.profile);
        setOtherSessions(data.sessions || []);
        setOtherLimited(!!data.limited);
      } catch (err) {
        console.error('加载档案失败:', err);
        setOtherNotFound(true);
      } finally {
        setLoadingOther(false);
      }
    })();
  }, [id, isSelf]);

  function startEditing() {
    setDraftName(user.name);
    setDraftBio(user.bio);
    setDraftTeam(user.team);
    setDraftRegion(user.region || '');
    setDraftHonors([...user.honors]);
    setEditing(true);
  }

  async function saveEditing() {
    user.setName(draftName);
    user.setBio(draftBio);
    user.setTeam(draftTeam);
    user.setRegion(draftRegion);
    user.setHonors(draftHonors);
    if (isConfigured && user.id) {
      if (draftTeam) {
        await supabase.from('teams').upsert({ name: draftTeam }, { onConflict: 'name', ignoreDuplicates: true });
      }
      await supabase.from('profiles').update({
        name: draftName,
        bio: draftBio,
        team: draftTeam,
        region: draftRegion,
        honors: draftHonors.filter(h => h),
      }).eq('id', user.id);
    }
    setEditing(false);
  }

  function cancelEditing() { setEditing(false); }

  const handleAvatarClick = () => { if (isSelf) fileInputRef.current?.click(); };
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user.id) return;
    if (!isConfigured) {
      const reader = new FileReader();
      reader.onload = () => user.setAvatarUrl(reader.result);
      reader.readAsDataURL(file);
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) { console.error('Avatar upload failed:', uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    user.setAvatarUrl(publicUrl);
  };

  const profile = isSelf
    ? { id: user.id, username: user.username, region: user.region, name: user.name, bio: user.bio, team: user.team, honors: user.honors, is_public: user.isPublic, sessions: user.sessions, avatarUrl: user.avatarUrl, avg_score: user.avg_score, joined: '', wechat: user.wechat }
    : otherProfile;

  if (!isSelf && loadingOther) return (
    <div style={{ maxWidth: '760px', margin: '60px auto', textAlign: 'center', padding: '24px' }}>
      <p style={{ fontSize: '14px', color: '#9a8570' }}>…</p>
    </div>
  );

  if (!isSelf && (otherNotFound || !profile)) return (
    <div style={{ maxWidth: '760px', margin: '60px auto', textAlign: 'center', padding: '24px' }}>
      <p style={{ fontSize: '16px', color: '#9a8570' }}>{t('profile.private')}</p>
      <button onClick={() => navigate(-1)} style={{ color: '#7d9b96', fontSize: '13px', display: 'block', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', margin: '8px auto 0' }}>← {t('common.back')}</button>
    </div>
  );

  const isFriendOfProfile = !isSelf && friends.includes(id);
  const isPrivateStranger = !isSelf && otherLimited;

  const sessions = isSelf ? (user.sessions || []) : otherSessions;
  const radarData = avgByDimension(sessions);
  const friendCount = isSelf ? friends.length : (profile.friend_count ?? 0);
  const winCount = sessions.filter(s => s.won).length;
  const winRate = sessions.length > 0 ? Math.round((winCount / sessions.length) * 100) : 0;
  const displayHonors = (profile.honors || []).filter(h => h);
  const displayAvatarUrl = isSelf ? user.avatarUrl : profile.avatar_url;

  const inputStyle = {
    width: '100%', padding: '9px 13px', border: '1px solid rgba(200,184,154,0.5)',
    fontSize: '14px', color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
    outline: 'none', fontFamily: 'inherit', borderRadius: '8px', boxSizing: 'border-box',
  };

  const ghostBtn = {
    padding: '8px 18px', background: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(200,184,154,0.5)', borderRadius: '20px',
    fontSize: '12px', color: '#6b5c45', cursor: 'pointer',
    fontFamily: 'inherit', letterSpacing: '0.04em',
  };

  return (
    <>
      <AnimatePresence>
        {showSettings && (
          <SettingsModal key="settings" user={user} onClose={() => setShowSettings(false)} navigate={navigate} />
        )}
        {showFriends && (
          <FriendsModal key="friends" friendIds={friends} onClose={() => setShowFriends(false)} navigate={navigate} />
        )}
      </AnimatePresence>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: isMobile ? '20px 16px 40px' : '40px 24px 80px' }}>
        <motion.div variants={ctr} initial="hidden" animate="show">

          {!isSelf && (
            <motion.div variants={item} style={{ marginBottom: '20px' }}>
              <button onClick={() => navigate(-1)} style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← {t('common.back')}</button>
            </motion.div>
          )}

          {/* Profile header card */}
          <motion.div variants={item} className="glass-card" style={{ marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{ height: '72px', background: 'linear-gradient(135deg, rgba(44,48,37,0.65) 0%, rgba(125,155,150,0.3) 60%, rgba(90,143,122,0.2) 100%)' }} />

            <div style={{ padding: '0 28px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-26px', marginBottom: '16px' }}>
                {/* Avatar */}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div onClick={handleAvatarClick}
                    style={{ width: '68px', height: '68px', borderRadius: '50%', background: '#2C3025', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8E4DC', fontSize: '24px', fontWeight: 700, border: '4px solid rgba(232,228,220,0.9)', cursor: isSelf ? 'pointer' : 'default', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    {displayAvatarUrl
                      ? <img src={displayAvatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : (profile.name || '?').slice(0, 1)
                    }
                    {isSelf && (
                      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9m-9 3h4m-2-2v4M7 14l9-9"/><path d="M14 3l7 7"/></svg>
                      </div>
                    )}
                  </div>
                  {isSelf && <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!isSelf && <FriendButton id={id} />}
                  {isFriendOfProfile && (
                    <Link to={`/chat/${id}`} style={{ textDecoration: 'none' }}>
                      <motion.button whileTap={{ scale: 0.97 }} style={ghostBtn}>
                        {t('profile.send_msg')}
                      </motion.button>
                    </Link>
                  )}
                  {isSelf && !editing && (
                    <>
                      <motion.button onClick={startEditing} whileTap={{ scale: 0.97 }} style={ghostBtn}>
                        {t('profile.edit')}
                      </motion.button>
                      <motion.button onClick={() => setShowSettings(true)} whileTap={{ scale: 0.97 }}
                        style={{ ...ghostBtn, padding: '8px 12px' }} title={t('profile.settings')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                        </svg>
                      </motion.button>
                    </>
                  )}
                  {editing && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <motion.button onClick={saveEditing} whileTap={{ scale: 0.97 }}
                        style={{ padding: '8px 18px', background: '#2C3025', border: 'none', borderRadius: '20px', fontSize: '12px', color: '#E8E4DC', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}>
                        {t('profile.save')}
                      </motion.button>
                      <motion.button onClick={cancelEditing} whileTap={{ scale: 0.97 }}
                        style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '20px', fontSize: '12px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('profile.cancel')}
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              {editing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.06em' }}>{t('profile.name')}</label>
                    <input style={inputStyle} value={draftName} onChange={e => setDraftName(e.target.value)} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.06em' }}>{t('profile.team')}</label>
                      <TeamPicker style={inputStyle} value={draftTeam} onChange={setDraftTeam} placeholder="如：拔萃学院辩论学会" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.06em' }}>{t('profile.region')}</label>
                      <select value={draftRegion} onChange={e => setDraftRegion(e.target.value)}
                        style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                        <option value="">{t('profile.region_placeholder')}</option>
                        {['北京','天津','上海','重庆','河北','山西','辽宁','吉林','黑龙江','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','内蒙古','广西','西藏','宁夏','新疆','香港','澳门','台湾','海外'].map(r => (
                          <option key={r} value={r}>{t('region.' + r)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.06em' }}>{t('profile.bio')}</label>
                    <textarea
                      style={{ ...inputStyle, resize: 'none', height: '88px', lineHeight: '1.6' }}
                      value={draftBio}
                      onChange={e => {
                        const lines = e.target.value.split('\n');
                        if (lines.length > 4) return;
                        if ([...e.target.value].length > 100) return;
                        setDraftBio(e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const lines = draftBio.split('\n');
                          if (lines.length >= 4) e.preventDefault();
                        }
                      }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--color-sage)', textAlign: 'right', marginTop: '3px' }}>
                      {[...draftBio].length}/100 · {draftBio.split('\n').length}/4行
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', letterSpacing: '0.06em' }}>{t('profile.honors')}</label>
                      {draftHonors.length < 5 && (
                        <button type="button"
                          onClick={() => setDraftHonors(h => [...h, ''])}
                          style={{ fontSize: '11px', color: '#7d9b96', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                          + 添加荣誉
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {draftHonors.map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input style={{ ...inputStyle, fontSize: '13px', flex: 1 }} value={h}
                            onChange={e => { const n = [...draftHonors]; n[i] = e.target.value; setDraftHonors(n); }}
                            placeholder={`荣誉 ${i + 1}`} />
                          <button type="button"
                            onClick={() => setDraftHonors(h => h.filter((_, j) => j !== i))}
                            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#c8b89a', padding: '4px', fontSize: '16px', lineHeight: 1 }}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p style={{ fontSize: '11px', color: '#a4b9b5', margin: 0 }}>{t('profile.avatar_hint')}</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : ((isSelf || isFriendOfProfile) ? '1fr 260px' : '1fr'), gap: isMobile ? '18px' : '24px', alignItems: 'start' }}>
                  {/* Left: info */}
                  <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>
                      {profile.name}
                    </h1>

                    {!isPrivateStranger && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#a4b9b5', letterSpacing: '0.04em' }}>@{profile.username}</span>
                        <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
                        <button onClick={() => isSelf && setShowFriends(true)}
                          style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 500, background: 'none', border: 'none', padding: 0, cursor: isSelf ? 'pointer' : 'default', fontFamily: 'inherit', textDecoration: isSelf ? 'underline' : 'none', textDecorationColor: 'rgba(107,92,69,0.3)' }}>
                          {friendCount} {t('profile.friends')}
                        </button>
                        {isSelf && (
                          <>
                            <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
                            <span style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 500 }}>{sessions.length} {t('profile.matches_unit')}</span>
                            <span style={{ color: 'rgba(200,184,154,0.5)', fontSize: '11px' }}>·</span>
                            <span style={{ fontSize: '12px', color: winRate >= 60 ? 'var(--color-success)' : '#6b5c45', fontWeight: 500 }}>{t('profile.win_rate')} {winRate}%</span>
                          </>
                        )}
                      </div>
                    )}
                    {isPrivateStranger && (
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#a4b9b5', letterSpacing: '0.04em' }}>@{profile.username}</span>
                      </div>
                    )}

                    {(profile.team || profile.region || ((isSelf || isFriendOfProfile) && profile.wechat)) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {profile.team && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                            <span style={{ fontSize: '12px', color: '#7d6b55', fontWeight: 500 }}>{profile.team}</span>
                          </div>
                        )}
                        {profile.region && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            <span style={{ fontSize: '12px', color: '#7d6b55', fontWeight: 500 }}>{t('region.' + profile.region) || profile.region}</span>
                          </div>
                        )}
                        {(isSelf || isFriendOfProfile) && profile.wechat && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            <span style={{ fontSize: '12px', color: '#7d6b55', fontWeight: 500 }}>{t('settings.wechat_section')}：{profile.wechat}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {profile.bio && <p style={{ fontSize: '13px', color: '#6b5c45', lineHeight: '1.75', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>{profile.bio}</p>}

                    {!isPrivateStranger && displayHonors.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
                        {displayHonors.map((h, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#c07a3a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            <span style={{ fontSize: '12px', color: '#6b5c45' }}>{h}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isSelf && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(200,184,154,0.3)' }}>
                        <AnimatedNumber value={Number(profile.avg_score)} decimals={1} style={{ fontSize: '26px', fontWeight: 800, color: 'var(--color-sage-dark)', lineHeight: 1 }} />
                        <span style={{ fontSize: '11px', color: '#9a8570', marginLeft: '4px' }}>{t('profile.avg_score')}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: radar chart — self or friend with data */}
                  {(isSelf || (isFriendOfProfile && radarData.some(d => d.score > 0))) && (
                    <div style={{ height: '210px', paddingTop: '4px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                          <PolarGrid stroke="rgba(164,185,181,0.3)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5c45', fontSize: 11, fontFamily: 'inherit' }} />
                          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
                          <Radar dataKey="score" stroke="var(--color-sage-dark)" fill="var(--color-sage)" fillOpacity={0.28} strokeWidth={1.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* Sessions（仅本人可见） */}
          {isSelf && (
          <motion.div variants={item}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <Link to="/upload" style={{ textDecoration: 'none', flex: 1 }}>
                <motion.div className="glass-card" whileHover={{ y: -2, transition: spring }}
                  style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', border: '1px dashed rgba(200,184,154,0.5)', background: 'rgba(255,255,255,0.25)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(44,48,37,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12l7-7 7 7"/></svg>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 600 }}>{t('review.upload_action')}</span>
                </motion.div>
              </Link>
              <Link to="/record" style={{ textDecoration: 'none', flex: 1 }}>
                <motion.div className="glass-card" whileHover={{ y: -2, transition: spring }}
                  style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', border: '1px dashed rgba(200,184,154,0.5)', background: 'rgba(255,255,255,0.25)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(44,48,37,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b5c45', fontWeight: 600 }}>{t('review.record_action')}</span>
                </motion.div>
              </Link>
            </div>

            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.12em', marginBottom: '14px' }}>{t('profile.history')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sessions.map((s, i) => (
                <MatchCard key={s.id} s={s} index={i} />
              ))}
            </div>
          </motion.div>
          )}

        </motion.div>
      </div>
    </>
  );
}
