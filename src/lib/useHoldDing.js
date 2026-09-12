import { useCallback, useEffect, useRef } from 'react';
import { releaseDing, startDing, startPad } from './audio.js';

export function useHoldDing(style, volume) {
  const voiceRef = useRef(null);
  const downAt = useRef(0);
  const styleRef = useRef(style);
  const volumeRef = useRef(volume);
  styleRef.current = style;
  volumeRef.current = volume;

  const release = useCallback(() => {
    if (!voiceRef.current) return;
    releaseDing(voiceRef.current, { heldMs: performance.now() - downAt.current });
    voiceRef.current = null;
  }, []);

  useEffect(() => () => release(), [release]);

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    release();
    downAt.current = performance.now();
    const current = styleRef.current;
    voiceRef.current = current && typeof current === 'object'
      ? startPad(current, volumeRef.current)
      : startDing(current, volumeRef.current);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [release]);

  const onContextMenu = useCallback((event) => {
    event.preventDefault();
  }, []);

  return {
    onPointerDown,
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu,
    style: { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' },
  };
}
