// @ts-nocheck
'use client';
import { useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import {linkedMotionMembers,clipBeatReferences} from '@/lib/timeline-relationships';
import { retimeTransition } from '@/lib/motion-transitions';
import { editableKeyframes } from '@/lib/keyframe-editing';

export function TimelineTransition({ layer, clip, transition:t, beats, context }) {
 const selected=useEditorStore(s=>s.selectedTransition),[preview,setPreview]=useState(null),dragged=useRef(false);
 const choose=()=>useEditorStore.getState().selectTransition(layer.id,clip.id,t.id,t.start);
 const document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size),beat=useEditorStore(s=>s.selectedBeatId);
 const linked=selected&&selected.layerId!==layer.id&&linkedMotionMembers(document,size,selected.layerId,selected.clipId).some(m=>m.layer.id===layer.id&&m.clip.id===clip.id)&&selected.id===t.id;
 const source=document?.sizes?.[size]?.layers.find(l=>l.id===selected?.layerId)?.clips.find(c=>c.id===selected?.clipId);
 const refs=clipBeatReferences(clip,beats),timing=beat?refs.includes(beat):source&&selected.layerId!==layer.id&&clipBeatReferences(source,beats).some(id=>refs.includes(id));
 const raw=layer.clips.find(c=>c.id===clip.id)||clip;
 const commit=(start,end)=>{try{useEditorStore.getState().replaceEditorClip(layer.id,clip.id,retimeTransition(raw,t,start,end,beats,context));}catch(e){useEditorStore.getState().setStatus(e.message,'error');}};
 const down=(mode,event)=>{
  if(event.button!==0)return;event.stopPropagation();event.preventDefault();choose();dragged.current=false;
  const track=event.currentTarget.closest('.timeline-track'),rect=track?.getBoundingClientRect();if(!rect?.width)return;
  const frames=editableKeyframes(raw,beats,context),i=frames.findIndex(f=>f.index===t.fromIndex);
  const low=i?frames[i-1].at+.001:0,high=i+2<frames.length?frames[i+2].at-.001:100;
  const origin=event.clientX;let start=t.start,end=t.end;
  const move=e=>{if(Math.abs(e.clientX-origin)>2)dragged.current=true;const delta=(e.clientX-origin)/rect.width*100;
   if(mode==='move'){const shift=Math.max(low-t.start,Math.min(high-t.end,delta));start=t.start+shift;end=t.end+shift;}
   else if(mode==='start')start=Math.max(low,Math.min(t.end-.001,t.start+delta));
   else end=Math.max(t.start+.001,Math.min(high,t.end+delta));
   setPreview({start,end});useEditorStore.getState().setPercent(mode==='end'?end:start);
  };
  const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);setPreview(null);};
  const up=()=>{cleanup();if(dragged.current)commit(start,end);};
  const cancel=()=>{cleanup();useEditorStore.getState().setPercent(t.start);};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
 };
 const active=selected?.layerId===layer.id&&selected?.clipId===clip.id&&selected?.id===t.id;
 const label=`${layer.label||layer.id}: ${t.label}, ${(t.start*context.durationS/100).toFixed(2)}–${(t.end*context.durationS/100).toFixed(2)} seconds`;
 return <div className={`timeline-transition ${active?'is-selected':''} ${linked?'is-motion-related':''} ${timing?'is-timing-related':''}`} style={{left:`${preview?.start??t.start}%`,width:`${(preview?.end??t.end)-(preview?.start??t.start)}%`}}>
  <button className="transition-body" aria-label={label} title={label} aria-pressed={active} onPointerDown={e=>down('move',e)} onClick={e=>{e.stopPropagation();if(!dragged.current)choose();dragged.current=false;}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();choose();const delta=(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1);commit(t.start+delta,t.end+delta);}}>{t.label}</button>
  {['start','end'].map(edge=><button key={edge} className={`transition-handle transition-handle-${edge}`} aria-label={`Resize ${edge} of ${label}`} title={`Drag to change ${edge==='end'?'duration':'start'}`} onPointerDown={e=>down(edge,e)} onClick={e=>{e.stopPropagation();if(!dragged.current)choose();dragged.current=false;}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();choose();const delta=(e.key==='ArrowLeft'?-1:1)*.1;commit(t.start+(edge==='start'?delta:0),t.end+(edge==='end'?delta:0));}}/>)}
 </div>;
}
