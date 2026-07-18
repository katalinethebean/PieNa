import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFriend } from '../contexts/FriendContext';
import { useUser } from '../contexts/UserContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import { useIsMobile, MOBILE_FULL_HEIGHT } from '../lib/useIsMobile';

const W = 920, H = 560;
const RING_RADIUS = 185;

// Extract pinyin initials from username, e.g. "dayue" → "dy"
function abbrev(username) {
  const base = username.replace(/_.*$/, '');
  let result = base[0] || '';
  const m = base.match(/[aeiou]+([^aeiou])/);
  if (m) result += m[1];
  return result;
}

const edgeColor = e => {
  if (e.sharedSessions >= 5) return '#c05050';
  if (e.type === 'teammate') return '#4a85c5';
  return '#5a8f7a';
};

function egoLayout(centerId, allNodes, edges) {
  const pos = {};
  const neighbors = [];
  edges.forEach(e => {
    if (e.user1 === centerId && !neighbors.includes(e.user2)) neighbors.push(e.user2);
    if (e.user2 === centerId && !neighbors.includes(e.user1)) neighbors.push(e.user1);
  });

  pos[centerId] = { x: W / 2, y: H / 2, opacity: 1 };

  const r = Math.max(RING_RADIUS, 140 + neighbors.length * 18);
  neighbors.forEach((id, i) => {
    const angle = (i / neighbors.length) * Math.PI * 2 - Math.PI / 2;
    pos[id] = { x: W / 2 + Math.cos(angle) * r, y: H / 2 + Math.sin(angle) * r, opacity: 1 };
  });

  allNodes.forEach(n => {
    if (!pos[n.id]) pos[n.id] = { x: W / 2, y: H * 1.8, opacity: 0 };
  });

  return pos;
}

const STARS = Array.from({ length: 160 }, (_, i) => ({
  cx: `${((i * 7919 + 1) % 1000) / 10}%`,
  cy: `${((i * 6271 + 3) % 1000) / 10}%`,
  r: i % 3 === 0 ? 1.3 : i % 3 === 1 ? 0.8 : 0.45,
  op: 0.1 + (i % 8) * 0.07,
}));

const edgeT = { duration: 0.45, ease: 'easeInOut' };

// Animated edge — smooth position transition, pulsing glow on center edges
function AnimatedEdge({ posA, posB, col, opacity, strokeWidth, isCenter }) {
  const speed = isCenter ? 2.2 : 3.2;

  return (
    <g>
      {/* Glow */}
      <motion.line
        initial={false}
        animate={{ x1: posA.x, y1: posA.y, x2: posB.x, y2: posB.y, opacity: opacity * 0.22 }}
        transition={edgeT}
        stroke={col} strokeWidth={strokeWidth * 3.5} strokeLinecap="round" filter="url(#glow-sm)"
      />
      {/* Solid base */}
      <motion.line
        initial={false}
        animate={{ x1: posA.x, y1: posA.y, x2: posB.x, y2: posB.y, opacity: opacity * 0.55 }}
        transition={edgeT}
        stroke={col} strokeWidth={strokeWidth} strokeLinecap="round"
      />
      {/* Pulsing glow overlay on center edges — no dashes */}
      {isCenter && opacity > 0.1 && (
        <motion.line
          initial={false}
          animate={{
            x1: posA.x, y1: posA.y, x2: posB.x, y2: posB.y,
            opacity: [opacity * 0.3, opacity * 0.85, opacity * 0.3],
          }}
          transition={{
            x1: edgeT, y1: edgeT, x2: edgeT, y2: edgeT,
            opacity: { duration: speed, repeat: Infinity, ease: 'easeInOut' },
          }}
          stroke={col}
          strokeWidth={strokeWidth * 1.8}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

export default function Network() {
  const { t } = useLanguage();
  const { friends, sentRequests, receivedRequests, sendRequest, cancelRequest, acceptRequest, unfriend } = useFriend();
  const { id: selfId, name: selfName, username: selfUsername, school: selfSchool, region: selfRegion, avg_score: selfAvgScore, avatarUrl: selfAvatarUrl } = useUser();
  const [panelNode, setPanelNode] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [confirmingUnfriendId, setConfirmingUnfriendId] = useState(null);
  const isMobile = useIsMobile();
  const [greetingOpen, setGreetingOpen] = useState(false);
  const [greetingDraft, setGreetingDraft] = useState('');

  useEffect(() => {
    if (!selfId) return;
    supabase.rpc('get_friend_network').then(({ data }) => setFriendProfiles(data || []));
  }, [selfId, friends]);

  const nodes = useMemo(() => {
    if (!selfId) return [];
    return [
      { id: selfId, name: selfName, username: selfUsername, school: selfSchool, region: selfRegion, avg_score: selfAvgScore, is_public: true, self: true },
      ...friendProfiles.map(p => ({ ...p, self: false })),
    ];
  }, [selfId, selfName, selfUsername, selfSchool, selfRegion, selfAvgScore, friendProfiles]);

  const [layoutCenter, setLayoutCenter] = useState(null);
  const centerNode = layoutCenter ?? selfId ?? null;

  const renderEdges = useMemo(() => {
    if (!selfId) return [];
    return friendProfiles.map(p => ({
      id: `${selfId}-${p.id}`,
      user1: selfId,
      user2: p.id,
      type: (p.shared_sessions ?? 0) > 0 ? 'teammate' : 'friend',
      sharedSessions: p.shared_sessions ?? 0,
    }));
  }, [selfId, friendProfiles]);

  const layout = useMemo(() => egoLayout(centerNode, nodes, renderEdges), [centerNode, nodes, renderEdges]);

  const visibleIds = useMemo(() => new Set(
    Object.entries(layout).filter(([, v]) => v.opacity > 0).map(([k]) => k)
  ), [layout]);

  const nodeConnCount = useMemo(() => {
    const cnt = {};
    nodes.forEach(n => { cnt[n.id] = 0; });
    renderEdges.forEach(e => {
      if (visibleIds.has(e.user1) && visibleIds.has(e.user2)) {
        cnt[e.user1] = (cnt[e.user1] || 0) + 1;
        cnt[e.user2] = (cnt[e.user2] || 0) + 1;
      }
    });
    return cnt;
  }, [nodes, renderEdges, visibleIds]);

  const panelNodeData = panelNode ? nodes.find(n => n.id === panelNode) : null;

  const friendStatus = id => {
    if (friends.includes(id)) return 'friend';
    if (sentRequests.includes(id)) return 'sent';
    if (receivedRequests.includes(id)) return 'received';
    return 'none';
  };

  const handleNodeClick = (e, nodeId) => {
    e.stopPropagation();
    setLayoutCenter(nodeId);
    setPanelNode(nodeId);
    setGreetingOpen(false);
    setGreetingDraft('');
  };

  const handleBgClick = () => {
    setPanelNode(null);
    setLayoutCenter(selfId);
  };

  return (
    <div style={{
      height: isMobile ? MOBILE_FULL_HEIGHT : 'calc(100dvh - 60px)', position: 'relative', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 35%, #1d2813 0%, #080b05 100%)',
    }}>
      {/* Starfield */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />
        ))}
      </svg>

      {/* Header */}
      <div style={{ position: 'absolute', top: '28px', left: '36px', zIndex: 10, pointerEvents: 'none' }}>
        <p style={{ fontSize: '10px', color: 'rgba(164,185,181,0.45)', letterSpacing: '0.2em', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>{t('network.header_kicker')}</p>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#E8E4DC', letterSpacing: '0.03em', lineHeight: 1, margin: 0 }}>{t('network.header_title')}</h1>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', top: '28px', right: '36px', zIndex: 10, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          { col: '#5a8f7a', label: t('network.legend_friend') },
          { col: '#4a85c5', label: t('network.legend_teammate') },
          { col: '#c05050', label: t('network.legend_collab') },
        ].map(({ col, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '2px', backgroundColor: col, borderRadius: '1px', opacity: 0.7 }} />
            <span style={{ fontSize: '10px', color: 'rgba(232,228,220,0.35)', letterSpacing: '0.06em' }}>{label}</span>
          </div>
        ))}
      </div>

      {!panelNode && (
        <p style={{ position: 'absolute', bottom: '28px', left: '50%', transform: 'translateX(-50%)', fontSize: '11px', color: 'rgba(232,228,220,0.2)', letterSpacing: '0.1em', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5 }}>
          {t('network.hint')}
        </p>
      )}

      {/* Network SVG */}
      <div style={{ position: 'absolute', inset: 0 }} onClick={handleBgClick}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <filter id="glow-sm" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-lg" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <clipPath id="clip-center">
              <circle cx="0" cy="0" r="26" />
            </clipPath>
            <clipPath id="clip-node">
              <circle cx="0" cy="0" r="20" />
            </clipPath>
          </defs>

          {/* Edges */}
          {renderEdges.map(e => {
            const posA = layout[e.user1];
            const posB = layout[e.user2];
            if (!posA || !posB) return null;
            const col = edgeColor(e);
            const base = Math.min(0.15 + e.sharedSessions * 0.1, 0.82);
            const involvesCenter = e.user1 === centerNode || e.user2 === centerNode;
            const bothVisible = visibleIds.has(e.user1) && visibleIds.has(e.user2);
            const op = involvesCenter ? base : (bothVisible ? base * 0.3 : 0);
            const sw = 0.5 + e.sharedSessions * 0.35;
            return (
              <AnimatedEdge
                key={e.id}
                e={e}
                posA={posA}
                posB={posB}
                col={col}
                opacity={op}
                strokeWidth={sw}
                isCenter={involvesCenter}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const pos = layout[n.id];
            if (!pos) return null;
            const isCenter = centerNode === n.id;
            const isPaneled = panelNode === n.id;
            const r = isCenter ? 26 : 20;
            const ringCol = n.self ? '#c07a3a' : '#a4b9b5';
            const textCol = n.self ? '#c07a3a' : '#a4b9b5';
            const bgCol = n.self ? '#180e04' : '#0c1008';
            // Private accounts only show initials to non-friends
            const hidden = !n.self && !n.is_public && !friends.includes(n.id);
            const nodeAvatarUrl = n.self ? selfAvatarUrl : n.avatar_url;
            const showAvatar = !hidden && nodeAvatarUrl;
            const displayLabel = hidden ? abbrev(n.username) : n.name;

            return (
              <g
                key={n.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{
                  opacity: pos.opacity,
                  cursor: 'pointer',
                  transition: 'transform 0.45s ease-in-out, opacity 0.3s ease-out',
                }}
                onClick={(e) => handleNodeClick(e, n.id)}
              >
                {isPaneled && <circle cx="0" cy="0" r={r + 14} fill="none" stroke={ringCol} strokeWidth="0.8" opacity="0.2" filter="url(#glow-lg)" />}
                {isPaneled && <circle cx="0" cy="0" r={r + 8} fill="none" stroke={ringCol} strokeWidth="0.8" opacity="0.45" />}
                {isCenter && !isPaneled && (
                  <motion.circle
                    cx="0" cy="0" r={r + 6}
                    fill="none" stroke={ringCol} strokeWidth="0.5"
                    animate={{ opacity: [0.08, 0.22, 0.08], r: [r + 6, r + 11, r + 6] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                <circle cx="0" cy="0" r={r} fill={bgCol}
                  stroke={isPaneled ? ringCol : (n.self ? 'rgba(192,122,58,0.5)' : 'rgba(164,185,181,0.28)')}
                  strokeWidth={isPaneled ? 1.5 : 0.8} />
                {showAvatar ? (
                  <image
                    href={nodeAvatarUrl}
                    x={-r} y={-r} width={r * 2} height={r * 2}
                    clipPath={isCenter ? 'url(#clip-center)' : 'url(#clip-node)'}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text textAnchor="middle" dy="0.36em" fill={textCol} fontSize={n.self ? 13 : 11} fontWeight="700" fontFamily="inherit">
                    {displayLabel.slice(0, hidden ? 4 : 1)}
                  </text>
                )}
                <text textAnchor="middle" dy={r + 13} fill="rgba(232,228,220,0.68)" fontSize={9} fontFamily="inherit">
                  {displayLabel}
                </text>
                <text textAnchor="middle" dy={r + 24} fill="rgba(164,185,181,0.3)" fontSize={7.5} fontFamily="inherit">
                  @{n.username}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Info panel */}
      <AnimatePresence>
        {panelNodeData && (
          <motion.div
            key={panelNodeData.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: '28px', right: '28px',
              background: 'rgba(16,20,11,0.94)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(164,185,181,0.16)', borderRadius: '16px', padding: '14px 20px',
              display: 'flex', alignItems: 'center', gap: '14px', zIndex: 20, minWidth: '340px',
              boxShadow: '0 8px 36px rgba(0,0,0,0.5)',
            }}
          >
            {(() => {
              const panelHidden = !panelNodeData.self && !panelNodeData.is_public && !friends.includes(panelNodeData.id);
              const panelDisplay = panelHidden ? abbrev(panelNodeData.username) : panelNodeData.name;
              const panelAvatarUrl = panelNodeData.self ? selfAvatarUrl : panelNodeData.avatar_url;
              return (
                <>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, background: panelNodeData.self ? '#1a0e04' : '#0c1008', border: `1.5px solid ${panelNodeData.self ? '#c07a3a' : '#7d9b96'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: panelNodeData.self ? '#c07a3a' : '#a4b9b5', fontSize: '13px', fontWeight: 700, overflow: 'hidden' }}>
                    {!panelHidden && panelAvatarUrl
                      ? <img src={panelAvatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      : panelDisplay.slice(0, panelHidden ? 4 : 1)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8E4DC' }}>{panelDisplay}</span>
                      <span style={{ fontSize: '10px', color: 'rgba(164,185,181,0.45)' }}>@{panelNodeData.username}</span>
                    </div>
                    {!panelHidden && <p style={{ fontSize: '11px', color: 'rgba(232,228,220,0.38)', marginBottom: '5px' }}>{panelNodeData.school} · {panelNodeData.region}</p>}
                    <div style={{ display: 'flex', gap: '14px' }}>
                      {!panelHidden && <span style={{ fontSize: '11px', color: '#7d9b96', fontWeight: 600 }}>{panelNodeData.avg_score.toFixed(1)} <span style={{ color: 'rgba(232,228,220,0.28)', fontWeight: 400 }}>{t('network.avg_score')}</span></span>}
                      {!panelHidden && !panelNodeData.self && panelNodeData.total_sessions != null && (
                        <span style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)' }}>
                          {panelNodeData.total_sessions} <span style={{ color: 'rgba(232,228,220,0.22)' }}>{t('network.sessions_label')}</span>
                        </span>
                      )}
                      {!panelHidden && !panelNodeData.self && panelNodeData.win_rate != null && (
                        <span style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)' }}>
                          {Math.round(panelNodeData.win_rate * 100)}% <span style={{ color: 'rgba(232,228,220,0.22)' }}>{t('network.win_rate_label')}</span>
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'rgba(232,228,220,0.35)' }}>{t('network.connections', { count: nodeConnCount[panelNodeData.id] ?? 0 })}</span>
                    </div>
                  </div>
                </>
              );
            })()}
            <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
              {panelNodeData.self ? (
                <Link to="/me" style={{ textDecoration: 'none' }}>
                  <button style={{ padding: '7px 14px', background: 'rgba(192,122,58,0.12)', border: '1px solid rgba(192,122,58,0.28)', borderRadius: '20px', fontSize: '11px', color: '#c07a3a', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.my_profile')}</button>
                </Link>
              ) : (
                <>
                  <Link to={`/profile/${panelNodeData.id}`} style={{ textDecoration: 'none' }}>
                    <button style={{ padding: '7px 12px', background: 'rgba(164,185,181,0.08)', border: '1px solid rgba(164,185,181,0.2)', borderRadius: '20px', fontSize: '11px', color: 'rgba(164,185,181,0.7)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.view')}</button>
                  </Link>
                  {friendStatus(panelNodeData.id) === 'friend' && <button onClick={() => setConfirmingUnfriendId(panelNodeData.id)} style={{ padding: '7px 12px', background: 'rgba(90,143,122,0.12)', border: '1px solid rgba(90,143,122,0.28)', borderRadius: '20px', fontSize: '11px', color: '#5a8f7a', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.already_friend')}</button>}
                  {friendStatus(panelNodeData.id) === 'sent' && <button onClick={() => cancelRequest(panelNodeData.id)} style={{ padding: '7px 12px', background: 'rgba(164,185,181,0.06)', border: '1px solid rgba(164,185,181,0.14)', borderRadius: '20px', fontSize: '11px', color: 'rgba(232,228,220,0.32)', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.request_sent')}</button>}
                  {friendStatus(panelNodeData.id) === 'received' && <button onClick={() => acceptRequest(panelNodeData.id)} style={{ padding: '7px 12px', background: 'rgba(192,122,58,0.14)', border: '1px solid rgba(192,122,58,0.28)', borderRadius: '20px', fontSize: '11px', color: '#c07a3a', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.accept')}</button>}
                  {friendStatus(panelNodeData.id) === 'none' && !greetingOpen && (
                    <button onClick={() => { setGreetingOpen(true); setGreetingDraft(''); }} style={{ padding: '7px 12px', background: 'rgba(164,185,181,0.12)', border: '1px solid rgba(164,185,181,0.28)', borderRadius: '20px', fontSize: '11px', color: '#a4b9b5', cursor: 'pointer', fontFamily: 'inherit' }}>{t('network.add_friend')}</button>
                  )}
                  {friendStatus(panelNodeData.id) === 'none' && greetingOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '150px' }}>
                      <input autoFocus value={greetingDraft} onChange={e => setGreetingDraft(e.target.value.slice(0, 20))}
                        placeholder={t('network.greeting_placeholder')} maxLength={20}
                        onKeyDown={e => { if (e.key === 'Enter') { sendRequest(panelNodeData.id, greetingDraft); setGreetingOpen(false); } if (e.key === 'Escape') setGreetingOpen(false); }}
                        style={{ padding: '5px 8px', border: '1px solid rgba(164,185,181,0.4)', borderRadius: '6px', fontSize: '11px', outline: 'none', fontFamily: 'inherit', background: 'rgba(255,255,255,0.08)', color: '#E8E4DC' }} />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => { sendRequest(panelNodeData.id, greetingDraft); setGreetingOpen(false); }} style={{ flex: 1, padding: '4px', fontSize: '10px', fontWeight: 600, background: 'rgba(164,185,181,0.2)', color: '#a4b9b5', border: '1px solid rgba(164,185,181,0.3)', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('common.send')}</button>
                        <button onClick={() => setGreetingOpen(false)} style={{ padding: '4px 6px', fontSize: '10px', background: 'transparent', color: 'rgba(232,228,220,0.4)', border: '1px solid rgba(232,228,220,0.1)', borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <button onClick={() => setPanelNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'rgba(232,228,220,0.25)', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {confirmingUnfriendId && (
        <ConfirmModal
          title={t('network.delete_friend_title')}
          message={t('network.delete_friend_msg', { name: nodes.find(n => n.id === confirmingUnfriendId)?.name || '' })}
          confirmLabel={t('common.delete')}
          danger
          onCancel={() => setConfirmingUnfriendId(null)}
          onConfirm={() => { unfriend(confirmingUnfriendId); setConfirmingUnfriendId(null); }}
        />
      )}
    </div>
  );
}
