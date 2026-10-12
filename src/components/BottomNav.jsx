import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { orderedVisibleNavTabs } from '../lib/nav.js';
import { debugSessionLog } from '../lib/debugSessionLog.js';
import { useAppStore } from '../store/useAppStore.js';

export default function BottomNav({ activeRoute, onChange }) {
  const navRef = useRef(null);
  const navOrder = useAppStore((s) => s.settings.navOrder);
  const stageOn = useAppStore((s) => s.settings.stageOn);
  const items = orderedVisibleNavTabs(navOrder, stageOn);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;
    const sync = () => {
      document.documentElement.style.setProperty('--bottom-nav-height', `${el.offsetHeight}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    // #region agent log
    let lastNavLog = 0;
    const reportNav = (reason) => {
      const now = Date.now();
      if (reason !== 'mount' && now - lastNavLog < 400) return;
      lastNavLog = now;
      const nav = navRef.current;
      const shell = document.querySelector('.app-shell');
      const vv = window.visualViewport;
      const navRect = nav?.getBoundingClientRect();
      const shellRect = shell?.getBoundingClientRect();
      const padB = nav ? getComputedStyle(nav).paddingBottom : '';
      const appH = document.documentElement.style.getPropertyValue('--app-height');
      const appTop = document.documentElement.style.getPropertyValue('--app-top');
      const ds = document.documentElement.dataset;
      debugSessionLog({ hypothesisId: 'I', location: 'BottomNav.jsx:reportNav', message: 'nav geometry', data: { runId: 'v0.2.1', reason, scrollY: window.scrollY, docScroll: document.documentElement.scrollTop, bodyScroll: document.body.scrollTop, innerH: window.innerHeight, vvH: vv?.height, vvOff: vv?.offsetTop, navTop: navRect?.top, navBottom: navRect?.bottom, navH: navRect?.height, shellH: shellRect?.height, shellBottom: shellRect?.bottom, gapInner: (window.innerHeight || 0) - (navRect?.bottom || 0), gapVv: (vv?.offsetTop || 0) + (vv?.height || 0) - (navRect?.bottom || 0), padB, screenH: window.screen?.height, appH, appTop, safeB: document.documentElement.style.getPropertyValue('--safe-bottom'), chromeB: ds.chromeBottom, topInset: ds.topInset, bottomInset: ds.bottomInset, standalone: ds.standalone, keyboard: ds.keyboard, lvh: ds.lvh, dvh: ds.dvh, svh: ds.svh } });
    };
    reportNav('mount');
    const onWinScroll = () => reportNav('win-scroll');
    const onVv = () => reportNav('visualViewport');
    const viewport = window.visualViewport;
    window.addEventListener('scroll', onWinScroll, { passive: true, capture: true });
    viewport?.addEventListener('resize', onVv);
    viewport?.addEventListener('scroll', onVv);
    // #endregion
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--bottom-nav-height');
      // #region agent log
      window.removeEventListener('scroll', onWinScroll, { capture: true });
      window.visualViewport?.removeEventListener('resize', onVv);
      window.visualViewport?.removeEventListener('scroll', onVv);
      // #endregion
    };
  }, [items.length]);

  return (
    <nav
      ref={navRef}
      className="shrink-0 w-full bg-[#1A1A1A]/95 backdrop-blur-md border-t border-gray-800 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="flex justify-around items-stretch px-1 py-1.5 max-w-md md:max-w-none mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1.5 px-0.5 relative rounded-xl transition-colors min-h-12 ${
                isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavTab"
                  className="absolute inset-0 bg-gray-800 rounded-xl"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ zIndex: -1 }}
                />
              )}
              <Icon className={`w-5 h-5 mb-0.5 shrink-0 ${isActive ? 'text-blue-400 scale-110' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs leading-tight text-center max-w-full line-clamp-2 break-words ${isActive ? 'font-bold text-gray-200' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
