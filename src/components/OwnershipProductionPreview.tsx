'use client';
import { useEffect, useRef, useState } from 'react';
import { createRenderGeneration, readProductionTargets, unionProductionBounds, seekProductionAnimations, waitForProductionDocument } from '@/lib/production-stage';

/** Isolated production HTML: thumbnails never publish editor stage readiness. */
export function OwnershipProductionPreview({ document, row, size, percent, label, targetId, maxHeight = 155, maxWidth = 240, onRevealTime, targetIds, editingBounds, onPlacementChange, preserveAspect }: any) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const latest = useRef({percent,document});
  latest.current = {percent,document};
  const requests = useRef(createRenderGeneration());
  const [render, setRender] = useState<{html:string;generation:number} | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [readySource,setReadySource] = useState<any>(null);
  const [highlight,setHighlight]=useState<any>(null);
  const [dragBounds,setDragBounds]=useState<any>(null);
  const selectedTargets = targetIds?.length ? targetIds : targetId ? [targetId] : [];
  const selectedIn = (stage:HTMLElement) => {
    const found=readProductionTargets(stage,[...new Set<string>(selectedTargets.map((id:string)=>id.split('::')[0]))]).filter(item=>selectedTargets.includes(item.id));
    return found.length ? {...found[0],...unionProductionBounds(found)} : null;
  };
  const mark = (doc:Document) => {
    const stage=doc.querySelector<HTMLElement>('.stage');
    setHighlight(stage && selectedTargets.length ? selectedIn(stage) : null);
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
  useEffect(() => {if (ready && frame.current?.contentDocument) {seekProductionAnimations(frame.current.contentDocument,percent,Number(document.clock?.durationS || 15));mark(frame.current.contentDocument);}},[percent,ready,document,targetId,JSON.stringify(targetIds)]);
  const [width,height] = size.split('x').map(Number);
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  const beginPlacement = (event:React.PointerEvent,resize=false) => {
    if(!editingBounds || !onPlacementChange)return;
    event.preventDefault();event.stopPropagation();
    const start={...editingBounds},x=event.clientX,y=event.clientY;
    let next=start;
    const move=(e:PointerEvent)=>{
      const dx=(e.clientX-x)/scale,dy=(e.clientY-y)/scale;
      if(resize){
        const ratio=Math.abs(dx/start.width)>Math.abs(dy/start.height)?1+dx/start.width:1+dy/start.height;
        next={...start,width:Math.max(4,preserveAspect?start.width*ratio:start.width+dx),height:Math.max(4,preserveAspect?start.height*ratio:start.height+dy)};
      } else next={...start,left:start.left+dx,top:start.top+dy};
      setDragBounds(next);
    };
    const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);setDragBounds(null);};
    const up=()=>{cleanup();onPlacementChange(next);};
    const cancel=()=>cleanup();
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
  };
  const box = highlight && dragBounds && editingBounds ? {
    left:highlight.left+dragBounds.left-editingBounds.left,top:highlight.top+dragBounds.top-editingBounds.top,
    width:highlight.width*dragBounds.width/editingBounds.width,height:highlight.height*dragBounds.height/editingBounds.height,
  } : highlight;
  return <figure className="relationship-preview" data-preview-ready={ready && readySource?.document===document && readySource?.row===row && readySource?.size===size ? 'true' : 'false'}><figcaption>{label}</figcaption><div style={{width:width*scale,height:height*scale,position:'relative',overflow:'hidden'}}>
    {render && <iframe tabIndex={-1} ref={frame} key={render.generation} title={label} srcDoc={render.html} style={{width,height,transform:`scale(${scale})`,transformOrigin:'top left',border:0,visibility:ready?'visible':'hidden',pointerEvents:'none'}} onLoad={async event => {
      const doc = event.currentTarget.contentDocument;
      if (!doc) return;
      try { await waitForProductionDocument(doc); if (!requests.current.isCurrent(render.generation)) return; seekProductionAnimations(doc,latest.current.percent,Number(latest.current.document.clock?.durationS || 15));
        if (targetId && onRevealTime) {
          const stage=doc.querySelector<HTMLElement>('.stage')!;
          const visible=()=>selectedIn(stage);
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
        mark(doc); setReadySource({document,row,size}); setReady(true); }
      catch (cause) { if (requests.current.isCurrent(render.generation)) setError(String(cause)); }
    }} />}
    {ready && box && <div aria-hidden={!onPlacementChange || undefined} data-component-placement={onPlacementChange?'true':undefined} onPointerDown={event=>beginPlacement(event)} style={{position:'absolute',left:box.left*scale,top:box.top*scale,width:box.width*scale,height:box.height*scale,border:'2px solid #f5a623',boxSizing:'border-box',pointerEvents:onPlacementChange?'auto':'none',cursor:onPlacementChange?'move':undefined}}>{onPlacementChange&&<button type="button" aria-label="Resize proposed component" onPointerDown={event=>beginPlacement(event,true)} style={{position:'absolute',right:-5,bottom:-5,width:12,height:12,padding:0,border:'1px solid white',background:'#f5a623',cursor:'nwse-resize'}}/>}</div>}
    {!ready && <span role="status">{error || 'Rendering…'}</span>}
  </div>{ready && targetId && !highlight && <small>Element not visible at this time</small>}</figure>;
}
