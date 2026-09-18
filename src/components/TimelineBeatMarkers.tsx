// @ts-nocheck
'use client';
import {useState} from 'react';
import {beatLabel,keyTimelineBeats} from '@/lib/timeline-beats';
import {clipBeatReferences} from '@/lib/timeline-relationships';
export function TimelineBeatMarkers({document,beats,layers,all,onSelect}){
 const [hover,setHover]=useState(null),ids=all?Object.keys(beats):keyTimelineBeats(document,beats),groups=[];
 for(const id of ids.filter(id=>Number.isFinite(beats[id])&&beats[id]>=0&&beats[id]<=100).sort((a,b)=>beats[a]-beats[b])){
  const previous=groups.at(-1);if(previous&&beats[id]-previous.at<1.5)previous.ids.push(id);else groups.push({at:beats[id],ids:[id]});
 }
 const uses=id=>layers.filter(l=>(l.clips||[]).some(c=>clipBeatReferences(c,beats).includes(id))).map(l=>l.label||l.id);
 return <div className="timeline-beat-track" onPointerLeave={()=>setHover(null)}>
  {groups.map(g=><button key={g.ids.join(':')} className="timeline-beat-marker" style={{left:`${Math.min(98,g.at)}%`}} aria-label={`Beat ${g.ids.map(id=>beatLabel(document,id)).join(', ')}`} onPointerEnter={()=>setHover(g)} onFocus={()=>setHover(g)} onClick={()=>onSelect(g.ids[0])}>▾ <span>{beatLabel(document,g.ids[0])}{g.ids.length>1?` +${g.ids.length-1}`:''}</span></button>)}
  {!groups.length&&<small className="beat-empty">No key beats yet. Choose them in Edit beats.</small>}
  {hover&&<div className="beat-hover-card" style={{left:`clamp(0px, ${hover.at}%, max(0px, calc(100% - 240px)))`}}>{hover.ids.map(id=><div key={id}><button onClick={()=>onSelect(id)}>{beatLabel(document,id)} · {(beats[id]*document.clock.durationS/100).toFixed(2)}s</button><small>{uses(id).length?`Anchors: ${uses(id).join(', ')}`:'No clip references in this version'}</small></div>)}</div>}
 </div>;
}
