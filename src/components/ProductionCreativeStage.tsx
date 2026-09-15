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

export function ProductionCreativeStage(props: Props) {
  const { document, row, size, percent, layerIds, hiddenLayerIds, onTargets } = props;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const requests = useRef(createRenderGeneration());
  const latest = useRef(props);
  latest.current = props;
  const [render, setRender] = useState<{ html: string; generation: number; document: Props["document"]; row: Props["row"]; size: string } | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [targets, setTargets] = useState<ProductionTarget[]>([]);

  const measure = () => {
    const doc = frameRef.current?.contentDocument;
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
      const selector = id === 'terms-solo' ? '.terms-solo' : `#${CSS.escape(id.replace(/^offer-slot-(\d+)$/, 'offer$1'))}`;
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
    setReady(false);
    setError('');
    setTargets([]);
    onTargets([]);
    // Coalesce pointer-move writes, while generation invalidation is immediate.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/creative/${encodeURIComponent(size)}/view`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ document, row }), signal: controller.signal,
        });
        if (!response.ok) throw new Error((await response.json()).error || 'Creative render failed');
        const html = await response.text();
        if (requests.current.isCurrent(generation)) setRender({ html, generation, document, row, size });
      } catch (cause) {
        if (!requests.current.isCurrent(generation) || controller.signal.aborted) return;
        const failure = cause instanceof Error ? cause : new Error(String(cause));
        failProductionStage(failure);
        setError(failure.message);
      }
    }, 50);
    return () => { clearTimeout(timer); controller.abort(); requests.current.next(); };
  }, [document, row, size, onTargets]);

  useEffect(() => { if (ready) measure(); }, [percent, ready, layerIds, hiddenLayerIds]);

  const loaded = async (generation: number) => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !requests.current.isCurrent(generation)) return;
    try {
      const stage = await waitForProductionDocument(doc);
      if (!requests.current.isCurrent(generation) || doc !== frameRef.current?.contentDocument) return;
      stage.dataset.productionStage = 'true';
      measure();
      publishProductionStage(stage);
      setReady(true);
    } catch (cause) {
      if (!requests.current.isCurrent(generation)) return;
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      failProductionStage(failure);
      setError(failure.message);
    }
  };

  const displayReady = ready && render?.document === document && render?.row === row && render?.size === size;
  const hit = (event: React.MouseEvent) => {
    if (!displayReady) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const canvas = document.sizes[size].canvas;
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    // Browser paint order resolves overlapping animation frames and nested copy.
    const elements = frameRef.current?.contentDocument?.elementsFromPoint(x, y) || [];
    return resolveProductionHit(targets, elements, x, y);
  };

  return <>
    {render && <iframe key={render.generation} ref={frameRef} title="Production creative" data-production-frame="true" data-ready={displayReady ? "true" : "false"}
      srcDoc={render.html} onLoad={() => loaded(render.generation)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, pointerEvents: 'none', visibility: displayReady ? 'visible' : 'hidden' }} />}
    <div data-production-controls="true" style={{position:'absolute', inset:0}}
      onPointerDown={event => { const id = hit(event); if (id) props.onPointerDown(event, id); }}
      onDoubleClick={event => { const id = hit(event); if (id) { event.stopPropagation(); props.onDoubleClick(id); } }}
      onContextMenu={event => { const id = hit(event); if (id) props.onContextMenu(event, id); }} />
    {!displayReady && <div role={error ? 'alert' : 'status'} style={{position:'absolute', inset:0, display:'grid', placeItems:'center', background:'#fff', color:'#333', padding:16, fontSize:12, pointerEvents:'none'}}>
      {error || 'Rendering production creative…'}
    </div>}
  </>;
}
