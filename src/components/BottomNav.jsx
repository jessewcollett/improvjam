import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { orderedVisibleNavTabs } from '../lib/nav.js';
import { captureAppLayout } from '../lib/debugSessionLog.js';
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
    captureAppLayout('nav-mount');
    // #endregion
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--bottom-nav-height');
    };
  }, [items.length]);

  return (
    <nav
      ref={navRef}
      className="shrink-0 w-full bg-[#1A1A1A] border-t border-gray-800 pb-[10px] z-50"
    >
      <div className="flex justify-around items-stretch px-1 pt-1 max-w-md md:max-w-none mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center w-full py-1 px-0.5 relative rounded-xl transition-colors min-h-11 ${
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
