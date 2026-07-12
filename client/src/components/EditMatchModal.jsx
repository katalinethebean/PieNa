import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { sendMatchInvites } from '../lib/utils';

const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(44,48,37,0.5)',
  backdropFilter: 'blur(4px)', zIndex: 100,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
};

export default function EditMatchModal({ session, onClose, onSaved }) {
  const { id: selfId, username: selfUsername } = useUser();
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
    if (error) { setError('保存失败，请重试'); return; }
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
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', margin: 0 }}>编辑比赛记录</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', fontSize: '18px', lineHeight: 1, padding: '2px 6px' }}>×</button>
        </div>

        <div>
          <label style={labelStyle}>赛事名称</label>
          <input style={inputStyle} value={form.tournament} onChange={e => setForm(f => ({ ...f, tournament: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>辩题</label>
          <input style={inputStyle} value={form.motion} onChange={e => setForm(f => ({ ...f, motion: e.target.value }))} />
        </div>
        <div>
          <label style={labelStyle}>持方</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['正方', '反方'].map(opt => (
              <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, side: opt }))}
                style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${form.side === opt ? '#a4b9b5' : 'rgba(200,184,154,0.5)'}`, background: form.side === opt ? 'rgba(164,185,181,0.15)' : 'transparent', color: '#2C3025', fontSize: '13px', fontWeight: form.side === opt ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>比分</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="number" min="0" max="99" style={{ ...inputStyle, textAlign: 'center' }} value={form.proScore} onChange={e => setForm(f => ({ ...f, proScore: e.target.value }))} placeholder="正方" />
            <span style={{ color: '#c8b89a' }}>–</span>
            <input type="number" min="0" max="99" style={{ ...inputStyle, textAlign: 'center' }} value={form.conScore} onChange={e => setForm(f => ({ ...f, conScore: e.target.value }))} placeholder="反方" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>上场辩手（@username 姓名，可标记佳辩）</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {['一辩', '二辩', '三辩', '四辩'].map((pos, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input style={{ ...inputStyle, fontSize: '13px' }} placeholder={pos} value={form.debaters[i] || ''}
                  onChange={e => setForm(f => {
                    const d = [...f.debaters]; d[i] = e.target.value;
                    const mvpFlags = [...f.mvpFlags]; if (!e.target.value) mvpFlags[i] = false;
                    return { ...f, debaters: d, mvpFlags };
                  })} />
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
          <label style={labelStyle}>备注</label>
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
            {saving ? '保存中…' : '保存'}
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
            style={{ padding: '11px 18px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', fontSize: '13px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit' }}>
            取消
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
