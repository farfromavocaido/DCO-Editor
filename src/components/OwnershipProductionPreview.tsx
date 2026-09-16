'use client';
import { useEffect, useRef, useState } from 'react';
import { createRenderGeneration, seekProductionAnimations, waitForProductionDocument } from '@/lib/production-stage';

/** Isolated production HTML: thumbnails never publish editor stage readiness. */
export function OwnershipProductionPreview({ document, row, size, percent, label }: any) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const latest = useRef({percent,document});
  latest.current = {percent,document};
  const requests = useRef(createRenderGeneration());
  const [render, setRender] = useState<{html:string;generation:number} | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const generation = requests.current.next();
    const controller = new AbortController();
    setReady(false); setRender(null); setError('');
    (async () => {
      try {
        const response = await fetch(`/api/creative/${encodeURIComponent(size)}/view`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document,row,renderMode:'font'}),signal:controller.signal});
        if (!response.ok) throw new Error('Production preview failed');
        const html = await response.text();
        if (requests.current.isCurrent(generation)) setRender({html,generation});
      } catch (cause) { if (!controller.signal.aborted && requests.current.isCurrent(generation)) setError(String(cause)); }
    })();
    return () => { controller.abort(); requests.current.next(); };
  }, [document,row,size]);
  useEffect(() => {if (ready && frame.current?.contentDocument) seekProductionAnimations(frame.current.contentDocument,percent,Number(document.clock?.durationS || 15));},[percent,ready,document]);
  const [width,height] = size.split('x').map(Number);
  const scale = Math.min(240 / width, 155 / height, 1);
  return <figure className="relationship-preview"><figcaption>{label}</figcaption><div style={{width:width*scale,height:height*scale,position:'relative',overflow:'hidden'}}>
    {render && <iframe ref={frame} key={render.generation} title={label} srcDoc={render.html} style={{width,height,transform:`scale(${scale})`,transformOrigin:'top left',border:0,visibility:ready?'visible':'hidden',pointerEvents:'none'}} onLoad={async event => {
      const doc = event.currentTarget.contentDocument;
      if (!doc) return;
      try { await waitForProductionDocument(doc); if (!requests.current.isCurrent(render.generation)) return; seekProductionAnimations(doc,latest.current.percent,Number(latest.current.document.clock?.durationS || 15)); setReady(true); }
      catch (cause) { if (requests.current.isCurrent(render.generation)) setError(String(cause)); }
    }} />}
    {!ready && <span role="status">{error || 'Rendering…'}</span>}
  </div></figure>;
}
