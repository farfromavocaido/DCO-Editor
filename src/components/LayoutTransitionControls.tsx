// @ts-nocheck
'use client';
import {useState} from 'react';
import {exitSegments,layoutAnimations,layoutSequenceCases} from '@/lib/layout-transitions';
import {useEditorStore} from '@/store/editor-store';
import styles from './LayoutRulesPanel.module.css';

export function LayoutTransitionControls({document,size,draft,patch,scopes}){
 const [expanded,setExpanded]=useState(null);
 const entries=layoutAnimations(draft),duration=Number(document.clock.durationS),items=draft.targets.filter(m=>m.size===size);
 const name=id=>document.sizes[size].layers.find(l=>l.id===id?.split('::')[0])?.label||id;
 const write=next=>patch({transition:undefined,layoutAnimations:next});
 const update=(id,values)=>patch({transition:undefined,layoutAnimations:entries.map(a=>a.id===id?{...a,...values}:a),...(values.kind==='enter'?{startingArrangement:'present'}:{})});
 let error='',events=[];
 try{events=layoutSequenceCases(document,size,draft).find(c=>c.scopes.every(s=>scopes.includes(s)))?.events||[];}catch(e){error=e.message;}
 const ordered=[...entries].sort((a,b)=>(events.find(e=>e.id===a.id)?.start??Infinity)-(events.find(e=>e.id===b.id)?.start??Infinity));
 const add=()=>{const id=crypto.randomUUID();write([...entries,{id,enabled:true,kind:'exit',subjectId:items.at(-1)?.targetId,clipId:'',segmentIndex:0,start:'with',duration:'follow',durationS:.5}]);setExpanded(id);};
 return <details className={styles.transition} open><summary>Layout animations {entries.length?`(${entries.length})`:''}</summary>
 {entries.some(a=>a.kind==='enter'&&a.enabled!==false)&&<label className={styles.field}>Before linked entrances<select value={draft.startingArrangement||'all'} onChange={e=>patch({startingArrangement:e.target.value,transition:undefined,layoutAnimations:entries})} title="This controls the other items’ positions before a linked entrance. It does not change the entering item’s own fade or movement."><option value="all">Leave space ready — no rearranging</option><option value="present">Make room as items enter</option></select></label>}
 {ordered.map(a=>{
  const layer=document.sizes[size].layers.find(l=>l.id===a.subjectId?.split('::')[0]),segments=a.kind==='return'?[]:exitSegments(document,size,a.subjectId||'',a.clipId,scopes,a.kind),timing=events.find(e=>e.id===a.id);
  const label=a.kind==='return'?(a.hidden?'Reset to starting layout':'Return to starting layout'):`${name(a.subjectId)} ${a.kind==='enter'?'enters':'exits'}`;
  return <article className={styles.animationCard} key={a.id}>
   <div className={styles.animationHeader}><input type="checkbox" aria-label={`Enable ${label}`} checked={a.enabled!==false} onChange={e=>update(a.id,{enabled:e.target.checked})}/><button type="button" className={styles.animationTitle} aria-expanded={expanded===a.id} onClick={()=>setExpanded(expanded===a.id?null:a.id)}>{label}<small>{a.enabled===false?'Disabled':timing?`${(timing.start*duration/100).toFixed(2)}–${(timing.end*duration/100).toFixed(2)}s`:'Choose timing'}</small></button><button type="button" title="Preview halfway through this move" aria-label={`Preview ${label}`} disabled={!timing||Boolean(error)||a.enabled===false} onClick={()=>useEditorStore.getState().setPercent((timing.start+timing.end)/2)}>▶</button></div>
   {expanded===a.id&&<div className={styles.animationFields}>
    <label className={styles.field}>Change<select value={a.kind} onChange={e=>update(a.id,{kind:e.target.value,clipId:'',segmentIndex:0,startS:duration*.9,endS:duration,hidden:false})}><option value="enter">Make room on entrance</option><option value="exit">Rearrange on exit</option><option value="return">Return to starting layout</option></select></label>
    {a.kind==='enter'&&draft.startingArrangement!=='present'&&<button type="button" title="Space is already reserved, so this entrance may not move the other items." onClick={()=>patch({startingArrangement:'present',transition:undefined,layoutAnimations:entries})}>Enable room-making on entrance</button>}
    {a.kind!=='return'?<>
     <label className={styles.field}>Linked item<select value={a.subjectId} onChange={e=>update(a.id,{subjectId:e.target.value,clipId:'',segmentIndex:0})}>{items.map(m=><option key={m.targetId} value={m.targetId}>{name(m.targetId)}</option>)}</select></label>
     <label className={styles.field}>Animation<select value={a.clipId} onChange={e=>update(a.id,{clipId:e.target.value,segmentIndex:0})}><option value="">Choose an animation…</option>{(layer?.clips||[]).filter(c=>exitSegments(document,size,a.subjectId,c.id,scopes,a.kind).length).map(c=><option key={c.id} value={c.id}>{c.label||c.id}</option>)}</select></label>
     {segments.length>0&&<label className={styles.field}>{a.kind==='enter'?'Entrance':'Exit'} segment<select value={a.segmentIndex} onChange={e=>update(a.id,{segmentIndex:Number(e.target.value)})}>{segments.map((s,i)=><option key={i} value={i}>{(s.start*duration/100).toFixed(2)}–{(s.end*duration/100).toFixed(2)} seconds</option>)}</select></label>}
     <label className={styles.field}>Move other items<select value={a.start} onChange={e=>update(a.id,{start:e.target.value})}><option value="before">Before it</option><option value="with">During it</option><option value="after">After it</option></select></label>
     <label className={styles.field}>Duration<select value={a.duration} onChange={e=>update(a.id,{duration:e.target.value,durationS:a.durationS||.5})}><option value="follow">Follow the linked animation</option><option value="custom">Set duration</option></select></label>
     {a.duration==='custom'&&<label className={styles.field}>Seconds<input type="number" min=".01" step=".05" value={a.durationS} onChange={e=>update(a.id,{durationS:Number(e.target.value)})}/></label>}
    </>:<>
     <label className={styles.field}>Return style<select value={a.hidden?'hidden':'animate'} onChange={e=>update(a.id,{hidden:e.target.value==='hidden'})}><option value="animate">Animate back</option><option value="hidden">Reset while hidden</option></select></label>
     <div className={styles.grid}><label className={styles.field}>{a.hidden?'Reset at':'Start'} (seconds)<input type="number" min="0" max={duration} step=".05" value={a.startS} onChange={e=>update(a.id,{startS:Number(e.target.value)})}/></label>{!a.hidden&&<label className={styles.field}>End (seconds)<input type="number" min="0" max={duration} step=".05" value={a.endS} onChange={e=>update(a.id,{endS:Number(e.target.value)})}/></label>}</div>
    </>}
    <div className={styles.actions}><button type="button" onClick={()=>{const id=crypto.randomUUID();write([...entries,{...a,id,enabled:false}]);setExpanded(id);}} title="Creates a disabled copy so you can choose its timing">Duplicate</button><button type="button" onClick={()=>write(entries.filter(e=>e.id!==a.id))}>Remove</button></div>
   </div>}
  </article>;
 })}
 <button type="button" className={styles.primary} onClick={add}>+ Add animation</button>
 <span className={styles.note} title="Without a return, the final arrangement holds until the ad ends. A looping ad restarts in its opening arrangement.">Return is optional ⓘ</span>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 </details>;
}
