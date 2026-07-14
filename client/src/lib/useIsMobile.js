import { useState, useEffect } from 'react';

// 移动端断点：<= 767px 视为手机端。
export const MOBILE_BREAKPOINT = 767;

// 手机端固定顶栏 / 底部 tab bar 的高度（px），供各页面计算满屏高度用。
export const MOBILE_TOP_H = 48;
export const MOBILE_BOTTOM_H = 56;

// 满屏页面（聊天 / 榜单 / 关系网）在手机端可用的高度：
// 视口高度减去顶栏、底部 tab bar 和 iPhone 底部安全区。
export const MOBILE_FULL_HEIGHT =
  `calc(100dvh - ${MOBILE_TOP_H}px - ${MOBILE_BOTTOM_H}px - env(safe-area-inset-bottom))`;

// 监听视口宽度，返回是否处于手机端。样式全是内联的，媒体查询碰不到内联样式，
// 所以用 JS hook 在渲染时分支。
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT}px)`;
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return isMobile;
}
