import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';

const BOARDS = [
  { key: '1', label: '一辩榜' },
  { key: '2', label: '二辩榜' },
  { key: '3', label: '三辩榜' },
  { key: '4', label: '四辩榜' },
  { key: 'overall', label: '全能榜' },
];

function formatRank(rank) {
  if (rank == null) return '-';
  return rank > 50 ? '50+' : rank;
}

function Column({ label, rows, self, isLast }) {
  const selfRank = self?.rank;
  const selfPoints = self?.points ?? 0;

  return (
    <div style={{
      flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column',
      borderRight: isLast ? 'none' : '1px solid rgba(217,205,181,0.4)',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(217,205,181,0.4)', flexShrink: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#2C3025', letterSpacing: '0.04em' }}>{label}</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#9a8570', textAlign: 'center', padding: '32px 12px' }}>暂无排名数据</p>
        ) : (
          rows.map((r, i) => (
            <Link key={r.id} to={`/profile/${r.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderBottom: i < rows.length - 1 ? '1px solid rgba(217,205,181,0.25)' : 'none' }}>
                <span style={{ width: '18px', fontSize: '12px', fontWeight: 700, color: i < 3 ? '#c07a3a' : '#9a8570', flexShrink: 0, textAlign: 'center' }}>
                  {i + 1}
                </span>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#7d9b96', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2C3025', fontSize: '11px', fontWeight: 700, overflow: 'hidden', flexShrink: 0 }}>
                  {r.avatar_url
                    ? <img src={r.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (r.name || '?').slice(0, 1)
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#2C3025', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</p>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#5a8f7a', flexShrink: 0 }}>{r.points}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(200,184,154,0.5)', background: 'rgba(217,205,181,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#c07a3a', flexShrink: 0, minWidth: '18px' }}>{formatRank(selfRank)}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#2C3025', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{self?.name || '我'}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#2C3025', flexShrink: 0 }}>{selfPoints}</span>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [boards, setBoards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.rpc('get_leaderboards').then(({ data, error: rpcError }) => {
      if (rpcError) { setError('排行榜加载失败，请稍后重试'); setLoading(false); return; }
      setBoards(data || {});
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <p style={{ fontSize: '13px', color: '#9a8570', textAlign: 'center', padding: '80px 0' }}>加载中…</p>;
  }
  if (error) {
    return <p style={{ fontSize: '13px', color: '#a03030', textAlign: 'center', padding: '80px 0' }}>{error}</p>;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100dvh - 60px)', width: '100%', overflow: 'hidden' }}>
      {BOARDS.map((b, i) => (
        <Column
          key={b.key}
          label={b.label}
          rows={boards?.[b.key] || []}
          self={boards?.self ? { name: boards.self.name, ...boards.self[b.key] } : null}
          isLast={i === BOARDS.length - 1}
        />
      ))}
    </div>
  );
}
