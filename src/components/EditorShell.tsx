// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';

import { HtmlCodeInspector } from '@/components/HtmlCodeInspector';
import { CreativeInspector } from '@/components/CreativeInspector';
import { LayerTree } from '@/components/LayerTree';
import { PreviewPane } from '@/components/PreviewPane';
import { TimelinePanel } from '@/components/TimelinePanel';
import { TopBar } from '@/components/TopBar';
import { useEditorStore } from '@/store/editor-store';

export function EditorShell() {
  const [timelineHeight, setTimelineHeight] = useState(260);
  const [layersWidth, setLayersWidth] = useState(280);
  const [inspectorWidth, setInspectorWidth] = useState(330);
  const init = useEditorStore((s) => s.init);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const nudgeSelectedTarget = useEditorStore((s) => s.nudgeSelectedTarget);
  const setStatus = useEditorStore((s) => s.setStatus);

  const startTimelineResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = timelineHeight;
    document.body.classList.add('is-resizing-timeline');

    const onMove = (moveEvent: PointerEvent) => {
      const dy = startY - moveEvent.clientY;
      setTimelineHeight(Math.max(150, Math.min(520, Math.round(startHeight + dy))));
    };

    const onUp = () => {
      document.body.classList.remove('is-resizing-timeline');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const startSideResize = (side: 'layers' | 'inspector', event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === 'layers' ? layersWidth : inspectorWidth;
    document.body.classList.add('is-resizing-pane');

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const nextWidth = side === 'layers' ? startWidth + dx : startWidth - dx;
      const min = side === 'layers' ? 220 : 280;
      const max = side === 'layers' ? 420 : 480;
      const clamped = Math.max(min, Math.min(max, Math.round(nextWidth)));
      if (side === 'layers') setLayersWidth(clamped);
      else setInspectorWidth(clamped);
      window.dispatchEvent(new Event('resize'));
    };

    const onUp = () => {
      document.body.classList.remove('is-resizing-pane');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };

  useEffect(() => {
    init().catch((error) => setStatus(error.message, 'error'));
  }, [init, setStatus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
      const isTextInput = active && (
        (active.tagName === 'INPUT' && active.type !== 'range')
        || active.tagName === 'TEXTAREA'
        || active.tagName === 'SELECT'
        || active.isContentEditable
      );
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (!isArrow) return;
      if (isTextInput) return;
      if (!selectedTargetId && !selectedLayerId) return;
      event.preventDefault();
      const amount = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
      const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
      nudgeSelectedTarget(dx, dy);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudgeSelectedTarget, redo, selectedLayerId, selectedTargetId, undo]);

  return (
    <main className="app-shell">
      <TopBar />
      <HtmlCodeInspector />
      <section
        className="creative-workspace"
        style={{
          '--timeline-height': `${timelineHeight}px`,
          '--layers-width': `${layersWidth}px`,
          '--inspector-width': `${inspectorWidth}px`,
        }}
      >
        <LayerTree />
        <div
          className="workspace-pane-resizer workspace-pane-resizer-left"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize layer panel"
          onPointerDown={(event) => startSideResize('layers', event)}
        />
        <PreviewPane />
        <div
          className="workspace-pane-resizer workspace-pane-resizer-right"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inspector panel"
          onPointerDown={(event) => startSideResize('inspector', event)}
        />
        <CreativeInspector />
        <div
          className="timeline-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline"
          onPointerDown={startTimelineResize}
        />
        <TimelinePanel />
      </section>
    </main>
  );
}
