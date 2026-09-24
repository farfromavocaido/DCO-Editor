// @ts-nocheck
'use client';
import {useState} from 'react';
import {useEditorStore} from '@/store/editor-store';
import {unionPresence} from '@/lib/timeline-presence';
import {updateStackEffects} from '@/lib/layer-stacks';
import {removeCanvasGroup} from '@/lib/canvas-groups';
export function TimelineVisibility({ids,label}){
 const hidden=useEditorStore(s=>s.hiddenLayerIds),solo=useEditorStore(s=>s.soloLayerIds);
 const allHidden=ids.every(id=>hidden.has(id));
 return <span className="timeline-visibility" style={{visibility:ids.length?'visible':'hidden'}} onClick={e=>e.stopPropagation()}>
  <button aria-label={`${allHidden?'Show':'Hide'} ${label} in preview`} aria-pressed={allHidden} title="Preview visibility only — exports are unchanged" onClick={()=>{const next=new Set(useEditorStore.getState().soloPreviousHidden||hidden);ids.forEach(id=>allHidden?next.delete(id):next.add(id));useEditorStore.setState({hiddenLayerIds:next,soloLayerIds:new Set(),soloPreviousHidden:null});}}>{allHidden?'◌':'◉'}</button>
  <button aria-label={`Solo ${label} in preview`} aria-pressed={ids.length===solo.size&&ids.every(id=>solo.has(id))} title="Solo in preview only" onClick={()=>useEditorStore.getState().togglePreviewSolo(ids)}>S</button>
 </span>;
}
export function PresenceTrack({spans=[],summary=false,motion=false,opacity=null}){
 return <>{unionPresence(spans).map((s,i)=>{
  const parts=opacity?.filter(p=>p.end>s.start&&p.start<s.end),gradient=parts?.length?`linear-gradient(to right, ${parts.flatMap(p=>{const a=Math.max(0,(p.start-s.start)/(s.end-s.start)*100),b=Math.min(100,(p.end-s.start)/(s.end-s.start)*100),color=`rgba(86,178,169,${Math.max(0,Math.min(1,p.value))*.55})`;return [`${color} ${a}%`,`${color} ${b}%`];}).join(', ')})`:undefined;
  return <span key={i} className={`timeline-presence ${summary?'is-summary':''} ${motion?'is-summary-motion':''}`} style={{left:`${s.start}%`,width:`${s.end-s.start}%`,background:gradient}} title="Present on canvas — measured from production preview"/>;
 })}</>;
}
export function TimelineFolder({entry,spans={},motionSpans=[],children,sidebar=false}){
 const collapsed=useEditorStore(s=>s.collapsedLayerStacks)||new Set(),open=!collapsed.has(entry.id),setOpen=value=>{const next=new Set(collapsed);if(value)next.delete(entry.id);else next.add(entry.id);useEditorStore.setState({collapsedLayerStacks:next});},[settings,setSettings]=useState(false),[error,setError]=useState(''),drop=useEditorStore(s=>s.timelineDropTarget),hidden=useEditorStore(s=>s.hiddenLayerIds),document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size);
 const ids=entry.layers.map(l=>l.id),label=entry.name||entry.label;
 const commitEffects=patch=>{if(Object.entries(patch).every(([k,v])=>entry.effects?.[k]===v))return;try{useEditorStore.getState().applyCreativeOwnershipDocument(updateStackEffects(document,size,entry.id,patch),'Updated stack controls');setError('');}catch(e){setError(e.message);}};
 const remove=()=>{
  if(entry.effects?.enabled&&(entry.effects.x||entry.effects.y||entry.effects.opacity!==1)){setSettings(true);setError('Reset stack X/Y to 0 and opacity to 100%, or switch off shared controls before ungrouping.');return;}
  let next;if(entry.canvas)next=removeCanvasGroup(document,size,entry.id);
  else next={...document,sizes:{...document.sizes,[size]:{...document.sizes[size],timelineFolders:(document.sizes[size].timelineFolders||[]).filter(g=>g.id!==entry.id)}}};
  useEditorStore.getState().applyCreativeOwnershipDocument(next,'Ungrouped timeline folder');
 };
 return <div className={`timeline-folder ${sidebar?'sidebar-stack':''}`}>
  <div data-stack-drop={entry.folder?entry.id:undefined} className={`timeline-row timeline-folder-heading ${drop?.stackId===entry.id?'is-stack-drop':''}`}><div className="timeline-row-label"><button className="timeline-folder-toggle" aria-expanded={open} onClick={()=>setOpen(!open)} title={entry.component?'Component — its parts are edited on the canvas':entry.canvas?'Canvas selection group':'Layer stack — shared with the layers sidebar'}>{open?'▾':'▸'} {label}</button><TimelineVisibility ids={ids} label={label}/>{entry.folder&&<button className="stack-settings-button" aria-label={`Controls for ${label}`} title="Stack name and optional shared properties" onClick={()=>setSettings(!settings)}>⋯</button>}{(entry.folder||entry.canvas)&&<button className="timeline-ungroup" title="Ungroup layers; non-default shared controls must be reset first" aria-label={`Ungroup ${label}`} onClick={remove}>↗</button>}</div><div className="timeline-track" hidden={sidebar}><PresenceTrack summary spans={ids.filter(id=>!hidden.has(id)).flatMap(id=>spans[id]||[])}/>{!open&&<PresenceTrack summary motion spans={motionSpans}/>}</div></div>
  {settings&&entry.folder&&<div className="stack-settings">
   <label>Name<input aria-label="Stack name" key={entry.name} defaultValue={entry.name} onBlur={e=>{if(!e.target.value.trim()||e.target.value===entry.name)return;const next=structuredClone(document);next.sizes[size].timelineFolders.find(g=>g.id===entry.id).name=e.target.value.trim();useEditorStore.getState().applyCreativeOwnershipDocument(next,'Renamed stack');}}/></label>
   <label className="stack-enable"><input type="checkbox" checked={Boolean(entry.effects?.enabled)} onChange={e=>commitEffects({enabled:e.target.checked})}/>Shared position and opacity</label>
   {entry.effects?.enabled&&<div className="stack-property-grid">{[['x','Stack X',1],['y','Stack Y',1],['opacity','Stack opacity (%)',100]].map(([field,label,multiplier])=><label key={field}>{label}<input aria-label={label} key={entry.effects[field]} type="number" step="any" defaultValue={entry.effects[field]*multiplier} onBlur={e=>{const value=Number(e.target.value)/multiplier;if(e.target.value.trim()&&Number.isFinite(value))commitEffects({[field]:value});}}/></label>)}</div>}
   {error&&<small role="alert">{error}</small>}
  </div>}
  {open&&children}
  {open&&entry.folder&&<div className={`stack-drop-zone ${drop?.stackId===entry.id?'is-stack-drop':''}`} data-stack-drop={entry.id}>Drop layers into {label}</div>}
 </div>;
}
export function NewTimelineFolder(){
 const create=()=>{const s=useEditorStore.getState(),document=s.creativeDocument;if(!document)return;const creative=document.sizes[s.size],next={...document,sizes:{...document.sizes,[s.size]:{...creative,timelineFolders:[...(creative.timelineFolders||[]),{id:`timeline-folder:${crypto.randomUUID()}`,name:`Stack ${(creative.timelineFolders||[]).length+1}`,members:[]}]}}};s.applyCreativeOwnershipDocument(next,'Added layer stack');};
 return <button title="Add an empty stack, then drag layers into it" onClick={create}>+ Stack</button>;
}
