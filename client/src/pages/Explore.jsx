import { useState } from 'react';
import { motion } from 'framer-motion';
import { MOCK_DEBATERS } from '../lib/mockData';

const ALL_REGIONS = ['全部地区', '香港', '大陆', '台湾'];
const ALL_FORMATS = ['全部赛制', '英国议会制 (BP)', '世锦赛制 (WSDC)', '亚洲议会制', '公共论坛制'];

const spring = { type: 'spring', stiffness: 300, damping: 20 };

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const itemVariant = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 24 } } };

const inputStyle = {
  width: '100%', padding: '8px 12px',
  border: '1px solid rgba(200,184,154,0.6)', fontSize: '13px',
  color: '#2C3025', backgroundColor: 'rgba(255,255,255,0.5)',
  outline: 'none', fontFamily: 'inherit', borderRadius: '8px',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  cursor: 'pointer',
};

export default function Explore() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('全部地区');
  const [format, setFormat] = useState('全部赛制');
  const [minScore, setMinScore] = useState(0);

  const filtered = MOCK_DEBATERS.filter(d => {
    if (search && !d.name.includes(search) && !d.school.includes(search)) return false;
    if (region !== '全部地区' && d.region !== region) return false;
    if (format !== '全部赛制' && !d.formats.includes(format)) return false;
    if (d.avg_score < minScore) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px 64px' }}>
      <motion.div initial="hidden" animate="show" variants={containerVariants}>

        <motion.div variants={itemVariant} style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.1em', marginBottom: '6px' }}>发现辩手</p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.04em' }}>辩手社区</h1>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#a4b9b5', marginTop: '10px', borderRadius: '1px' }} />
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Filter sidebar */}
          <motion.div variants={itemVariant} className="glass-card" style={{ padding: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.12em', marginBottom: '16px' }}>筛选</p>

            {[
              { label: '搜索', type: 'input', value: search, onChange: e => setSearch(e.target.value), placeholder: '姓名或学校', inputCursor: 'text' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', letterSpacing: '0.06em', marginBottom: '6px' }}>{f.label}</label>
                <input style={{ ...inputStyle, cursor: f.inputCursor }} placeholder={f.placeholder} value={f.value} onChange={f.onChange} />
              </div>
            ))}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', letterSpacing: '0.06em', marginBottom: '6px' }}>地区</label>
              <select style={inputStyle} value={region} onChange={e => setRegion(e.target.value)}>
                {ALL_REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', letterSpacing: '0.06em', marginBottom: '6px' }}>赛制</label>
              <select style={inputStyle} value={format} onChange={e => setFormat(e.target.value)}>
                {ALL_FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#9a8570', letterSpacing: '0.06em', marginBottom: '6px' }}>
                最低均分：{minScore > 0 ? `${minScore.toFixed(0)} 分` : '不限'}
              </label>
              <input type="range" min={0} max={9} step={1} value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ width: '100%', accentColor: '#7d9b96' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9a8570', marginTop: '2px' }}>
                <span>不限</span><span>9+</span>
              </div>
            </div>

            <motion.button
              onClick={() => { setSearch(''); setRegion('全部地区'); setFormat('全部赛制'); setMinScore(0); }}
              whileTap={{ scale: 0.97 }}
              style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid rgba(200,184,154,0.6)', fontSize: '12px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', borderRadius: '8px' }}
            >
              重置筛选
            </motion.button>
          </motion.div>

          {/* Cards */}
          <motion.div variants={itemVariant}>
            <p style={{ fontSize: '12px', color: '#9a8570', letterSpacing: '0.04em', marginBottom: '16px' }}>
              共找到 <strong style={{ color: '#2C3025' }}>{filtered.length}</strong> 名辩手
            </p>
            {filtered.length === 0 ? (
              <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#9a8570', letterSpacing: '0.04em' }}>没有找到符合条件的辩手</p>
                <p style={{ fontSize: '12px', color: '#c8b89a', marginTop: '6px' }}>试着调整筛选条件</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', perspective: '1000px' }}>
                {filtered.map((d, i) => <DebaterCard key={d.id} debater={d} index={i} />)}
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function DebaterCard({ debater: d, index }) {
  const scoreColor = d.avg_score >= 8.5 ? '#5a8f7a' : d.avg_score >= 7.5 ? '#7d9b96' : '#9a8570';
  return (
    <motion.div className="glass-card"
      style={{ padding: '20px', cursor: 'pointer', transformStyle: 'preserve-3d' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, delay: index * 0.04 }}
      whileHover={{ y: -8, rotateX: 2, rotateY: 1, scale: 1.01, transition: spring }}
      whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 500, damping: 25 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ width: '40px', height: '40px', flexShrink: 0, backgroundColor: '#2C3025', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8E4DC', fontSize: '14px', fontWeight: 700 }}>
          {d.name.slice(0, 1)}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.04em' }}>{d.name}</p>
          <p style={{ fontSize: '11px', color: '#9a8570', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.school}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', borderTop: '1px solid rgba(217,205,181,0.5)', paddingTop: '12px', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '26px', fontWeight: 700, color: scoreColor, fontVariantNumeric: 'tabular-nums' }}>{d.avg_score.toFixed(1)}</span>
          <span style={{ fontSize: '11px', color: '#9a8570', marginLeft: '4px' }}>均分</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#7d9b96', fontVariantNumeric: 'tabular-nums' }}>{d.session_count}</span>
          <span style={{ fontSize: '11px', color: '#9a8570', marginLeft: '4px' }}>场</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: '#5a8f7a', background: 'rgba(90,143,122,0.1)', border: '1px solid rgba(90,143,122,0.2)', padding: '2px 10px', borderRadius: '20px', display: 'inline-block', width: 'fit-content' }}>
          {d.region}
        </span>
        {d.formats.slice(0, 2).map(f => (
          <span key={f} style={{ fontSize: '10px', color: '#9a8570', letterSpacing: '0.02em' }}>· {f}</span>
        ))}
      </div>
    </motion.div>
  );
}
