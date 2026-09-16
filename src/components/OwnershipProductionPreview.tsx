'use client';
import { useEffect, useRef, useState } from 'react';
import { createRenderGeneration, readProductionTargets, seekProductionAnimations, waitForProductionDocument } from '@/lib/production-stage';

/** Isolated production HTML: thumbnails never publish editor stage readiness. */
export function OwnershipProductionPreview({ document, row, size, percent, label, targetId, maxHeight = 155, maxWidth = 240, onRevealTime }: any) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const latest = useRef({percent,document});
  latest.current = {percent,document};
  const requests = useRef(createRenderGeneration());
  const [render, setRender] = useState<{html:string;generation:number} | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [highlight,setHighlight]=useState<any>(null);
  const mark = (doc:Document) => {
    const stage=doc.querySelector<HTMLElement>('.stage');
    setHighlight(stage && targetId ? readProductionTargets(stage,[targetId.split('::')[0]]).find(item=>item.id===targetId) || null : null);
  };
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
  useEffect(() => {if (ready && frame.current?.contentDocument) {seekProductionAnimations(frame.current.contentDocument,percent,Number(document.clock?.durationS || 15));mark(frame.current.contentDocument);}},[percent,ready,document,targetId]);
  const [width,height] = size.split('x').map(Number);
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return <figure className="relationship-preview"><figcaption>{label}</figcaption><div style={{width:width*scale,height:height*scale,position:'relative',overflow:'hidden'}}>
    {render && <iframe ref={frame} key={render.generation} title={label} srcDoc={render.html} style={{width,height,transform:`scale(${scale})`,transformOrigin:'top left',border:0,visibility:ready?'visible':'hidden',pointerEvents:'none'}} onLoad={async event => {
      const doc = event.currentTarget.contentDocument;
      if (!doc) return;
      try { await waitForProductionDocument(doc); if (!requests.current.isCurrent(render.generation)) return; seekProductionAnimations(doc,latest.current.percent,Number(latest.current.document.clock?.durationS || 15));
        if (targetId && onRevealTime) {
          const stage=doc.querySelector<HTMLElement>('.stage')!;
          const visible=()=>readProductionTargets(stage,[targetId.split('::')[0]]).find(item=>item.id===targetId);
          if (!visible()) {
            let found=false;
            for (let at=0;at<=100;at+=5) {
              seekProductionAnimations(doc,at,Number(latest.current.document.clock?.durationS||15));
              const item=visible();
              if (item) {
                let node:Element|null=item.element,opacity=1;
                while(node){opacity*=Number(doc.defaultView!.getComputedStyle(node).opacity);if(node===stage)break;node=node.parentElement;}
                if(opacity>=0.95){onRevealTime(at);found=true;break;}
              }
            }
            if(!found)seekProductionAnimations(doc,latest.current.percent,Number(latest.current.document.clock?.durationS||15));
          }
        }
        mark(doc); setReady(true); }
      catch (cause) { if (requests.current.isCurrent(render.generation)) setError(String(cause)); }
    }} />}
    {ready && highlight && <div aria-hidden="true" style={{position:'absolute',left:highlight.left*scale,top:highlight.top*scale,width:highlight.width*scale,height:highlight.height*scale,border:'2px solid #f5a623',boxSizing:'border-box',pointerEvents:'none'}}/>}
    {!ready && <span role="status">{error || 'Rendering…'}</span>}
  </div>{ready && targetId && !highlight && <small>Element not visible at this time</small>}</figure>;
}
