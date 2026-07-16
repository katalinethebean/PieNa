import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useFriend } from '../contexts/FriendContext';
import { sendMatchInvites } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';

function DebaterSearch({ value, onChange, placeholder, selfUser, inputStyle }) {
  const [focused, setFocused] = useState(false);
  const { friends } = useFriend();
  const [friendProfiles, setFriendProfiles] = useState([]);

  useEffect(() => {
    if (!friends || friends.length === 0) { setFriendProfiles([]); return; }
    supabase.from('profiles').select('id, name, username, team').in('id', friends)
      .then(({ data }) => setFriendProfiles(data || []));
  }, [friends]);

  const allSearchable = [
    { id: selfUser.id, name: selfUser.name, username: selfUser.username, team: selfUser.team, isSelf: true },
    ...friendProfiles,
  ];

  const query = value && !value.startsWith('@') ? value : '';
  const suggestions = query.length > 0
    ? allSearchable.filter(d => d.name.includes(query) || d.username.includes(query)).slice(0, 5)
    : [];

  const handleSelect = (d) => {
    onChange(`@${d.username}  ${d.name}${d.isSelf ? '（我）' : d.team ? `  (${d.team})` : ''}`);
    setFocused(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder} style={inputStyle} autoComplete="off" />
      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'rgba(248,244,238,0.98)', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(44,48,37,0.12)' }}>
            {suggestions.map(d => (
              <div key={d.id} onMouseDown={() => handleSelect(d)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(200,184,154,0.15)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,184,154,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(44,48,37,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#2C3025', flexShrink: 0 }}>
                  {d.name.slice(0, 1)}
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#2C3025' }}>{d.name}{d.isSelf && <span style={{ fontSize: '10px', color: '#7d9b96', marginLeft: '4px' }}>（我）</span>}</p>
                  <p style={{ fontSize: '10px', color: '#9a8570' }}>@{d.username}{d.team ? ` · ${d.team}` : ''}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(44,48,37,0.5)',
  backdropFilter: 'blur(4px)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
};

export default function EditMatchModal({ session, onClose, onSaved }) {
  const { t } = useLanguage();
  const { id: selfId, name: selfName, username: selfUsername, team: selfTeam } = useUser();
  const selfUser = { id: selfId, name: selfName, username: selfUsername, team: selfTeam };
  const [form, setForm] = useState({
    tournament: session.tournament || '',
    motion: session.motion || '',
    side: session.side || '正方',
    proScore: (session.score || '').split('-')[0] || '',
    conScore: (session.score || '').split('-')[1] || '',
    debaters: session.debaters?.length ? [...session.debaters] : ['', '', '', ''],
    mvpFlags: session.mvp_flags?.length ? [...session.mvp_flags] : [false, false, false, false],
    notes: session.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const proS = parseInt(form.proScore) || 0;
  const conS = parseInt(form.conScore) || 0;
  const hasScores = form.proScore !== '' && form.conScore !== '';
  const won = hasScores ? (form.side === '正方' ? proS > conS : conS > proS) : null;

  const inputStyle = {
    width: '100%', padding: '9px 13px', border: '1px solid rgba(200,184,154,0.5)',
    fontSize: '13px', color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.6)',
    outline: 'none', fontFamily: 'inherit', borderRadius: '8px', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' };

  async function save() {
    setSaving(true);
    const patch = {
      tournament: form.tournament,
      motion: form.motion,
      side: form.side,
      won,
      score: hasScores ? `${form.proScore}-${form.conScore}` : null,
      debaters: form.debaters,
      mvp_flags: form.mvpFlags,
      notes: form.notes,
    };
    const { error } = await supabase.from('sessions').update(patch).eq('id', session.id);
    setSaving(false);
    if (error) { setError(t('record.error')); return; }
    // Newly @-tagged debaters should get a match invite, same as the upload flow
    if (selfId) await sendMatchInvites(supabase, session.id, form.debaters, selfId, selfUsername);
    onSaved(patch);
  }

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ width: '100%', maxWidth: '460px', background: '#F2EDE4', borderRadius: '16px', padding: '28px', maxHeight: '86vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', margin: 0 }}>{t('record.title_edit')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <div>
          <label style={labelStyle}>{t('record.tournament')}</label>
          <input style={inputStyle} value={form.tournament} onChange={e => setForm(f => ({ ...f, tournament: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>{t('record.motion')}</label>
          <input style={inputStyle} value={form.motion} onChange={e => setForm(f => ({ ...f, motion: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>{t('record.side')}</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ val: '正方', label: t('record.pro') }, { val: '反方', label: t('record.con') }].map(({ val, label: optLabel }) => (
              <button key={val} type="button" onClick={() => setForm(f => ({ ...f, side: val }))}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${form.side === val ? '#a4b9b5' : 'rgba(200,184,154,0.5)'}`, background: form.side === val ? 'rgba(164,185,181,0.15)' : 'transparent', color: '#2C3025', fontSize: '13px', fontWeight: form.side === val ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {optLabel}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('record.score')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="number" min="0" max="99" style={{ ...inputStyle, textAlign: 'center' }} value={form.proScore} onChange={e => setForm(f => ({ ...f, proScore: e.target.value }))} placeholder={t('record.pro')} />
            <span style={{ color: '#c8b89a' }}>–</span>
            <input type="number" min="0" max="99" style={{ ...inputStyle, textAlign: 'center' }} value={form.conScore} onChange={e => setForm(f => ({ ...f, conScore: e.target.value }))} placeholder={t('record.con')} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('record.debaters_label')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[t('lb.pos1'), t('lb.pos2'), t('lb.pos3'), t('lb.pos4')].map((pos, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <DebaterSearch
                    value={form.debaters[i] || ''}
                    onChange={v => setForm(f => {
                      const d = [...f.debaters]; d[i] = v;
                      const mvpFlags = [...f.mvpFlags]; if (!v) mvpFlags[i] = false;
                      return { ...f, debaters: d, mvpFlags };
                    })}
                    placeholder={pos}
                    selfUser={selfUser}
                    inputStyle={{ ...inputStyle, fontSize: '13px' }}
                  />
                </div>
                <button type="button" title="佳辩" disabled={!form.debaters[i]}
                  onClick={() => setForm(f => { const m = [...f.mvpFlags]; m[i] = !m[i]; return { ...f, mvpFlags: m }; })}
                  style={{ flexShrink: 0, width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: form.mvpFlags[i] ? 'rgba(192,122,58,0.12)' : 'transparent', border: `1px solid ${form.mvpFlags[i] ? 'rgba(192,122,58,0.5)' : 'rgba(200,184,154,0.5)'}`, borderRadius: '8px', cursor: form.debaters[i] ? 'pointer' : 'not-allowed', opacity: form.debaters[i] ? 1 : 0.35 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={form.mvpFlags[i] ? '#c07a3a' : 'none'} stroke={form.mvpFlags[i] ? '#c07a3a' : '#9a8570'} strokeWidth="1.5" strokeLinejoin="round">
                    <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8-5.1-4.7 6.9-.8z"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('record.notes')}</label>
          <textarea style={{ ...inputStyle, resize: 'none', height: '64px', lineHeight: 1.6 }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        {error && (
          <p style={{ fontSize: '12px', color: '#a03030', background: 'rgba(160,48,48,0.08)', border: '1px solid rgba(160,48,48,0.18)', padding: '10px 12px', borderRadius: '8px', margin: 0 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
            style={{ flex: 1, padding: '11px', background: saving ? '#9a8570' : '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? t('record.saving') : t('common.save')}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
            style={{ padding: '11px 18px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', fontSize: '13px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.cancel')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
