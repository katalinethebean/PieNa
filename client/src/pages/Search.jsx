import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MOCK_DEBATERS } from '../lib/mockData';

const ALL_REGIONS = ['全部地区', '香港', '大陆', '台湾'];
const ALL_FORMATS = ['全部赛制', '英国议会制 (BP)', '世锦赛制 (WSDC)', '亚洲议会制', '公共论坛制'];

const scoreColor = s => s >= 8 ? '#5a8f7a' : s >= 7 ? '#7d9b96' : '#c07a3a';
const spring = { type: 'spring', stiffness: 300, damping: 20 };

const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 24 } } };
const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

function DebaterCard({ debater: d }) {
  const color = scoreColor(d.avg_score);
  return (
    <Link to={`/profile/${d.id}`} style={{ textDecoration: 'none' }}>
      <motion.div className="glass-card"
        style={{ padding: '22px', cursor: 'pointer', transformStyle: 'preserve-3d' }}
        variants={item}
        whileHover={{ y: -6, rotateX: 1.5, rotateY: 1, scale: 1.01, transition: spring }}
        whileTap={{ scale: 0.97 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
            background: '#2C3025', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#E8E4DC', fontSize: '18px', fontWeight: 700,
          }}>
            {d.name.slice(0, 1)}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '16px', fontWeight: 700, color: '#2C3025', marginBottom: '2px' }}>{d.name}</p>
            <p style={{ fontSize: '12px', color: '#9a8570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.school}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px solid rgba(217,205,181,0.5)', paddingTop: '14px', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '30px', fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {d.avg_score.toFixed(1)}
            </span>
            <span style={{ fontSize: '12px', color: '#9a8570', marginLeft: '4px' }}>均分</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#7d9b96', fontVariantNumeric: 'tabular-nums' }}>{d.session_count}</span>
            <span style={{ fontSize: '12px', color: '#9a8570', marginLeft: '3px' }}>场</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          <span style={{ fontSize: '11px', color: '#5a8f7a', background: 'rgba(90,143,122,0.1)', border: '1px solid rgba(90,143,122,0.2)', padding: '2px 10px', borderRadius: '20px' }}>
            {d.region}
          </span>
          {d.formats.slice(0, 2).map(f => (
            <span key={f} style={{ fontSize: '10px', color: '#9a8570', background: 'rgba(217,205,181,0.4)', border: '1px solid rgba(200,184,154,0.3)', padding: '2px 8px', borderRadius: '20px' }}>
              {f}
            </span>
          ))}
        </div>
      </motion.div>
    </Link>
  );
}

export default function Search() {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState('全部地区');
  const [format, setFormat] = useState('全部赛制');
  const [minScore, setMinScore] = useState(0);

  const filtered = MOCK_DEBATERS.filter(d => {
    if (q && !d.name.includes(q) && !d.school.includes(q)) return false;
    if (region !== '全部地区' && d.region !== region) return false;
    if (format !== '全部赛制' && !d.formats.includes(format)) return false;
    if (d.avg_score < minScore) return false;
    return true;
  });

  const inputStyle = {
    width: '100%', padding: '9px 14px', border: '1px solid rgba(200,184,154,0.5)',
    fontSize: '13px', color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
    outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 80px' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        style={{ marginBottom: '32px' }}>
        <p style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.1em', marginBottom: '6px' }}>辩手社区</p>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.02em', marginBottom: '6px' }}>寻找辩手</h1>
        <div style={{ width: '32px', height: '2px', background: '#a4b9b5', borderRadius: '1px' }} />
      </motion.div>

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 }}
        className="glass-card" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9a8570" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="搜索姓名或学校…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select style={{ ...inputStyle, flex: '0 0 140px', cursor: 'pointer' }} value={region} onChange={e => setRegion(e.target.value)}>
          {ALL_REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select style={{ ...inputStyle, flex: '0 0 180px', cursor: 'pointer' }} value={format} onChange={e => setFormat(e.target.value)}>
          {ALL_FORMATS.map(f => <option key={f}>{f}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 180px' }}>
          <span style={{ fontSize: '12px', color: '#9a8570', whiteSpace: 'nowrap' }}>
            均分 ≥ {minScore > 0 ? `${minScore}` : '不限'}
          </span>
          <input type="range" min={0} max={9} step={1} value={minScore} onChange={e => setMinScore(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#7d9b96' }} />
        </div>
        {(q || region !== '全部地区' || format !== '全部赛制' || minScore > 0) && (
          <button onClick={() => { setQ(''); setRegion('全部地区'); setFormat('全部赛制'); setMinScore(0); }}
            style={{ background: 'none', border: '1px solid rgba(200,184,154,0.5)', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            重置
          </button>
        )}
      </motion.div>

      <p style={{ fontSize: '12px', color: '#9a8570', marginBottom: '16px', letterSpacing: '0.03em' }}>
        共找到 <strong style={{ color: '#2C3025' }}>{filtered.length}</strong> 名辩手
      </p>

      {filtered.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', color: '#9a8570' }}>没有找到符合条件的辩手</p>
          <p style={{ fontSize: '13px', color: '#c8b89a', marginTop: '8px' }}>试着调整筛选条件</p>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', perspective: '1000px' }}>
          {filtered.map(d => <DebaterCard key={d.id} debater={d} />)}
        </motion.div>
      )}
    </div>
  );
}
