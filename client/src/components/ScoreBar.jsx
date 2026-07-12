export default function ScoreBar({ label, score }) {
  const pct = (score / 10) * 100;
  const color = score >= 8 ? '#5a8f7a' : score >= 6 ? '#a4b9b5' : score >= 4 ? '#c07a3a' : '#a03030';

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#6b5c45', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color }}>
          {score.toFixed(1)} <span style={{ fontWeight: 400, color: '#9a8570' }}>分</span>
        </span>
      </div>
      <div style={{
        height: '4px',
        backgroundColor: '#d9cdb5', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: color,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
    </div>
  );
}
