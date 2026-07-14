import { useState, useEffect } from 'react';

// 移动端断点：<= 767px 视为手机端。
export const MOBILE_BREAKPOINT = 767;

// 手机端固定顶栏 / 底部 tab bar 的高度（px，不含安全区），供各页面计算满屏高度用。
export const MOBILE_TOP_H = 48;
export const MOBILE_BOTTOM_H = 56;

// 顶栏加上刘海屏/灵动岛安全区后的实际总高度（standalone 全屏模式下状态栏会
// 盖住内容，必须把 env(safe-area-inset-top) 也算进顶栏高度里）。
export const MOBILE_TOP_H_TOTAL = `calc(${MOBILE_TOP_H}px + env(safe-area-inset-top))`;

// 满屏页面（聊天 / 榜单 / 关系网）在手机端可用的高度：
// 视口高度减去顶栏、底部 tab bar 和上下两侧安全区。
export const MOBILE_FULL_HEIGHT =
  `calc(100dvh - ${MOBILE_TOP_H}px - ${MOBILE_BOTTOM_H}px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`;

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

// iOS「添加到主屏幕」standalone 模式下，env(safe-area-inset-*) 在首次绘制时
// 有时还没生效，导致固定定位的顶栏/底栏初始高度算错、内容被状态栏或
// Home 指示条挡住，要等用户手动滑一下页面浏览器才会重新计算并纠正布局。
// 这里在挂载和每次 App 重新可见时，主动触发一次不可见的微小滚动，
// 强制浏览器立刻重新计算安全区，不用等用户自己滑一下。
//
// 只在真正的 standalone 全屏模式下才需要这个 hack —— 普通浏览器标签页
// （包括 Chrome）压根没有这个 bug，本来就没有状态栏遮挡问题。之前没加
// 判断，导致每次进 Chrome 都会触发一次 scrollTo，被 Chrome 地址栏收起/
// 展开的动画和 100dvh 布局打架，反而把固定定位的顶栏/底栏搞乱了。
export function useFixSafeAreaOnLoad() {
  useEffect(() => {
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    if (!isStandalone) return;

    const nudge = () => {
      requestAnimationFrame(() => {
        window.scrollTo(0, 1);
        requestAnimationFrame(() => window.scrollTo(0, 0));
      });
    };
    nudge();
    const onVisible = () => { if (document.visibilityState === 'visible') nudge(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', nudge);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', nudge);
    };
  }, []);
}
