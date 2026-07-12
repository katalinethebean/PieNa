import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useFriend } from '../contexts/FriendContext';
import { supabase, isConfigured } from '../lib/supabase';
import { sendMatchInvites } from '../lib/utils';

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid rgba(200,184,154,0.6)', fontSize: '14px',
  color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
  outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: '#9a8570', marginBottom: '5px', letterSpacing: '0.07em',
};

function DebaterSearch({ value, onChange, placeholder, selfUser }) {
  const [focused, setFocused] = useState(false);
  const { friends } = useFriend();
  const [friendProfiles, setFriendProfiles] = useState([]);

  useEffect(() => {
    if (!friends || friends.length === 0) { setFriendProfiles([]); return; }
    supabase
      .from('profiles')
      .select('id, name, username, team')
      .in('id', friends)
      .then(({ data }) => setFriendProfiles(data || []));
  }, [friends]);

  const allSearchable = [
    { id: selfUser.id, name: selfUser.name, username: selfUser.username, team: selfUser.team, isSelf: true },
    ...friendProfiles,
  ];

  const query = value && !value.startsWith('@') ? value : '';

  const suggestions = query.length > 0
    ? allSearchable.filter(d =>
        d.name.includes(query) || d.username.includes(query) ||
        (d.team && d.team.includes(query))
      ).slice(0, 5)
    : [];

  const handleSelect = (d) => {
    onChange(`@${d.username}  ${d.name}${d.isSelf ? '（我）' : d.team ? `  (${d.team})` : ''}`);
    setFocused(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        style={inputStyle}
        autoComplete="off"
      />
      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'rgba(248,244,238,0.98)',
              border: '1px solid rgba(200,184,154,0.5)',
              borderRadius: '10px', zIndex: 50, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(44,48,37,0.12)',
            }}
          >
            {suggestions.map(d => (
              <div key={d.id}
                onMouseDown={() => handleSelect(d)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(200,184,154,0.15)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,184,154,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: d.isSelf ? 'rgba(164,185,181,0.3)' : 'rgba(44,48,37,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#2C3025', flexShrink: 0 }}>
                  {d.name.slice(0, 1)}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#2C3025' }}>
                    {d.name}{d.isSelf && <span style={{ fontSize: '10px', color: '#7d9b96', marginLeft: '5px' }}>（我）</span>}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9a8570' }}>@{d.username}{d.team ? ` · ${d.team}` : ''}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {focused && query.length > 0 && suggestions.length === 0 && (
        <p style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, fontSize: '10px', color: '#a4b9b5', letterSpacing: '0.04em' }}>
          未找到注册用户，将以姓名记录
        </p>
      )}
    </div>
  );
}

function SideToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0', background: 'rgba(217,205,181,0.35)', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', overflow: 'hidden', width: 'fit-content' }}>
      {['正方', '反方'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: '9px 24px', fontSize: '13px', fontWeight: value === opt ? 700 : 400,
            color: value === opt ? '#2C3025' : '#9a8570',
            background: value === opt ? 'rgba(255,255,255,0.85)' : 'transparent',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em',
            transition: 'all 0.18s', boxShadow: value === opt ? '0 1px 4px rgba(44,48,37,0.08)' : 'none',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MvpStar({ active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="佳辩"
      style={{
        flexShrink: 0, width: '36px', height: '36px', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(192,122,58,0.12)' : 'transparent',
        border: `1px solid ${active ? 'rgba(192,122,58,0.5)' : 'rgba(200,184,154,0.5)'}`,
        borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1, transition: 'all 0.15s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? '#c07a3a' : 'none'} stroke={active ? '#c07a3a' : '#9a8570'} strokeWidth="1.5" strokeLinejoin="round">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8-5.1-4.7 6.9-.8z"/>
      </svg>
    </button>
  );
}

export default function RecordMatch() {
  const navigate = useNavigate();
  const { addSession, id: selfId, name: selfName, username: selfUsername, team: selfTeam } = useUser();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motion: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
    mvpFlags: [false, false, false, false],
    notes: '',
  });

  const selfUser = { id: selfId, name: selfName, username: selfUsername, team: selfTeam };

  const setDebater = (i, v) => {
    setForm(f => {
      const d = [...f.debaters]; d[i] = v;
      const mvpFlags = [...f.mvpFlags];
      if (!v) mvpFlags[i] = false;
      return { ...f, debaters: d, mvpFlags };
    });
  };

  const toggleMvp = (i) => {
    setForm(f => {
      const mvpFlags = [...f.mvpFlags]; mvpFlags[i] = !mvpFlags[i];
      return { ...f, mvpFlags };
    });
  };

  const proS = parseInt(form.proScore) || 0;
  const conS = parseInt(form.conScore) || 0;
  const hasScores = form.proScore !== '' && form.conScore !== '';
  const won = hasScores
    ? (form.side === '正方' ? proS > conS : conS > proS)
    : null;
  const resultLabel = !hasScores ? '' : won ? '胜' : (proS === conS ? '平' : '负');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.motion.trim()) return;

    const payload = {
      motion: form.motion,
      date: new Date(form.date).toISOString(),
      side: form.side,
      role: form.side === '正方' ? '正方' : '反方',
      won: won,
      score: hasScores ? `${form.proScore}-${form.conScore}` : null,
      tournament: form.tournament,
      debaters: form.debaters,
      mvp_flags: form.mvpFlags,
      notes: form.notes,
      avg_score: null,
      argument_score: null, delivery_score: null, rebuttal_score: null,
      structure_score: null, evidence_score: null, fluency_score: null,
      feedback: null, transcript: null,
    };

    if (isConfigured && selfId) {
      setSaving(true);
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({ ...payload, user_id: selfId })
        .select()
        .single();
      setSaving(false);
      if (insertError) {
        setError('保存失败，请重试');
        return;
      }
      addSession(data);
      await sendMatchInvites(supabase, data.id, form.debaters, selfId, selfUsername);
    } else {
      addSession({ id: `record-${Date.now()}`, ...payload });
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: '560px', margin: '80px auto', padding: '24px', textAlign: 'center' }}>
        <motion.div className="glass-card" style={{ padding: '52px 40px' }}
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(90,143,122,0.12)', border: '1.5px solid rgba(90,143,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5a8f7a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#2C3025', marginBottom: '8px' }}>比赛已记录</h2>
          <p style={{ fontSize: '13px', color: '#7d6b55', lineHeight: 1.7, marginBottom: '6px' }}>{form.motion}</p>
          {form.tournament && <p style={{ fontSize: '11px', color: '#9a8570', marginBottom: '4px' }}>{form.tournament}</p>}
          <p style={{ fontSize: '12px', color: '#9a8570', marginBottom: '28px' }}>
            {form.side}{resultLabel ? ` · ${resultLabel}` : ''}{hasScores ? ` · ${form.proScore}–${form.conScore}` : ''}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => { setSubmitted(false); setForm({ date: new Date().toISOString().slice(0, 10), tournament: '', motion: '', side: '正方', proScore: '', conScore: '', debaters: ['', '', '', ''], mvpFlags: [false, false, false, false], notes: '' }); }}
              style={{ padding: '10px 20px', background: 'rgba(217,205,181,0.4)', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '20px', fontSize: '13px', color: '#6b5c45', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              再记录一场
            </button>
            <button
              onClick={() => navigate('/me')}
              style={{ padding: '10px 22px', background: '#2C3025', border: 'none', borderRadius: '20px', fontSize: '13px', color: '#E8E4DC', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              返回我的档案
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 24 }}>
        <div style={{ marginBottom: '28px' }}>
          <button type="button" onClick={() => navigate(-1)} style={{ fontSize: '12px', color: '#9a8570', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '12px', display: 'block' }}>← 返回</button>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>记录比赛</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Date */}
            <div>
              <label style={labelStyle}>比赛日期 *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} required />
            </div>

            {/* Tournament */}
            <div>
              <label style={labelStyle}>赛事名称</label>
              <input
                value={form.tournament}
                onChange={e => setForm(f => ({ ...f, tournament: e.target.value }))}
                placeholder=""
                style={inputStyle}
              />
            </div>

            {/* Motion */}
            <div>
              <label style={labelStyle}>辩题 *</label>
              <input
                value={form.motion}
                onChange={e => setForm(f => ({ ...f, motion: e.target.value }))}
                placeholder=""
                style={inputStyle}
                required
              />
            </div>

            {/* Side */}
            <div>
              <label style={labelStyle}>我方持方 *</label>
              <SideToggle value={form.side} onChange={v => setForm(f => ({ ...f, side: v }))} />
            </div>

            {/* Scores */}
            <div>
              <label style={labelStyle}>比分</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '10px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.04em' }}>正方</p>
                  <input
                    type="number" min="0" max="99"
                    value={form.proScore}
                    onChange={e => setForm(f => ({ ...f, proScore: e.target.value }))}
                    placeholder="0"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', fontWeight: 700 }}
                  />
                </div>
                <span style={{ fontSize: '20px', color: '#c8b89a', fontWeight: 300, paddingTop: '20px' }}>–</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '10px', color: '#9a8570', marginBottom: '4px', letterSpacing: '0.04em' }}>反方</p>
                  <input
                    type="number" min="0" max="99"
                    value={form.conScore}
                    onChange={e => setForm(f => ({ ...f, conScore: e.target.value }))}
                    placeholder="0"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', fontWeight: 700 }}
                  />
                </div>
                {hasScores && (
                  <div style={{ paddingTop: '20px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px',
                      color: resultLabel === '胜' ? '#5a8f7a' : resultLabel === '负' ? '#a03030' : '#9a8570',
                      background: resultLabel === '胜' ? 'rgba(90,143,122,0.1)' : resultLabel === '负' ? 'rgba(160,48,48,0.08)' : 'rgba(200,184,154,0.2)',
                      border: `1px solid ${resultLabel === '胜' ? 'rgba(90,143,122,0.25)' : resultLabel === '负' ? 'rgba(160,48,48,0.2)' : 'rgba(200,184,154,0.4)'}`,
                    }}>
                      {form.side} · {resultLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Debaters — my team's 4 */}
            <div>
              <label style={labelStyle}>我方辩手（输入用户名查找已注册的撇捺用户）</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['一辩', '二辩', '三辩', '四辩'].map((pos, i) => (
                  <div key={i}>
                    <label style={{ ...labelStyle, fontSize: '9px', color: '#9a8570', marginBottom: '3px' }}>{pos}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <DebaterSearch
                          value={form.debaters[i]}
                          onChange={v => setDebater(i, v)}
                          placeholder={pos}
                          selfUser={selfUser}
                        />
                      </div>
                      <MvpStar
                        active={form.mvpFlags[i]}
                        disabled={!form.debaters[i]}
                        onClick={() => toggleMvp(i)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>备注</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder=""
                style={{ ...inputStyle, resize: 'none', height: '64px', lineHeight: 1.6 }}
              />
            </div>

          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#a03030', background: 'rgba(160,48,48,0.08)', border: '1px solid rgba(160,48,48,0.18)', padding: '10px 12px', borderRadius: '8px', marginTop: '16px' }}>
              {error}
            </p>
          )}

          <motion.button
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            style={{
              marginTop: '16px', width: '100%', padding: '14px',
              background: saving ? '#9a8570' : '#2C3025', color: '#E8E4DC', border: 'none',
              borderRadius: '12px', fontSize: '14px', fontWeight: 600,
              letterSpacing: '0.04em', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? '保存中…' : '保存比赛记录'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
