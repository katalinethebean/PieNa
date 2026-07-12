import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useReviewJob } from '../contexts/ReviewJobContext';

// 右上角悬浮的复盘分析进度卡片，支持多个任务并行（纵向堆叠）。
// 当前正在 /review 页全屏查看的任务不显示卡片。
export default function ReviewJobWidget() {
  const { jobs, activeJobId, setActiveJobId, removeJob } = useReviewJob();
  const navigate = useNavigate();
  const location = useLocation();

  const onReviewPage = location.pathname === '/review';
  // 正在全屏查看的任务不显示卡片（运行中由 AnalysisOverlay 全屏接管）
  const cards = jobs.filter(j => !(j.id === activeJobId && (j.status === 'running' || onReviewPage)));
  if (cards.length === 0) return null;

  const expand = (job) => {
    if (job.kind === 'match' && job.status === 'done' && job.reportId) {
      const id = job.reportId;
      removeJob(job.id);
      navigate(`/report/${id}`);
      return;
    }
    setActiveJobId(job.id);
    if (job.kind === 'review' && job.status === 'done' && !onReviewPage) navigate('/review');
  };

  return (
    <div style={{
      position: 'fixed', top: '72px', right: '16px', zIndex: 300,
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <AnimatePresence>
        {cards.map(job => {
          const done = job.status === 'done';
          const failed = job.status === 'error';
          const color = failed ? '#a03030' : done ? '#5a8f7a' : '#c07a3a';
          return (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              style={{
                width: '260px', padding: '14px 16px',
                background: 'rgba(244,240,232,0.97)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(200,184,154,0.5)', borderRadius: '14px',
                boxShadow: '0 8px 32px rgba(44,48,37,0.14)',
                cursor: 'pointer',
              }}
              onClick={() => expand(job)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#2C3025', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {!done && !failed && (
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color,
                      animation: 'reviewJobPulse 1.2s ease-in-out infinite', flexShrink: 0,
                    }} />
                  )}
                  {done ? '✓ 分析完成' : failed ? '分析失败' : job.kind === 'match' ? '比赛分析中' : '复盘分析中'}
                </span>
                {(done || failed) && (
                  <button
                    onClick={e => { e.stopPropagation(); removeJob(job.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', padding: '2px', lineHeight: 0 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>

              <p style={{
                fontSize: '11px', color: '#6b5c45', margin: '0 0 8px', fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {job.meta?.motion} · {job.meta?.position}
              </p>

              {!failed && (
                <>
                  <div style={{ height: '5px', backgroundColor: 'rgba(217,205,181,0.5)', borderRadius: '3px', marginBottom: '6px' }}>
                    <motion.div
                      style={{ height: '100%', backgroundColor: color, borderRadius: '3px' }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '10px', color: '#9a8570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                      {done ? '点击查看结果' : job.stage}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                      {job.progress}%
                    </span>
                  </div>
                </>
              )}
              {failed && (
                <p style={{ fontSize: '11px', color: '#a03030', margin: 0, lineHeight: 1.5 }}>{job.error}</p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <style>{`@keyframes reviewJobPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}
