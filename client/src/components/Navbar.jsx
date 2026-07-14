import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import LoginPromptModal from './LoginPromptModal';
import NotificationBell from './NotificationBell';
import { OPEN_ONBOARDING_EVENT } from './OnboardingModal';
import { isConfigured } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { useChat } from '../contexts/ChatContext';
import { useIsMobile, MOBILE_TOP_H, MOBILE_BOTTOM_H } from '../lib/useIsMobile';

const homeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor"/>
    <path d="M9 22V12h6v10" stroke="currentColor"/>
  </svg>
);
const reviewIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
  </svg>
);
const chatIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor"/>
  </svg>
);

// 桌面顶栏 tab（发现 / 复盘 / 聊天）
const NAV = [
  { to: '/discover', label: '发现', icon: homeIcon },
  { to: '/review', label: '复盘', icon: reviewIcon },
  { to: '/chat', label: '聊天', icon: chatIcon },
];

const spring = { type: 'spring', stiffness: 400, damping: 28 };

function OnboardingButton() {
  return (
    <motion.button
      onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT))}
      whileHover={{ scale: 1.1, color: 'rgba(232,228,220,0.9)' }}
      whileTap={{ scale: 0.9 }}
      aria-label="新手教程"
      title="新手教程"
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(232,228,220,0.4)', lineHeight: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </motion.button>
  );
}

// ─── 手机端底部 tab bar ─────────────────────────────────────────────
function MobileBottomNav({ guest, onLocked }) {
  const { pathname } = useLocation();
  const { totalUnread } = useChat();
  const { name, avatarUrl } = useUser();

  const tabs = [
    { to: '/discover', label: '首页', icon: homeIcon },
    { to: '/review', label: '复盘', icon: reviewIcon },
    { to: '/chat', label: '聊天', icon: chatIcon, dot: totalUnread > 0 },
    { to: '/me', label: '头像', profile: true },
  ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      height: `calc(${MOBILE_BOTTOM_H}px + env(safe-area-inset-bottom))`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(44,48,37,0.97)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'stretch',
    }}>
      {tabs.map(({ to, label, icon, dot, profile }) => {
        const active = to === '/me' ? pathname === '/me' : pathname.startsWith(to);
        const locked = guest && to !== '/discover';
        const inner = (
          <motion.div
            whileTap={{ scale: 0.9 }}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '3px', cursor: 'pointer',
              color: active ? '#E8E4DC' : 'rgba(232,228,220,0.45)',
              position: 'relative',
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
              {profile ? (
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  background: active ? '#a4b9b5' : '#7d9b96', color: '#2C3025',
                  fontSize: '11px', fontWeight: 700,
                  border: active ? '1.5px solid rgba(164,185,181,0.7)' : '1.5px solid transparent',
                }}>
                  {avatarUrl
                    ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : (name || '?').slice(0, 1)}
                </span>
              ) : icon}
              {dot && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-4px',
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#c07a3a', border: '1.5px solid #2C3025',
                }} />
              )}
            </span>
            <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, letterSpacing: '0.06em' }}>
              {label}
            </span>
          </motion.div>
        );
        if (locked) {
          return <div key={to} style={{ flex: 1, display: 'flex' }} onClick={onLocked}>{inner}</div>;
        }
        return (
          <Link key={to} to={to} style={{ flex: 1, display: 'flex', textDecoration: 'none' }}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { name, avatarUrl } = useUser();
  const guest = isConfigured && !authUser;
  const isMobile = useIsMobile();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // ─── 手机端：极简顶栏 + 底部 tab bar ───────────────────────────
  if (isMobile) {
    return (
      <>
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          height: `${MOBILE_TOP_H}px`,
          background: 'rgba(44,48,37,0.97)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: '40px' }}>
            {!guest && <OnboardingButton />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: '40px', justifyContent: 'flex-end' }}>
            {guest ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                style={{ padding: '6px 16px', background: '#a4b9b5', color: '#2C3025', border: 'none', borderRadius: '18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
              >
                登录 / 注册
              </motion.button>
            ) : (
              <NotificationBell isMobile />
            )}
          </div>
        </div>

        <MobileBottomNav guest={guest} onLocked={() => setShowLoginPrompt(true)} />

        <AnimatePresence>
          {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // ─── 桌面端：顶部导航栏 ───────────────────────────────────────
  return (
    <>
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '60px',
      background: 'rgba(44,48,37,0.97)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      padding: '0 32px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginRight: '40px', flexShrink: 0 }}>
        <Link to="/discover" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#E8E4DC', letterSpacing: '0.05em', fontFamily: 'inherit' }}>
            撇捺
          </span>
        </Link>
        {!guest && <OnboardingButton />}
      </div>

      {/* Nav tabs */}
      <motion.div layoutRoot style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
        {NAV.map(({ to, label, icon }) => {
          const active = pathname.startsWith(to);
          const showUnreadDot = to === '/chat';
          // 访客只能停留在「发现」，点其他 tab 弹登录提示
          const locked = guest && to !== '/discover';
          const inner = <NavTab label={label} icon={icon} active={active} showUnreadDot={showUnreadDot} />;
          if (locked) {
            return (
              <div key={to} onClick={() => setShowLoginPrompt(true)}>
                {inner}
              </div>
            );
          }
          return (
            <Link key={to} to={to} style={{ textDecoration: 'none' }}>
              {inner}
            </Link>
          );
        })}
      </motion.div>

      {/* Right section: notification bell + profile avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, marginLeft: '40px' }}>
        {guest ? (
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/login')}
            style={{ padding: '8px 20px', background: '#a4b9b5', color: '#2C3025', border: 'none', borderRadius: '20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em' }}
          >
            登录 / 注册
          </motion.button>
        ) : (
        <>
          <NotificationBell />

          {/* Profile avatar — direct link to profile */}
          <Link to="/me" style={{ textDecoration: 'none' }}>
            <motion.div
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              whileHover={{ opacity: 0.8 }}
              transition={spring}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: pathname === '/me' ? '#a4b9b5' : '#7d9b96',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#2C3025', fontSize: '13px', fontWeight: 700,
                border: pathname === '/me' ? '2px solid rgba(164,185,181,0.6)' : '2px solid transparent',
                transition: 'all 0.2s', overflow: 'hidden', flexShrink: 0,
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : name.slice(0, 1)
                }
              </div>
            </motion.div>
          </Link>
        </>
        )}
      </div>
    </nav>
    {/* backdrop-filter 会把 fixed 定位钉在 nav 内，弹窗必须放在 nav 外 */}
    <AnimatePresence>
      {showLoginPrompt && <LoginPromptModal onClose={() => setShowLoginPrompt(false)} />}
    </AnimatePresence>
    </>
  );
}

// 桌面顶栏单个 tab
function NavTab({ label, icon, active, showUnreadDot }) {
  const { totalUnread } = useChat();
  const dot = showUnreadDot && totalUnread > 0;
  return (
    <motion.div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        padding: '6px 24px', borderRadius: '8px', cursor: 'pointer',
        color: active ? '#E8E4DC' : 'rgba(232,228,220,0.45)',
        position: 'relative', minWidth: '88px',
      }}
      whileHover={{ color: 'rgba(232,228,220,0.85)' }}
      transition={spring}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {icon}
        {dot && (
          <span style={{
            position: 'absolute', top: '-2px', right: '-4px',
            width: '7px', height: '7px', borderRadius: '50%',
            background: '#c07a3a', border: '1.5px solid #2C3025',
          }} />
        )}
      </span>
      <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400, letterSpacing: '0.08em' }}>
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="nav-underline"
          style={{
            position: 'absolute', bottom: '-1px', left: '20px', right: '20px',
            height: '2px', backgroundColor: '#a4b9b5', borderRadius: '1px',
          }}
          transition={spring}
        />
      )}
    </motion.div>
  );
}
