import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { useReviewJob } from '../contexts/ReviewJobContext';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import { useIsMobile } from '../lib/useIsMobile';

const POSITIONS = [
  '正方一辩', '正方二辩', '正方三辩', '正方四辩',
  '反方一辩', '反方二辩', '反方三辩', '反方四辩',
];

const SCORE_META = [
  { key: 'fluency',        label: '流畅', full: '流畅性', feedbackKey: 'feedback_fluency' },
  { key: 'originality',    label: '原创', full: '原创性', feedbackKey: 'feedback_originality' },
  { key: 'flexibility',    label: '灵活', full: '灵活性', feedbackKey: 'feedback_flexibility' },
  { key: 'targetedness',   label: '针对', full: '针对性', feedbackKey: 'feedback_targetedness' },
  { key: 'logicality',     label: '逻辑', full: '逻辑性', feedbackKey: 'feedback_logicality' },
  { key: 'effectiveness',  label: '有效', full: '有效性', feedbackKey: 'feedback_effectiveness' },
  { key: 'clarity',        label: '清晰', full: '清晰度', feedbackKey: 'feedback_clarity' },
  { key: 'appeal',         label: '吸引', full: '吸引力', feedbackKey: 'feedback_appeal' },
];

const scoreColor = s => s >= 8 ? '#5a8f7a' : s >= 7 ? '#7d9b96' : '#c07a3a';

const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '1px solid rgba(200,184,154,0.6)', fontSize: '14px',
  color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
  outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  color: '#6b5c45', marginBottom: '6px', letterSpacing: '0.06em',
};

const btnBase = {
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: '6px',
  border: '1px solid rgba(200,184,154,0.6)',
};

function ScoreRow({ full, score, notes, index }) {
  const [open, setOpen] = useState(false);
  const pct = (score / 10) * 100;
  const color = scoreColor(score);
  return (
    <motion.div
      style={{ borderBottom: '1px solid rgba(217,205,181,0.4)' }}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 * index }}
    >
      <div style={{ padding: '12px 0', cursor: notes ? 'pointer' : 'default' }} onClick={() => notes && setOpen(o => !o)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
          <span style={{ fontSize: '13px', color: '#6b5c45', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {full}
            {notes && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            )}
          </span>
          <span style={{ fontSize: '16px', fontWeight: 700, color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {score.toFixed(1)}
          </span>
        </div>
        <div style={{ height: '3px', backgroundColor: 'rgba(217,205,181,0.5)', borderRadius: '2px' }}>
          <motion.div style={{ height: '100%', backgroundColor: color, borderRadius: '2px' }}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: 0.1 + index * 0.04, ease: 'easeOut' }} />
        </div>
      </div>
      <AnimatePresence>
        {open && notes && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <ul style={{ margin: 0, paddingLeft: '18px', paddingBottom: '12px', listStyleType: 'disc' }}>
              {(Array.isArray(notes) ? notes : [notes]).map((pt, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#6b5c45', lineHeight: 1.75, marginBottom: '4px', listStyleType: 'disc' }}>{pt}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ResultCard({ session, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scores = session.scores || {};
  const radarData = SCORE_META.map(m => ({ subject: m.label, score: scores[m.key] ?? 0, fullMark: 10 }));

  const avg = session.overall_average ?? 0;
  const date = new Date(session.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const displayLabel = session.justification?.note || session.position || '（无备注）';

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('review_sessions').delete().eq('id', session.id);
    if (error) { alert('删除失败：' + error.message); setDeleting(false); return; }
    onDelete(session.id);
  };

  return (
    <>
      {confirmDelete && (
        <ConfirmModal
          title="删除复盘记录"
          message="确定要删除这条复盘记录吗？此操作无法撤销。"
          confirmLabel="删除"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass-card"
      style={{ padding: '20px', marginBottom: '16px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#2C3025', marginBottom: '2px' }}>{displayLabel}</p>
          <p style={{ fontSize: '11px', color: '#9a8570' }}>{session.position} · {date}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ fontSize: '24px', fontWeight: 800, color: scoreColor(avg), fontVariantNumeric: 'tabular-nums' }}>
            {avg.toFixed(2)}
          </span>
          <button onClick={() => setConfirmDelete(true)} disabled={deleting} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(160,48,48,0.5)',
            padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <RadarChart data={radarData} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
          <PolarGrid stroke="rgba(217,205,181,0.4)" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6b5c45', fontFamily: 'inherit' }} />
          <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke="#5a8f7a" fill="#5a8f7a" fillOpacity={0.2} strokeWidth={1.5} />
        </RadarChart>
      </ResponsiveContainer>
    </motion.div>
    </>
  );
}

function HistoryPanel({ open, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('review_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setSessions(data || []);
        setLoading(false);
      });
  }, [open]);

  const handleDelete = (id) => setSessions(s => s.filter(r => r.id !== id));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '90vw',
              background: 'rgba(244,240,232,0.98)', backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(200,184,154,0.3)',
              zIndex: 201, overflowY: 'auto', padding: '28px 24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#2C3025', margin: 0 }}>复盘历史记录</h2>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', padding: '4px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {loading && (
              <p style={{ fontSize: '13px', color: '#9a8570', textAlign: 'center', padding: '32px 0' }}>加载中…</p>
            )}
            {!loading && sessions.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9a8570', textAlign: 'center', padding: '32px 0' }}>暂无历史记录</p>
            )}
            <AnimatePresence>
              {sessions.map(s => (
                <ResultCard key={s.id} session={s} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Review() {
  const [position, setPosition] = useState('');
  const [debateMotion, setDebateMotion] = useState('');
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [notePrompt, setNotePrompt] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const printRef = useRef(null);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { jobs, activeJobId, setActiveJobId, startJob, removeJob, updateJob } = useReviewJob();
  const { t } = useLanguage();
  const job = jobs.find(j => j.id === activeJobId) || null;
  const result = job?.status === 'done' ? job.result : null;
  const savedId = job?.savedId || null;
  // 任务的元信息（辩位/辩题）——从任务里取，避免用户切页后表单状态丢失
  const jobPosition = job?.meta?.position || position;
  const jobMotion = job?.meta?.motion || debateMotion;

  const handleAnalyze = async () => {
    if (!position) { setError('请选择辩手位置'); return; }
    if (!debateMotion.trim()) { setError('请输入辩题'); return; }
    if (!text.trim()) { setError('请输入发言内容'); return; }
    setError('');
    const { error: startError } = await startJob({ position, motion: debateMotion, text, context });
    if (startError) { setError(startError); return; }
    // 任务提交成功后清空表单，方便随时开始下一个复盘
    setPosition(''); setDebateMotion(''); setText(''); setContext('');
  };

  // 最小化：任务转入右上角悬浮卡片，回到发现页
  const handleMinimize = () => {
    setActiveJobId(null);
    navigate('/discover');
  };

  const handleSaveClick = () => {
    if (!result) return;
    setNoteDraft('');
    setNotePrompt(true);
  };

  const handleSave = async (note) => {
    if (!result) return;
    setNotePrompt(false);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const scores = {};
    SCORE_META.forEach(m => { scores[m.key] = result[m.key] ?? null; });
    const { data, error } = await supabase.from('review_sessions').insert({
      user_id: user.id,
      motion: jobMotion,
      position: jobPosition,
      overall_average: result.overall,
      scores,
      justification: {
        note: note.trim() || null,
        feedback_summary: result.feedback_summary,
        feedback_fluency: result.feedback_fluency,
        feedback_originality: result.feedback_originality,
        feedback_flexibility: result.feedback_flexibility,
        feedback_targetedness: result.feedback_targetedness,
        feedback_logicality: result.feedback_logicality,
        feedback_effectiveness: result.feedback_effectiveness,
        feedback_clarity: result.feedback_clarity,
        feedback_appeal: result.feedback_appeal,
        highlight_moment: result.highlight_moment,
        biggest_improvement: result.biggest_improvement,
        scored_by: result.scored_by,
      },
    }).select('id').single();

    setSaving(false);
    if (error) { alert('保存失败：' + error.message); return; }
    updateJob(job.id, { savedId: data.id });
  };

  const handleDelete = async () => {
    if (!savedId) return;
    await supabase.from('review_sessions').delete().eq('id', savedId);
    updateJob(job.id, { savedId: null });
  };

  const radarData = result
    ? SCORE_META.map(m => ({ subject: m.label, score: result[m.key] ?? 0, fullMark: 10 }))
    : [];

  // ── 任务界面（结果 / 错误；运行中的进度由全局 AnalysisOverlay 显示）──
  if (job && job.kind === 'review' && job.status !== 'running') {
    return (
      <>
      {notePrompt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(44,48,37,0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ width: '100%', maxWidth: '380px', background: '#F2EDE4', borderRadius: '16px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', margin: 0 }}>保存前请输入备注</h3>
            <p style={{ fontSize: '13px', color: '#7d6b55', margin: 0 }}>备注将作为历史记录中的显示标题（可留空）</p>
            <input
              autoFocus
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(noteDraft); if (e.key === 'Escape') setNotePrompt(false); }}
              placeholder="如：2026港辩决赛 反方三辩"
              maxLength={60}
              style={{ padding: '10px 14px', border: '1px solid rgba(200,184,154,0.6)', borderRadius: '8px', fontSize: '14px', color: '#2C3025', background: 'rgba(255,255,255,0.7)', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => handleSave(noteDraft)}
                style={{ flex: 1, padding: '10px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                保存
              </button>
              <button onClick={() => setNotePrompt(false)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '10px', fontSize: '13px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit' }}>
                取消
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* 顶栏：返回 + 最小化 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}
        >
          <button
            onClick={() => removeJob(job.id)}
            style={{ ...btnBase, background: 'none', color: '#6b5c45' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            {result ? '新的分析' : '取消'}
          </button>
          <button
            onClick={handleMinimize}
            style={{ ...btnBase, background: 'rgba(255,255,255,0.5)', color: '#6b5c45' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
              <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
            收起
          </button>
        </motion.div>

        {/* 错误视图 */}
        {job.status === 'error' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#a03030', marginBottom: '8px' }}>分析失败</p>
            <p style={{ fontSize: '13px', color: '#6b5c45', marginBottom: '24px' }}>{job.error}</p>
            <button onClick={() => removeJob(job.id)} style={{ ...btnBase, display: 'inline-flex', background: 'rgba(90,143,122,0.1)', color: '#5a8f7a', borderColor: 'rgba(90,143,122,0.35)' }}>
              返回重试
            </button>
          </motion.div>
        )}

        {/* 结果视图 */}
        {result && (
          <motion.div key="result" ref={printRef}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}>

            {result.mock && (
              <div style={{
                padding: '10px 16px', marginBottom: '16px',
                background: 'rgba(192,122,58,0.1)', border: '1px solid rgba(192,122,58,0.25)',
                borderRadius: '8px', fontSize: '12px', color: '#c07a3a',
              }}>
                ⚠️ 模拟模式：OpenRouter API Key 未配置，以下为示例数据
              </div>
            )}

            {savedId && (
              <div style={{
                padding: '10px 16px', marginBottom: '16px',
                background: 'rgba(90,143,122,0.1)', border: '1px solid rgba(90,143,122,0.25)',
                borderRadius: '8px', fontSize: '12px', color: '#5a8f7a',
              }}>
                ✓ 已保存到历史记录
              </div>
            )}

            {/* Overall score */}
            <div className="glass-card" style={{ padding: '28px 24px', marginBottom: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '8px' }}>综合评分</p>
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
                style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: scoreColor(result.overall) }}
              >
                {(result.overall ?? 0).toFixed(2)}
              </motion.div>
              <p style={{ fontSize: '12px', color: '#9a8570', margin: '4px 0 0' }}>{jobPosition}</p>
            </div>

            {/* Radar + scores */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 220px', minWidth: '180px' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                      <PolarGrid stroke="rgba(217,205,181,0.5)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b5c45', fontFamily: 'inherit' }} />
                      <Radar dataKey="score" stroke="#5a8f7a" fill="#5a8f7a" fillOpacity={0.25} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  {SCORE_META.map((m, i) => {
                    const score = result[m.key];
                    return (
                      <ScoreRow key={m.key} full={m.full} score={score ?? 0}
                        notes={result[m.feedbackKey]} index={i} />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary feedback */}
            {result.feedback_summary && (
              <div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '10px' }}>总体评价</p>
                <p style={{ fontSize: '13px', color: '#2C3025', lineHeight: 1.75, margin: 0 }}>{result.feedback_summary}</p>
              </div>
            )}

            {/* Highlight + Improvement */}
            {(result.highlight_moment || result.biggest_improvement) && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {result.highlight_moment && (
                  <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#5a8f7a', letterSpacing: '0.1em', marginBottom: '10px' }}>✦ 最亮眼时刻</p>
                    <p style={{ fontSize: '13px', color: '#2C3025', lineHeight: 1.7, margin: 0 }}>{result.highlight_moment}</p>
                  </div>
                )}
                {result.biggest_improvement && (
                  <div className="glass-card" style={{ padding: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#c07a3a', letterSpacing: '0.1em', marginBottom: '10px' }}>→ 最需改进</p>
                    <p style={{ fontSize: '13px', color: '#2C3025', lineHeight: 1.7, margin: 0 }}>{result.biggest_improvement}</p>
                  </div>
                )}
              </div>
            )}

            {result.extracted_preview && (
              <details style={{ marginBottom: '16px' }}>
                <summary style={{ fontSize: '12px', color: '#9a8570', cursor: 'pointer', padding: '8px 0' }}>
                  查看提取的发言片段预览
                </summary>
                <div className="glass-card" style={{ padding: '16px', marginTop: '8px' }}>
                  <p style={{ fontSize: '12px', color: '#6b5c45', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {result.extracted_preview}{result.extracted_preview.length >= 300 ? '…' : ''}
                  </p>
                </div>
              </details>
            )}

            {/* Action bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {savedId ? (
                <motion.button onClick={handleDelete} whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
                  style={{ ...btnBase, background: 'none', color: '#a03030', borderColor: 'rgba(160,48,48,0.3)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                  </svg>
                  删除记录
                </motion.button>
              ) : (
                <motion.button onClick={handleSaveClick} disabled={saving} whileHover={!saving ? { opacity: 0.8 } : {}} whileTap={!saving ? { scale: 0.97 } : {}}
                  style={{ ...btnBase, background: 'rgba(90,143,122,0.1)', color: '#5a8f7a', borderColor: 'rgba(90,143,122,0.35)', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  {saving ? '保存中…' : '保存'}
                </motion.button>
              )}
              <motion.button onClick={() => window.print()} whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
                style={{ ...btnBase, background: 'none', color: '#6b5c45' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                导出 PDF
              </motion.button>
            </div>
          </motion.div>
        )}

        <style>{`
          @media print {
            nav, button { display: none !important; }
            .glass-card { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
          }
        `}</style>
      </div>
      </>
    );
  }

  // ── 表单界面 ─────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#2C3025', marginBottom: '4px' }}>{t('review.title')}</h1>
          <p style={{ fontSize: '12px', color: '#9a8570', margin: 0 }}>所有分析与评分仅供参考。</p>
        </div>
        <motion.button
          onClick={() => setShowHistory(true)}
          whileHover={{ opacity: 0.8 }} whileTap={{ scale: 0.97 }}
          style={{
            ...btnBase, flexShrink: 0, marginTop: '4px',
            background: 'rgba(255,255,255,0.5)', color: '#6b5c45',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {t('review.history') ?? '历史记录'}
        </motion.button>
      </motion.div>

      {/* Form */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>辩手位置 *</label>
          <select value={position} onChange={e => setPosition(e.target.value)}
            style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
            <option value="">请选择…</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>辩题 *</label>
          <input type="text" value={debateMotion} onChange={e => setDebateMotion(e.target.value)}
            placeholder="" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>
            发言内容 *
          </label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="粘贴文字转录或稿件原文"
            rows={10} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>补充说明 <span style={{ fontWeight: 400, color: '#9a8570' }}>（可选）</span></label>
          <textarea value={context} onChange={e => setContext(e.target.value)}
            placeholder="详细提示词/问题"
            rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }} />
        </div>

        {error && <p style={{ fontSize: '13px', color: '#a03030', margin: '0 0 16px' }}>{error}</p>}

        <motion.button onClick={handleAnalyze}
          whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', padding: '12px',
            background: 'rgba(90,143,122,0.85)',
            border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, color: '#fff',
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em',
          }}
        >
          {t('review.start')}
        </motion.button>
      </div>

      <HistoryPanel open={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}
