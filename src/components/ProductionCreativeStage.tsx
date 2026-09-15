'use client';

import { useEffect, useRef, useState } from 'react';
import {
  beginProductionStage, createRenderGeneration, failProductionStage, publishProductionStage,
  readProductionTargets, resolveProductionHit, seekProductionAnimations, waitForProductionDocument,
  type ProductionTarget,
} from '@/lib/production-stage';

type Props = {
  document: Record<string, any>;
  row: Record<string, unknown>;
  size: string;
  percent: number;
  layerIds: string[];
  hiddenLayerIds: Set<string>;
  onTargets: (targets: ProductionTarget[]) => void;
  onPointerDown: (event: React.PointerEvent, targetId: string) => void;
  onDoubleClick: (targetId: string) => void;
  onContextMenu: (event: React.MouseEvent, targetId: string) => void;
};

type RenderedCreative = { html: string; generation: number; document: Props['document']; row: Props['row']; size: string };

export function ProductionCreativeStage(props: Props) {
  const { document, row, size, percent, layerIds, hiddenLayerIds, onTargets } = props;
  const frameRefs = useRef(new Map<number, HTMLIFrameElement>());
  const requests = useRef(createRenderGeneration());
  const latest = useRef(props);
  latest.current = props;
  const [displayed, setDisplayed] = useState<RenderedCreative | null>(null);
  const [pending, setPending] = useState<RenderedCreative | null>(null);
  const [error, setError] = useState('');
  const [targets, setTargets] = useState<ProductionTarget[]>([]);

  const measure = (frame?: HTMLIFrameElement) => {
    const doc = (frame || (displayed && frameRefs.current.get(displayed.generation)))?.contentDocument;
    const stage = doc?.querySelector<HTMLElement>('.stage.motion-ready');
    if (!doc || !stage) return;
    const current = latest.current;
    seekProductionAnimations(doc, current.percent, Number(current.document.clock?.durationS || 15));
    // Explicit editor-only visibility; this does not alter the document or export.
    let hiddenStyle = doc.querySelector<HTMLStyleElement>('style[data-editor-hidden-layers]');
    if (!hiddenStyle) {
      hiddenStyle = doc.createElement('style');
      hiddenStyle.dataset.editorHiddenLayers = 'true';
      doc.head.append(hiddenStyle);
    }
    hiddenStyle.textContent = Array.from(current.hiddenLayerIds).map(id => {
      const selector = id === 'terms-solo' ? '#TC_Solo' : `#${CSS.escape(id.replace(/^offer-slot-(\d+)$/, 'offer$1'))}`;
      return `${selector}, ${selector} * { visibility: hidden !important; }`;
    }).join('\n');
    // Force layout after the browser evaluates animation currentTime.
    const measured = readProductionTargets(stage, current.layerIds).filter(target => !current.hiddenLayerIds.has(target.id.split('::')[0]));
    setTargets(measured);
    current.onTargets(measured);
  };

  useEffect(() => {
    const generation = requests.current.next();
    const controller = new AbortController();
    beginProductionStage(size);
    setError('');
    setPending(null);
    if (displayed?.size !== size) { setTargets([]); onTargets([]); }
    // Coalesce pointer-move writes, while generation invalidation is immediate.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/creative/${encodeURIComponent(size)}/view`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ document, row }), signal: controller.signal,
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Creative render failed');
        const html = await response.text();
        if (requests.current.isCurrent(generation)) setPending({ html, generation, document, row, size });
      } catch (cause) {
        if (!requests.current.isCurrent(generation) || controller.signal.aborted) return;
        const failure = cause instanceof Error ? cause : new Error(String(cause));
        failProductionStage(failure);
        setError(failure.message);
      }
    }, 50);
    return () => { clearTimeout(timer); controller.abort(); requests.current.next(); };
  }, [document, row, size, onTargets]);

  useEffect(() => { if (displayed?.size === size) measure(); }, [percent, displayed, layerIds, hiddenLayerIds, size]);

  const loaded = async (render: RenderedCreative, frame: HTMLIFrameElement) => {
    const generation = render.generation;
    const doc = frame.contentDocument;
    if (!doc || !requests.current.isCurrent(generation)) return;
    try {
      const stage = await waitForProductionDocument(doc);
      if (!requests.current.isCurrent(generation) || render.document !== latest.current.document || render.row !== latest.current.row || render.size !== latest.current.size) return;
      stage.dataset.productionStage = 'true';
      measure(frame);
      publishProductionStage(stage);
      setDisplayed(render);
      setPending(null);
    } catch (cause) {
      if (!requests.current.isCurrent(generation)) return;
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      failProductionStage(failure);
      setError(failure.message);
    }
  };

  const displayReady = displayed?.document === document && displayed?.row === row && displayed?.size === size;
  const hasDisplay = displayed?.size === size;
  const hit = (event: React.MouseEvent) => {
    if (!displayReady) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const canvas = document.sizes[size].canvas;
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    // Browser paint order resolves overlapping animation frames and nested copy.
    const elements = (displayed && frameRefs.current.get(displayed.generation))?.contentDocument?.elementsFromPoint(x, y) || [];
    return resolveProductionHit(targets, elements, x, y);
  };

  return <>
    {[displayed, pending].filter((item): item is RenderedCreative => Boolean(item)).map(render => {
      const isDisplayed = render === displayed;
      return <iframe key={render.generation}
        ref={frame => { if (frame) frameRefs.current.set(render.generation, frame); else frameRefs.current.delete(render.generation); }}
        title={isDisplayed ? 'Production creative' : 'Preparing production creative'}
        data-production-frame={isDisplayed || !displayed ? 'true' : undefined}
        data-pending-production-frame={!isDisplayed ? 'true' : undefined}
        data-ready={isDisplayed && displayReady ? 'true' : 'false'}
        srcDoc={render.html} onLoad={event => loaded(render, event.currentTarget)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none', visibility: isDisplayed && hasDisplay ? 'visible' : 'hidden' }} />;
    })}
    <div data-production-controls="true" style={{position:'absolute', inset:0}}
      onPointerDown={event => { const id = hit(event); if (id) props.onPointerDown(event, id); }}
      onDoubleClick={event => { const id = hit(event); if (id) { event.stopPropagation(); props.onDoubleClick(id); } }}
      onContextMenu={event => { const id = hit(event); if (id) props.onContextMenu(event, id); }} />
    {!displayReady && <div role={error ? 'alert' : 'status'} style={{position:'absolute', ...(hasDisplay ? {left:4, bottom:4, maxWidth:'calc(100% - 8px)'} : {inset:0}), background:hasDisplay ? '#ffffffe6' : '#fff', color:'#333', padding:hasDisplay ? 4 : 16, fontSize:12, pointerEvents:'none'}}>
      {error || (hasDisplay ? 'Updating preview…' : 'Rendering production creative…')}
    </div>}
  </>;
}
