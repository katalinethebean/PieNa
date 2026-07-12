import { useEffect, useRef } from 'react';

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

let scriptPromise = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// 人机验证组件：验证通过后通过 onToken 回传 token；token 单次有效，
// 登录失败后父组件可通过改变 resetKey 强制刷新重新验证
export default function TurnstileWidget({ onToken, resetKey }) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !ref.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    });
    return () => {
      cancelled = true;
      if (widgetId.current != null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={ref} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }} />;
}
