import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MOCK_USER, MOCK_SESSIONS } from '../lib/mockData';
import { formatChineseDate } from '../lib/utils';

const scoreColor = s => s >= 8 ? '#5a8f7a' : s >= 7 ? '#7d9b96' : '#c07a3a';

/* Count-up using plain DOM — no framer hooks, no React state re-renders */
function AnimatedNumber({ value, decimals = 1, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = 0;
    const end = value;
    const duration = 1200;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = (start + (end - start) * eased).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(tick);
    }
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, decimals]);

  return (
    <span ref={ref} style={{ ...style, fontVariantNumeric: 'tabular-nums' }}>
      {value.toFixed(decimals)}
    </span>
  );
}

const spring = { type: 'spring', stiffness: 300, damping: 20 };
const tap = { type: 'spring', stiffness: 500, damping: 25 };

const cardHover = { y: -8, rotateX: 2, rotateY: 1, scale: 1.01, transition: spring };
const cardTap   = { scale: 0.97, transition: tap };

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 24 } },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const featured = MOCK_SESSIONS[0];
  const rest = MOCK_SESSIONS.slice(1);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px 80px' }}>
      <motion.div variants={container} initial="hidden" animate="show">

        {/* ── Header ──────────────────────────────── */}
        <motion.div variants={item} style={{
          paddingTop: '48px', paddingBottom: '32px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(200,184,154,0.4)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Watermark */}
          <div style={{
            position: 'absolute', right: '300px', top: '-20px',
            fontSize: '200px', fontWeight: 900,
            color: 'rgba(44,48,37,0.06)', filter: 'blur(1px)',
            lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
            letterSpacing: '-0.05em',
          }}>辩</div>

          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: '11px', color: '#9a8570', letterSpacing: '0.14em', marginBottom: '12px', fontWeight: 600 }}>
              辩论表现追踪
            </p>
            <h1 style={{
              fontSize: '48px', fontWeight: 800, color: '#2C3025',
              lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '14px',
              textShadow: '0 2px 12px rgba(44,48,37,0.08)',
            }}>
              你好，{MOCK_USER.name}
            </h1>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[MOCK_USER.school, MOCK_USER.region].map(t => (
                <span key={t} style={{
                  fontSize: '11px', color: '#6b5c45',
                  background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  padding: '4px 10px', borderRadius: '20px',
                  fontWeight: 600, letterSpacing: '0.04em',
                }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Stats glass mini-cards */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', perspective: '1000px' }}>
            {[
              { label: '综合均分', value: MOCK_USER.avg_score, decimals: 1, big: true },
              { label: '已分析',   value: MOCK_SESSIONS.length,   unit: '场', decimals: 0 },
              { label: '剩余点数', value: MOCK_USER.credits,       unit: '点', decimals: 0 },
            ].map(s => (
              <motion.div key={s.label} className="glass-card"
                style={{ padding: '14px 20px', textAlign: 'center', transformStyle: 'preserve-3d', minWidth: '88px' }}
                whileHover={{ y: -4, rotateX: 2, scale: 1.03, transition: spring }}
              >
                <p style={{ fontSize: '10px', color: '#9a8570', letterSpacing: '0.12em', fontWeight: 600, marginBottom: '6px' }}>
                  {s.label}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', justifyContent: 'center' }}>
                  <AnimatedNumber value={s.value} decimals={s.decimals} style={{
                    fontSize: s.big ? '44px' : '28px', fontWeight: 800,
                    color: s.big ? '#7d9b96' : '#2C3025', lineHeight: 1, letterSpacing: '-0.02em',
                  }} />
                  {s.unit && <span style={{ fontSize: '12px', color: '#9a8570', fontWeight: 400, marginLeft: '2px' }}>{s.unit}</span>}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Featured session — dark glass ───────── */}
        <motion.div variants={item} style={{ marginTop: '28px', perspective: '1000px' }}>
          <Link to={`/report/${featured.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <motion.div className="dark-glass-card"
              style={{ padding: '40px 44px', position: 'relative', overflow: 'hidden', cursor: 'pointer', transformStyle: 'preserve-3d' }}
              whileHover={cardHover} whileTap={cardTap}
            >
              {/* Score watermark */}
              <div style={{
                position: 'absolute', right: '40px', top: '-20px',
                fontSize: '200px', fontWeight: 900, color: 'rgba(164,185,181,0.06)',
                lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.05em',
              }}>{featured.avg_score.toFixed(1)}</div>

              {/* Left gradient accent */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: `linear-gradient(180deg, ${scoreColor(featured.avg_score)}, transparent)`,
                borderRadius: '16px 0 0 16px',
              }} />

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {['最近分析', featured.format, featured.role].map((tag, i) => (
                    <span key={tag} style={{
                      fontSize: '10px', padding: '4px 10px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.08em',
                      color:            i === 0 ? 'rgba(164,185,181,0.8)' : 'rgba(235,223,203,0.55)',
                      backgroundColor:  i === 0 ? 'rgba(164,185,181,0.15)' : 'rgba(235,223,203,0.08)',
                      border: `1px solid ${i === 0 ? 'rgba(164,185,181,0.2)' : 'rgba(235,223,203,0.1)'}`,
                    }}>{tag}</span>
                  ))}
                </div>
                <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#E8E4DC', lineHeight: 1.4, letterSpacing: '0.01em', maxWidth: '600px', marginBottom: '24px' }}>
                  {featured.motion}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '11px', color: 'rgba(235,223,203,0.35)', marginBottom: '8px', letterSpacing: '0.04em' }}>
                      {formatChineseDate(featured.date)}
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(235,223,203,0.55)', lineHeight: 1.7, maxWidth: '480px' }}>
                      {featured.feedback.slice(0, 60)}...
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '32px' }}>
                    <p style={{ fontSize: '10px', color: 'rgba(164,185,181,0.5)', letterSpacing: '0.1em', marginBottom: '4px' }}>综合评分</p>
                    <span style={{ fontSize: '64px', fontWeight: 900, color: scoreColor(featured.avg_score), lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                      {featured.avg_score.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Two-column layout ────────────────────── */}
        <motion.div variants={item} style={{ display: 'grid', gridTemplateColumns: '1fr 300px', marginTop: '28px' }}>

          {/* Session list */}
          <div style={{ borderRight: '1px solid rgba(200,184,154,0.35)', paddingRight: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '10px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.14em' }}>历史记录</h2>
              <Link to="/profile" style={{ fontSize: '11px', color: '#7d9b96', textDecoration: 'none', letterSpacing: '0.04em' }}>查看全部</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', perspective: '1000px' }}>
              {rest.map((s, i) => (
                <Link key={s.id} to={`/report/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <motion.div className="glass-card"
                    style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '4px 1fr auto', gap: '16px', alignItems: 'center', cursor: 'pointer', transformStyle: 'preserve-3d' }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 24, delay: i * 0.06 }}
                    whileHover={{ y: -4, scale: 1.01, transition: spring }}
                    whileTap={cardTap}
                  >
                    <div style={{ width: '4px', alignSelf: 'stretch', minHeight: '36px', backgroundColor: scoreColor(s.avg_score), borderRadius: '2px' }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#2C3025', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.motion}</p>
                      <p style={{ fontSize: '11px', color: '#9a8570', letterSpacing: '0.04em' }}>{s.format} · {s.role} · {formatChineseDate(s.date)}</p>
                    </div>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: scoreColor(s.avg_score), letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {s.avg_score.toFixed(1)}
                    </span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ paddingLeft: '40px' }}>
            <motion.button className="btn-shimmer"
              onClick={() => navigate('/upload')}
              whileHover={{ scale: 1.01 }} whileTap={cardTap}
              style={{
                width: '100%', padding: '18px',
                backgroundColor: '#2C3025', color: '#E8E4DC',
                border: 'none', fontSize: '13px', fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.12em',
                borderRadius: '12px',
              }}
            >
              开始新分析
            </motion.button>
            <p style={{ fontSize: '11px', color: '#c8b89a', textAlign: 'center', marginTop: '10px', marginBottom: '28px', letterSpacing: '0.02em' }}>
              每次分析消耗 1 点 · 剩余 {MOCK_USER.credits} 点
            </p>

            {/* Score trend */}
            <motion.div className="glass-card" style={{ padding: '20px', marginBottom: '16px' }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.3 }}
            >
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.14em', marginBottom: '16px' }}>近期评分趋势</p>
              {MOCK_SESSIONS.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '10px', color: '#c8b89a', fontWeight: 700, width: '16px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(217,205,181,0.6)', position: 'relative', borderRadius: '2px' }}>
                    <motion.div
                      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: scoreColor(s.avg_score), borderRadius: '2px' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.avg_score / 10) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.08, ease: 'easeOut' }}
                    />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: scoreColor(s.avg_score), width: '28px', textAlign: 'right', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                    {s.avg_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* Format tags */}
            <motion.div className="glass-card" style={{ padding: '20px' }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.4 }}
            >
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#9a8570', letterSpacing: '0.14em', marginBottom: '14px' }}>参加赛制</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {MOCK_USER.formats.map(f => (
                  <span key={f} style={{ fontSize: '11px', color: '#6b5c45', background: 'rgba(217,205,181,0.5)', border: '1px solid rgba(200,184,154,0.4)', padding: '5px 10px', borderRadius: '20px', fontWeight: 600, letterSpacing: '0.02em' }}>
                    {f}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
