import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useUser } from '../contexts/UserContext';
import { formatChineseDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import EditMatchModal from '../components/EditMatchModal';
import { useIsMobile } from '../lib/useIsMobile';

// DEFINED 8-dimension creativity rubric (current)
const SCORE_LABELS = [
  { key: 'fluency_score',       labelKey: 'score.fluency', fullKey: 'score.fluency_full', feedbackKey: 'feedback_fluency' },
  { key: 'originality_score',   labelKey: 'score.originality', fullKey: 'score.originality_full', feedbackKey: 'feedback_originality' },
  { key: 'flexibility_score',   labelKey: 'score.flexibility', fullKey: 'score.flexibility_full', feedbackKey: 'feedback_flexibility' },
  { key: 'targetedness_score',  labelKey: 'score.targetedness', fullKey: 'score.targetedness_full', feedbackKey: 'feedback_targetedness' },
  { key: 'logicality_score',    labelKey: 'score.logicality', fullKey: 'score.logicality_full', feedbackKey: 'feedback_logicality' },
  { key: 'effectiveness_score', labelKey: 'score.effectiveness', fullKey: 'score.effectiveness_full', feedbackKey: 'feedback_effectiveness' },
  { key: 'clarity_score',       labelKey: 'score.clarity', fullKey: 'score.clarity_full', feedbackKey: 'feedback_clarity' },
  { key: 'appeal_score',        labelKey: 'score.appeal', fullKey: 'score.appeal_full', feedbackKey: 'feedback_appeal' },
];

// Sessions from the previous 6-dim rubric
const MID_SCORE_LABELS = [
  { key: 'logic_score',         labelKey: 'report.logic', fullKey: 'report.logic', feedbackKey: 'feedback_logic' },
  { key: 'rebuttal_score',      labelKey: 'rubric.rebuttal', fullKey: 'rubric.rebuttal', feedbackKey: 'feedback_rebuttal' },
  { key: 'argumentation_score', labelKey: 'report.argumentation', fullKey: 'report.argumentation', feedbackKey: 'feedback_argumentation' },
  { key: 'delivery_score',      labelKey: 'rubric.delivery', fullKey: 'rubric.delivery', feedbackKey: 'feedback_delivery' },
  { key: 'teamwork_score',      labelKey: 'report.teamwork', fullKey: 'report.teamwork', feedbackKey: 'feedback_teamwork' },
  { key: 'evidence_score',      labelKey: 'rubric.evidence', fullKey: 'rubric.evidence', feedbackKey: 'feedback_evidence' },
];

// Sessions analyzed before the rubric change only have these columns (see CLAUDE.md:
// two rubrics coexist in the sessions table); fall back to them so old reports
// don't render all-zero scores.
const OLD_SCORE_LABELS = [
  { key: 'argument_score',  labelKey: 'rubric.argument', fullKey: 'rubric.argument_full' },
  { key: 'delivery_score',  labelKey: 'rubric.delivery', fullKey: 'rubric.delivery_full' },
  { key: 'rebuttal_score',  labelKey: 'rubric.rebuttal', fullKey: 'rubric.rebuttal_full' },
  { key: 'structure_score', labelKey: 'rubric.structure', fullKey: 'rubric.structure_full' },
  { key: 'evidence_score',  labelKey: 'rubric.evidence', fullKey: 'rubric.evidence_full' },
  { key: 'fluency_score',   labelKey: 'rubric.fluency', fullKey: 'rubric.fluency_full' },
];

const scoreColor = s => s >= 8 ? '#5a8f7a' : s >= 7 ? '#7d9b96' : '#c07a3a';

function AnimatedNumber({ value, decimals = 1, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const duration = 1000;
    const startTime = performance.now();
    function tick(now) {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (value * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    }
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);
  return <span ref={ref} style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(decimals)}</span>;
}

function ScoreRow({ full, score, notes, index }) {
  const [open, setOpen] = useState(false);
  const s = score ?? 0;
  const pct = (s / 10) * 100;
  const color = scoreColor(s);
  const hasBullets = Array.isArray(notes) ? notes.length > 0 : !!notes;
  return (
    <motion.div
      style={{ borderBottom: '1px solid rgba(217,205,181,0.4)' }}
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 * index }}
    >
      <div
        style={{ padding: '11px 0', cursor: hasBullets ? 'pointer' : 'default' }}
        onClick={() => hasBullets && setOpen(o => !o)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
          <span style={{ fontSize: '13px', color: '#6b5c45', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {full}
            {hasBullets && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ opacity: 0.45, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            )}
          </span>
          <span style={{ fontSize: '15px', fontWeight: 700, color, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
            {s.toFixed(1)}
          </span>
        </div>
        <div style={{ height: '3px', backgroundColor: 'rgba(217,205,181,0.5)', borderRadius: '2px' }}>
          <motion.div
            style={{ height: '100%', backgroundColor: color, borderRadius: '2px' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: 0.1 + index * 0.04, ease: 'easeOut' }}
          />
        </div>
      </div>
      <AnimatePresence>
        {open && hasBullets && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}
          >
            <ul style={{ margin: 0, paddingLeft: '18px', paddingBottom: '12px', listStyleType: 'disc' }}>
              {(Array.isArray(notes) ? notes : [notes]).map((pt, i) => (
                <li key={i} style={{ fontSize: '12px', color: '#6b5c45', lineHeight: 1.75, marginBottom: '3px', listStyleType: 'disc' }}>{pt}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const itemVariant = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 210, damping: 26 } } };

export default function Report() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sessions, updateSession, removeSession } = useUser();
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMobile = useIsMobile();
  const s = sessions.find(session => session.id === id);

  if (!s) {
    return (
      <div style={{ maxWidth: '640px', margin: '80px auto', padding: '24px', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '48px 36px' }}>
          <h1 style={{ fontSize: '22px', color: '#2C3025', marginBottom: '8px' }}>{t('report.not_found_title')}</h1>
          <p style={{ fontSize: '13px', color: '#9a8570', lineHeight: 1.7, marginBottom: '24px' }}>{t('report.not_found_desc')}</p>
          <Link to="/me" style={{ color: '#7d9b96', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>{t('report.back_to_profile')}</Link>
        </div>
      </div>
    );
  }

  const hasAnalysis = Number.isFinite(s.avg_score);
  const j = s.justification || {};
  // Pick the rubric era this session was scored under, testing keys unique to
  // each era (fluency/delivery/rebuttal/evidence are shared across rubrics).
  const usesDefined = ['originality_score', 'flexibility_score', 'targetedness_score', 'logicality_score'].some(k => s[k] != null);
  const usesMidRubric = !usesDefined && ['logic_score', 'argumentation_score', 'teamwork_score'].some(k => s[k] != null);
  const usesOldRubric = !usesDefined && !usesMidRubric && ['argument_score', 'structure_score'].some(k => s[k] != null);
  const scoreLabels = (usesMidRubric ? MID_SCORE_LABELS : usesOldRubric ? OLD_SCORE_LABELS : SCORE_LABELS)
    .map(m => ({ ...m, label: t(m.labelKey), full: t(m.fullKey) }));
  const radarData = scoreLabels.map(({ key, label }) => ({ subject: label, score: s[key] ?? 0, fullMark: 10 }));
  const debaters = (s.debaters || []).filter(Boolean);
  const won = s.won;
  const resultColor = won === true ? '#5a8f7a' : won === false ? '#a03030' : '#9a8570';

  const pillStyle = {
    fontSize: '11px', color: '#6b5c45', background: 'rgba(255,255,255,0.55)',
    border: '1px solid rgba(200,184,154,0.4)', padding: '4px 12px', borderRadius: '20px',
    letterSpacing: '0.04em', fontWeight: 500,
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px 80px' }}>
      <AnimatePresence>
        {editing && (
          <EditMatchModal
            key="edit-match"
            session={s}
            onClose={() => setEditing(false)}
            onSaved={(patch) => { updateSession(s.id, patch); setEditing(false); }}
          />
        )}
        {deleting && (
          <ConfirmModal
            key="delete-match"
            title={t('report.delete')}
            message={t('report.delete_confirm')}
            confirmLabel={t('common.delete')}
            danger
            onCancel={() => setDeleting(false)}
            onConfirm={async () => {
              await supabase.from('sessions').delete().eq('id', s.id);
              removeSession(s.id);
              setDeleting(false);
              navigate('/me');
            }}
          />
        )}
      </AnimatePresence>

      <motion.div initial="hidden" animate="show" variants={containerVariants}>

        {/* Top bar */}
        <motion.div variants={itemVariant} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '40px', marginBottom: '24px' }}>
          <Link to="/me" style={{ fontSize: '11px', color: '#9a8570', textDecoration: 'none', letterSpacing: '0.08em', fontWeight: 600 }}>
            ← {t('report.back_to_profile')}
          </Link>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {t('report.edit')}
            </button>
            <button onClick={() => setDeleting(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', color: '#a03030', fontSize: '12px', fontFamily: 'inherit', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
              {t('common.delete')}
            </button>
          </div>
        </motion.div>

        {/* Motion + pills */}
        <motion.div variants={itemVariant} style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2C3025', lineHeight: 1.45, letterSpacing: '0.01em', marginBottom: '14px' }}>{s.motion}</h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {s.tournament && <span style={pillStyle}>{s.tournament}</span>}
            {s.side && <span style={pillStyle}>{s.side}</span>}
            {formatChineseDate(s.date) && <span style={pillStyle}>{formatChineseDate(s.date)}</span>}
            {s.score && (
              <span style={{ ...pillStyle, color: resultColor, borderColor: won === true ? 'rgba(90,143,122,0.35)' : won === false ? 'rgba(160,48,48,0.3)' : pillStyle.border, fontWeight: 700 }}>
                {won === true ? t('profile.won') + ' ' : won === false ? t('profile.lost') + ' ' : ''}{s.score}
              </span>
            )}
          </div>
        </motion.div>

        {/* Overall score (if analysis exists) */}
        {hasAnalysis && (
          <motion.div variants={itemVariant} style={{ marginBottom: '20px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <AnimatedNumber value={s.avg_score} decimals={1} style={{ fontSize: '44px', fontWeight: 800, color: scoreColor(s.avg_score), lineHeight: 1, letterSpacing: '-0.02em' }} />
            <span style={{ fontSize: '13px', color: '#9a8570' }}>/ 10 {t('report.overall_score')}</span>
          </motion.div>
        )}

        {/* Two-column: left = debaters + notes, right = radar + score rows */}
        {hasAnalysis ? (
          <motion.div variants={itemVariant} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap: '16px', marginBottom: '16px', alignItems: 'start' }}>
            {/* Left: debaters + notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {debaters.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '12px' }}>{t('report.debaters')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {debaters.map((d, i) => {
                      const isMvp = s.mvp_flags?.[s.debaters.indexOf(d)];
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px',
                          borderRadius: '8px', background: isMvp ? 'rgba(192,122,58,0.08)' : 'rgba(255,255,255,0.4)',
                          border: `1px solid ${isMvp ? 'rgba(192,122,58,0.3)' : 'rgba(200,184,154,0.3)'}`,
                        }}>
                          <span style={{ fontSize: '13px', color: '#2C3025', fontWeight: isMvp ? 700 : 500 }}>{d.replace(/\s*(（[^）]+）|\([^)]+\))\s*$/, '')}</span>
                          {isMvp && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#c07a3a', fontWeight: 700 }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="#c07a3a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                              {t('report.mvp')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {s.notes && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '10px' }}>{t('report.notes_label')}</p>
                  <p style={{ fontSize: '13px', color: '#6b5c45', lineHeight: '1.8', margin: 0 }}>{s.notes}</p>
                </div>
              )}
            </div>

            {/* Right: radar + score rows */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                  <PolarGrid stroke="rgba(164,185,181,0.35)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b5c45', fontSize: 11, fontFamily: 'inherit' }} />
                  <PolarRadiusAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="#7d9b96" fill="#a4b9b5" fillOpacity={0.3} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '8px' }}>
                {scoreLabels.map(({ key, full, feedbackKey }, i) => (
                  <ScoreRow
                    key={key}
                    full={full}
                    score={s[key] ?? 0}
                    notes={j[feedbackKey]}
                    index={i}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* No analysis — just show debaters + notes normally */
          <>
            {debaters.length > 0 && (
              <motion.div variants={itemVariant} style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '12px' }}>{t('report.debaters')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {debaters.map((d, i) => {
                    const isMvp = s.mvp_flags?.[s.debaters.indexOf(d)];
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                        borderRadius: '10px', background: isMvp ? 'rgba(192,122,58,0.08)' : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${isMvp ? 'rgba(192,122,58,0.3)' : 'rgba(200,184,154,0.3)'}`,
                      }}>
                        <span style={{ fontSize: '13px', color: '#2C3025', fontWeight: isMvp ? 700 : 500 }}>{d.replace(/\s*(（[^）]+）|\([^)]+\))\s*$/, '')}</span>
                        {isMvp && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#c07a3a', fontWeight: 700 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#c07a3a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            {t('report.mvp')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
            {s.notes && (
              <motion.div variants={itemVariant}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.1em', marginBottom: '10px' }}>{t('report.notes_label')}</p>
                <p style={{ fontSize: '13px', color: '#6b5c45', lineHeight: '1.8', margin: 0 }}>{s.notes}</p>
              </motion.div>
            )}
          </>
        )}

        {/* AI 总结（旧版分析只有 feedback 字段，没有 justification.match_summary） */}
        {hasAnalysis && (j.match_summary || s.feedback) && (
          <motion.div variants={itemVariant} className="dark-glass-card" style={{ padding: '24px 28px', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#a4b9b5', letterSpacing: '0.14em', marginBottom: '14px' }}>{t('report.analysis')}</p>
            <p style={{ fontSize: '13px', color: 'rgba(235,223,203,0.85)', lineHeight: '1.9', letterSpacing: '0.02em', margin: 0, whiteSpace: 'pre-wrap' }}>
              {j.match_summary || s.feedback}
            </p>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}
