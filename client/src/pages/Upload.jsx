import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useFriend } from '../contexts/FriendContext';
import { useReviewJob } from '../contexts/ReviewJobContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, isConfigured } from '../lib/supabase';
import { sendMatchInvites } from '../lib/utils';

const SLOT_LABELS = ['一辩', '二辩', '三辩', '四辩'];
const LOADING_STEPS = [
  { msg: '正在上传录音...', pct: 15 },
  { msg: '正在转录音频...', pct: 40 },
  { msg: '正在分析辩论内容...', pct: 70 },
  { msg: '正在生成评分报告...', pct: 90 },
  { msg: '分析完成！', pct: 100 },
];

const PROTOTYPE_SCORES = {
  fluency_score: 7.9,
  originality_score: 7.6,
  flexibility_score: 8.0,
  targetedness_score: 7.4,
  logicality_score: 7.8,
  effectiveness_score: 7.1,
  clarity_score: 7.7,
  appeal_score: 7.2,
};

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid rgba(200,184,154,0.6)', fontSize: '14px',
  color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
  outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: '#6b5c45', marginBottom: '6px', letterSpacing: '0.06em',
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
    onChange(`@${d.username}  ${d.name}`);
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
                    {d.name}
                  </p>
                  <p style={{ fontSize: '10px', color: '#9a8570' }}>@{d.username}</p>
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

export default function Upload() {
  const navigate = useNavigate();
  const {
    id: selfId,
    name: selfName,
    username: selfUsername,
    team: selfTeam,
    addSession,
    spendCredit,
    credits,
  } = useUser();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    tournament: '',
    motionText: '',
    side: '正方',
    proScore: '',
    conScore: '',
    debaters: ['', '', '', ''],
    mvpFlags: [false, false, false, false],
    notes: '',
  });
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'audio'
  const [transcript, setTranscript] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const selfUser = { id: selfId, name: selfName, username: selfUsername, team: selfTeam };
  const { startJob } = useReviewJob();
  const { lang, t } = useLanguage();

  // Derive position from whichever debater slot contains @selfUsername + the side toggle
  function derivePosition() {
    const idx = form.debaters.findIndex(d => selfUsername && d.includes(`@${selfUsername}`));
    const slot = idx >= 0 ? SLOT_LABELS[idx] : '一辩';
    return `${form.side}${slot}`;
  }

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

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError('');
    }
  }

  async function handleTextSubmit(e) {
    e.preventDefault();
    if (!transcript.trim()) { setError('请输入发言内容或完整逐字稿'); return; }
    if (!form.motionText.trim()) { setError('请填写辩题'); return; }
    setError('');

    // 走全局异步任务：进度界面由 AnalysisOverlay 统一显示，
    // 完成后由 ReviewJobContext 自动保存比赛记录并跳转报告页
    const matchPayload = {
      motion: form.motionText.trim(),
      date: new Date(form.date).toISOString(),
      role: derivePosition(),
      side: form.side,
      won,
      score: hasScores ? `${form.proScore}-${form.conScore}` : null,
      tournament: form.tournament,
      debaters: form.debaters,
      mvp_flags: form.mvpFlags,
      notes: form.notes,
    };
    const { error: startError } = await startJob({
      kind: 'match',
      position: derivePosition(),
      motion: form.motionText.trim(),
      text: transcript,
      context: aiContext,
      matchPayload,
    });
    if (startError) setError(startError);
  }

  function handleAudioSubmit(e) {
    e.preventDefault();
    if (!file) { setError('请先选择一段录音或录像文件'); return; }
    if (credits < 1) { setError('剩余点数不足，暂时不能开始新的分析'); return; }

    setLoading(true); setStep(0); setProgress(0);
    const delays = [0, 600, 1300, 2100, 2700];
    LOADING_STEPS.forEach((s, i) => {
      setTimeout(async () => {
        setStep(i); setProgress(s.pct);
        if (i === LOADING_STEPS.length - 1) {
          const avg = Object.values(PROTOTYPE_SCORES).reduce((sum, score) => sum + score, 0) / Object.values(PROTOTYPE_SCORES).length;
          const payload = {
            motion: form.motionText.trim() || '未填写辩题',
            date: new Date(form.date).toISOString(),
            role: derivePosition(),
            side: form.side, won,
            score: hasScores ? `${form.proScore}-${form.conScore}` : null,
            tournament: form.tournament,
            debaters: form.debaters,
            mvp_flags: form.mvpFlags,
            notes: form.notes,
            avg_score: Math.round(avg * 10) / 10,
            ...PROTOTYPE_SCORES,
            feedback: '这是原型模式下生成的示例点评：你的发言结构清楚，主要论点能够被听众快速抓住。下一步可以把反驳对象说得更具体，并补充一两个可验证的事实或案例来增强论证力度。',
            transcript: `【原型转录】已接收文件「${file.name}」。后端接入后，这里会显示真实 AI 转录文本。`,
          };

          let id;
          if (isConfigured && selfId) {
            const { data, error: insertError } = await supabase
              .from('sessions').insert({ ...payload, user_id: selfId, language: lang }).select().single();
            if (insertError) { setLoading(false); setError('保存分析结果失败，请重试'); return; }
            id = data.id;
            addSession(data);
            await sendMatchInvites(supabase, data.id, form.debaters, selfId, selfUsername);
          } else {
            id = `analysis-${Date.now()}`;
            addSession({ id, ...payload });
          }
          spendCredit();
          setTimeout(() => navigate(`/report/${id}`), 400);
        }
      }, delays[i]);
    });
  }

  function handleSubmit(e) {
    if (inputMode === 'text') return handleTextSubmit(e);
    return handleAudioSubmit(e);
  }

  if (loading && inputMode === 'audio') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '32px', padding: '24px' }}>
      <div style={{ position: 'relative', width: '72px', height: '72px' }}>
        <div style={{ width: '72px', height: '72px', border: '2px solid rgba(217,205,181,0.5)', borderTopColor: '#a4b9b5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ position: 'absolute', inset: '12px', border: '1.5px solid rgba(200,184,154,0.4)', borderBottomColor: '#7d9b96', borderRadius: '50%', animation: 'spin 1.5s linear infinite reverse' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '16px', fontWeight: 600, color: '#2C3025', letterSpacing: '0.06em', marginBottom: '6px' }}>{LOADING_STEPS[step].msg}</p>
        <p style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.04em' }}>请稍候，AI 正在处理你的录音</p>
      </div>
      <div style={{ width: '280px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9a8570', letterSpacing: '0.04em' }}>处理进度</span>
          <span style={{ fontSize: '11px', color: '#7d9b96', fontWeight: 600 }}>{progress}%</span>
        </div>
        <div style={{ height: '3px', background: 'rgba(217,205,181,0.6)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div style={{ height: '100%', backgroundColor: '#a4b9b5', borderRadius: '2px' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '280px' }}>
        {LOADING_STEPS.slice(0, -1).map((s, i) => (
          <motion.div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }} animate={{ opacity: i <= step ? 1 : 0.4 }} transition={{ duration: 0.3 }}>
            <motion.div style={{ width: '18px', height: '18px', flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${i <= step ? '#a4b9b5' : 'rgba(200,184,154,0.4)'}` }} animate={{ backgroundColor: i <= step ? '#a4b9b5' : 'rgba(217,205,181,0.5)' }} transition={{ duration: 0.3 }}>
              {i < step && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#2C3025" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </motion.div>
            <span style={{ fontSize: '12px', color: i <= step ? '#2C3025' : '#9a8570', letterSpacing: '0.02em', transition: 'color 0.3s' }}>{s.msg.replace('...', '')}</span>
          </motion.div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const proS = parseInt(form.proScore) || 0;
  const conS = parseInt(form.conScore) || 0;
  const hasScores = form.proScore !== '' && form.conScore !== '';
  const won = hasScores ? (form.side === '正方' ? proS > conS : conS > proS) : null;
  const resultLabel = !hasScores ? '' : won ? '胜' : (proS === conS ? '平' : '负');

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto', padding: '48px 24px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
        <div style={{ marginBottom: '32px' }}>
          <button type="button" onClick={() => navigate(-1)} style={{ fontSize: '12px', color: '#9a8570', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: '12px', display: 'block' }}>← 返回</button>
          <p style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.1em', marginBottom: '6px' }}>新建分析</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.04em' }}>比赛分析</h1>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#a4b9b5', marginTop: '10px', borderRadius: '1px' }} />
        </div>

        <motion.div className="glass-card" style={{ padding: '32px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '8px', padding: '4px', background: 'rgba(217,205,181,0.25)', borderRadius: '10px' }}>
              {[['text', '文字分析'], ['audio', '音频 / 视频']].map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => { setInputMode(mode); setError(''); }}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                    fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.18s',
                    border: inputMode === mode ? '1px solid rgba(164,185,181,0.5)' : '1px solid transparent',
                    background: inputMode === mode ? 'rgba(255,255,255,0.75)' : 'transparent',
                    color: inputMode === mode ? '#2C3025' : '#9a8570',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Audio mode — 功能开发中 */}
            {inputMode === 'audio' && (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                border: '1.5px dashed rgba(200,184,154,0.6)', borderRadius: '12px',
                background: 'rgba(255,255,255,0.3)',
              }}>
                <p style={{ fontSize: '28px', margin: '0 0 12px' }}>🎙️</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#6b5c45', marginBottom: '4px' }}>功能还在开发中～敬请期待</p>
                <p style={{ fontSize: '12px', color: '#9a8570', margin: 0 }}>录音 / 录像分析上线前，可以先用文字分析粘贴逐字稿</p>
              </div>
            )}

            {/* Transcript (text mode) */}
            {inputMode === 'text' && (
              <div>
                <label style={labelStyle}>
                  发言内容 <span style={{ color: '#a03030' }}>*</span>
                  <span style={{ fontWeight: 400, color: '#9a8570', marginLeft: '6px' }}>（粘贴文字转录或稿件原文）</span>
                </label>
                <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
                  placeholder="黏贴文字转录或稿件原文"
                  rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
              </div>
            )}

            {inputMode === 'text' && (
              <div>
                <label style={labelStyle}>补充信息 <span style={{ fontWeight: 400, color: '#9a8570' }}>（可选）</span></label>
                <textarea value={aiContext} onChange={e => setAiContext(e.target.value)}
                  placeholder="详细提示词/问题"
                  rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(217,205,181,0.4)', paddingTop: '4px' }} />

            {/* Date */}
            <div>
              <label style={labelStyle}>比赛日期 <span style={{ color: '#a03030' }}>*</span></label>
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
              <label style={labelStyle}>辩题</label>
              <input style={inputStyle} placeholder="" value={form.motionText} onChange={e => setForm(f => ({ ...f, motionText: e.target.value }))} />
            </div>

            {/* Side */}
            <div>
              <label style={labelStyle}>我方持方 <span style={{ color: '#a03030' }}>*</span></label>
              <SideToggle value={form.side} onChange={v => setForm(f => ({ ...f, side: v }))} />
            </div>

            {/* Scores */}
            <div>
              <label style={labelStyle}>比分</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '10px', color: '#9a8570', marginBottom: '4px' }}>正方</p>
                  <input type="number" min="0" max="99" value={form.proScore} onChange={e => setForm(f => ({ ...f, proScore: e.target.value }))} placeholder="0" style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', fontWeight: 700 }} />
                </div>
                <span style={{ fontSize: '20px', color: '#c8b89a', fontWeight: 300, paddingTop: '20px' }}>–</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '10px', color: '#9a8570', marginBottom: '4px' }}>反方</p>
                  <input type="number" min="0" max="99" value={form.conScore} onChange={e => setForm(f => ({ ...f, conScore: e.target.value }))} placeholder="0" style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', fontWeight: 700 }} />
                </div>
                {hasScores && (
                  <div style={{ paddingTop: '20px', flexShrink: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '5px 12px', borderRadius: '20px', color: resultLabel === '胜' ? '#5a8f7a' : resultLabel === '负' ? '#a03030' : '#9a8570', background: resultLabel === '胜' ? 'rgba(90,143,122,0.1)' : resultLabel === '负' ? 'rgba(160,48,48,0.08)' : 'rgba(200,184,154,0.2)', border: `1px solid ${resultLabel === '胜' ? 'rgba(90,143,122,0.25)' : resultLabel === '负' ? 'rgba(160,48,48,0.2)' : 'rgba(200,184,154,0.4)'}` }}>
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
                {SLOT_LABELS.map((pos, i) => (
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

            {error && (
              <p style={{ fontSize: '12px', color: '#a03030', background: 'rgba(160,48,48,0.08)', border: '1px solid rgba(160,48,48,0.18)', padding: '10px 12px', borderRadius: '8px' }}>
                {error}
              </p>
            )}

            <div style={{ borderTop: '1px solid rgba(217,205,181,0.5)' }} />

            {inputMode === 'text' && (
              <>
                <motion.button type="submit" className="btn-shimmer" disabled={loading}
                  whileHover={!loading ? { scale: 1.01 } : {}} whileTap={!loading ? { scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 25 } } : {}}
                  style={{ width: '100%', padding: '14px', backgroundColor: loading ? 'rgba(44,48,37,0.5)' : '#2C3025', color: '#E8E4DC', border: 'none', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.1em', borderRadius: '10px' }}
                >
                  {loading ? 'AI 分析中…' : '开始分析'}
                </motion.button>

              </>
            )}
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}
