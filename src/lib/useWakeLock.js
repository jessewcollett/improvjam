import { useEffect } from 'react';

export function canWakeLock() {
  return typeof navigator !== 'undefined' && Boolean(navigator.wakeLock);
}

export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled || !canWakeLock()) return undefined;

    let lock;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* browser may deny while hidden, low battery, or unsupported */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release?.().catch(() => {});
    };
  }, [enabled]);
}
