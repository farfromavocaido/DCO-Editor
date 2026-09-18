// @ts-nocheck
'use client';
import {useState} from 'react';
import {useEditorStore} from '@/store/editor-store';
import {unionPresence} from '@/lib/timeline-presence';
import {removeCanvasGroup} from '@/lib/canvas-groups';
export function TimelineVisibility({ids,label}){
 const hidden=useEditorStore(s=>s.hiddenLayerIds),solo=useEditorStore(s=>s.soloLayerIds);
 const allHidden=ids.every(id=>hidden.has(id));
 return <span className="timeline-visibility" onClick={e=>e.stopPropagation()}>
  <button aria-label={`${allHidden?'Show':'Hide'} ${label} in preview`} aria-pressed={allHidden} title="Preview visibility only — exports are unchanged" onClick={()=>{const next=new Set(useEditorStore.getState().soloPreviousHidden||hidden);ids.forEach(id=>allHidden?next.delete(id):next.add(id));useEditorStore.setState({hiddenLayerIds:next,soloLayerIds:new Set(),soloPreviousHidden:null});}}>{allHidden?'◌':'◉'}</button>
  <button aria-label={`Solo ${label} in preview`} aria-pressed={ids.length===solo.size&&ids.every(id=>solo.has(id))} title="Solo in preview only" onClick={()=>useEditorStore.getState().togglePreviewSolo(ids)}>S</button>
 </span>;
}
export function PresenceTrack({spans=[],summary=false,motion=false}){return <>{unionPresence(spans).map((s,i)=><span key={i} className={`timeline-presence ${summary?'is-summary':''} ${motion?'is-summary-motion':''}`} style={{left:`${s.start}%`,width:`${s.end-s.start}%`}} title="Present on canvas (production preview, 20 ms precision)"/>)}</>;}
export function TimelineFolder({entry,spans,motionSpans=[],children}){
 const [open,setOpen]=useState(true),hidden=useEditorStore(s=>s.hiddenLayerIds),document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size);
 const ids=entry.layers.map(l=>l.id),label=entry.name||entry.label;
 const remove=()=>{
  let next;if(entry.canvas)next=removeCanvasGroup(document,size,entry.id);
  else next={...document,sizes:{...document.sizes,[size]:{...document.sizes[size],timelineFolders:(document.sizes[size].timelineFolders||[]).filter(g=>g.id!==entry.id)}}};
  useEditorStore.getState().applyCreativeOwnershipDocument(next,'Ungrouped timeline folder');
 };
 return <div className="timeline-folder">
  <div className="timeline-row timeline-folder-heading"><div className="timeline-row-label"><button className="timeline-folder-toggle" aria-expanded={open} onClick={()=>setOpen(!open)} title={entry.canvas?'Canvas group':'Timeline folder — organisation only'}>{open?'▾':'▸'} {label}</button><TimelineVisibility ids={ids} label={label}/>{(entry.folder||entry.canvas)&&<button className="timeline-ungroup" title="Ungroup without changing layout or motion" aria-label={`Ungroup ${label}`} onClick={remove}>↗</button>}</div><div className="timeline-track"><PresenceTrack summary spans={ids.filter(id=>!hidden.has(id)).flatMap(id=>spans[id]||[])}/>{!open&&<PresenceTrack summary motion spans={motionSpans}/>}</div></div>
  {open&&children}
 </div>;
}
export function NewTimelineFolder(){
 const [editing,setEditing]=useState(false),[name,setName]=useState(''),[error,setError]=useState('');
 const ids=useEditorStore(s=>s.selectedTargetIds),document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size);
 const create=()=>{
  const members=ids.filter(id=>document.sizes[size].layers.some(l=>l.id===id));
  if(members.length<2){setError('Select at least two layers with Shift or ⌘ click.');return;}
  const creative=document.sizes[size];if((creative.timelineFolders||[]).some(g=>g.members.some(id=>members.includes(id)))){setError('Ungroup existing folders before regrouping their layers.');return;}
  const next={...document,sizes:{...document.sizes,[size]:{...creative,timelineFolders:[...(creative.timelineFolders||[]),{id:`timeline-folder:${crypto.randomUUID()}`,name:name.trim()||'Layer group',members}]}}};
  useEditorStore.getState().applyCreativeOwnershipDocument(next,'Grouped timeline layers');setEditing(false);setName('');setError('');
 };
 return <><button title="Shift or ⌘ click layer names, then group them. Organisation only." onClick={()=>setEditing(!editing)}>Group…</button>{editing&&<div className="timeline-group-editor"><input aria-label="Timeline group name" placeholder="Group name" value={name} onChange={e=>setName(e.target.value)}/><button onClick={create}>Group selected</button><button onClick={()=>setEditing(false)}>Cancel</button>{error&&<small role="alert">{error}</small>}</div>}</>;
}
