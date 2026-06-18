// @ts-nocheck
'use client';

import { useEffect, useRef } from 'react';

export function useStageResize(
  viewportRef: React.RefObject<HTMLDivElement | null>,
  canvas?: { width: number; height: number },
) {
  const scaleRef = useRef(1);

  const resize = () => {
    if (!viewportRef.current || !canvas) return 1;
    const maxWidth = Math.max(240, viewportRef.current.clientWidth - 48);
    const maxHeight = Math.max(160, viewportRef.current.clientHeight - 48);
    scaleRef.current = Math.min(maxWidth / canvas.width, maxHeight / canvas.height, 1.6);
    return scaleRef.current;
  };

  useEffect(() => {
    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [canvas]);

  const scale = canvas ? resize() : 1;

  return {
    scale,
    shellStyle: canvas ? {
      width: canvas.width * scale,
      height: canvas.height * scale,
    } : undefined,
  };
}
