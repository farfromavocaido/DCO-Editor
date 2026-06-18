// @ts-nocheck
'use client';

import { useEffect } from 'react';

export function usePaneResize() {
  useEffect(() => {
    const resizer = document.getElementById('paneResizer');
    if (!resizer) return;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || window.matchMedia('(max-width: 1060px)').matches) return;
      event.preventDefault();
      resizer.classList.add('is-dragging');
      document.body.classList.add('is-resizing-pane');
      const shell = document.querySelector('.app-shell') as HTMLElement | null;
      const workspace = document.querySelector('.workspace');
      if (!shell || !workspace) return;
      const workspaceLeft = workspace.getBoundingClientRect().left;
      const minWidth = 420;
      const maxWidth = Math.max(minWidth, Math.min(960, window.innerWidth - 360));

      const onMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(moveEvent.clientX - workspaceLeft)));
        shell.style.setProperty('--editor-width', `${nextWidth}px`);
        window.dispatchEvent(new Event('resize'));
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        resizer.classList.remove('is-dragging');
        document.body.classList.remove('is-resizing-pane');
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onUp, { once: true });
    };

    resizer.addEventListener('pointerdown', onPointerDown);
    return () => resizer.removeEventListener('pointerdown', onPointerDown);
  }, []);
}
