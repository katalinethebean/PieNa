import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useReviewJob } from '../contexts/ReviewJobContext';
import { useLanguage } from '../contexts/LanguageContext';

const btnBase = {
  padding: '9px 16px', borderRadius: '8px', fontSize: '13px',
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', gap: '6px',
  border: '1px solid rgba(200,184,154,0.6)',
};

// 统一的全屏分析进度界面（复盘 + 比赛分析共用）。
// 挂在 App 层：当前查看的任务在运行时铺满全屏；
// 收起后转为右上角悬浮卡片（ReviewJobWidget）。
export default function AnalysisOverlay() {
  const { t } = useLanguage();
  const { jobs, activeJobId, setActiveJobId, removeJob } = useReviewJob();
  const navigate = useNavigate();

  const job = jobs.find(j => j.id === activeJobId) || null;
  const running = job?.status === 'running';
  // 比赛分析在完成且保存出记录之前（正在写库）也停留在进度界面
  const matchSaving = job?.kind === 'match' && job?.status === 'done' && !job.reportId;
  const show = job && (running || matchSaving);

  // 任务完成后自动跳转：比赛分析 → 报告页；复盘 → 复盘页看结果
  useEffect(() => {
    if (!job) return;
    if (job.kind === 'match' && job.status === 'done' && job.reportId) {
      const id = job.reportId;
      removeJob(job.id);
      navigate(`/report/${id}`);
    }
    if (job.kind === 'review' && job.status === 'done') {
      navigate('/review');
    }
    if (job.status === 'error' && job.kind === 'review') {
      navigate('/review');
    }
  }, [job, navigate, removeJob]);

  const handleMinimize = () => {
    setActiveJobId(null);
    navigate('/discover');
  };

  const handleCancel = () => {
    removeJob(job.id);
  };

  // 比赛分析出错时，覆盖层直接显示错误（比赛分析没有独立结果页兜底）
  const matchError = job?.kind === 'match' && job?.status === 'error';

  return (
    <AnimatePresence>
      {(show || matchError) && (
        <motion.div
          key="analysis-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 250,
            background: 'rgba(232,228,220,0.96)', backdropFilter: 'blur(16px)',
            overflowY: 'auto',
          }}
        >
          <div style={{ maxWidth: '720px', margin: '0 auto', padding: '92px 20px 80px' }}>
            {/* 顶栏 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <button onClick={handleCancel} style={{ ...btnBase, background: 'none', color: '#6b5c45' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                </svg>
                {t('common.cancel')}
              </button>
              {!matchError && (
                <button onClick={handleMinimize} style={{ ...btnBase, background: 'rgba(255,255,255,0.5)', color: '#6b5c45' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                    <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
                  </svg>
                  {t('overlay.minimize')}
                </button>
              )}
            </div>

            {matchError ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#a03030', marginBottom: '8px' }}>{t('job.failed')}</p>
                <p style={{ fontSize: '13px', color: '#6b5c45', marginBottom: '24px' }}>{job.error}</p>
                <button onClick={handleCancel} style={{ ...btnBase, display: 'inline-flex', background: 'rgba(90,143,122,0.1)', color: '#5a8f7a', borderColor: 'rgba(90,143,122,0.35)' }}>
                  {t('overlay.retry')}
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                className="glass-card" style={{ padding: '48px 36px', textAlign: 'center' }}
              >
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  {job.kind === 'match' ? t('job.match_running') : t('job.review_running')}
                </p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#2C3025', marginBottom: '36px' }}>
                  {job.meta?.motion} · {job.meta?.position}
                </p>

                {/* 滑轨进度条 */}
                <div style={{ maxWidth: '440px', margin: '0 auto 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#9a8570' }}>{matchSaving ? t('overlay.saving_match') : job.stage}</span>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#5a8f7a', fontVariantNumeric: 'tabular-nums' }}>
                      {job.progress}%
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: '8px', backgroundColor: 'rgba(217,205,181,0.5)', borderRadius: '5px' }}>
                    <motion.div
                      style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        backgroundColor: '#5a8f7a', borderRadius: '5px',
                      }}
                      animate={{ width: `${job.progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                    <motion.div
                      style={{
                        position: 'absolute', top: '50%', marginTop: '-8px', marginLeft: '-8px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        backgroundColor: '#fff', border: '3px solid #5a8f7a',
                        boxShadow: '0 2px 8px rgba(44,48,37,0.2)',
                      }}
                      animate={{ left: `${job.progress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#9a8570', marginTop: '28px' }}>
                  {t('overlay.hint')}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
