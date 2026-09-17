// @ts-nocheck
'use client';
import {exitSegments,transitionCases} from '@/lib/layout-transitions';
import styles from './LayoutRulesPanel.module.css';
export function LayoutTransitionControls({document,size,draft,patch,scopes}){
 const t=draft.transition,duration=Number(document.clock.durationS),items=draft.targets.filter(m=>m.size===size),layer=t&&document.sizes[size].layers.find(l=>l.id===t.subjectId?.split('::')[0]);
 const exits=t?.clipId?exitSegments(document,size,t.subjectId,t.clipId,scopes):[];
 const update=change=>patch({transition:{...t,...change}});
 let timing,error='';if(t?.clipId)try{timing=transitionCases(document,size,draft).find(c=>c.scopes.every(s=>scopes.includes(s)));}catch(e){error=e.message;}
 return <details className={styles.transition}><summary>Animate layout after an exit</summary>
 <label className={styles.checkbox}><input aria-label="Enable layout transition" type="checkbox" checked={Boolean(t&&t.enabled!==false)} onChange={e=>patch({transition:e.target.checked?(t?{...t,enabled:true}:{enabled:true,subjectId:items.at(-1)?.targetId,clipId:'',exitIndex:0,start:'with',duration:'follow',return:{mode:document.clock.loop?'animate':'none',startS:duration*.9,endS:duration}}):{...t,enabled:false}})}/>Link to a particular exit</label>
 {t&&t.enabled!==false&&<>
 <label className={styles.field}>Item leaving<select aria-label="Exiting layout item" value={t.subjectId} onChange={e=>update({subjectId:e.target.value,clipId:'',exitIndex:0})}>{items.map(m=><option key={m.targetId} value={m.targetId}>{document.sizes[size].layers.find(l=>l.id===m.targetId.split('::')[0])?.label||m.targetId}</option>)}</select></label>
 <label className={styles.field}>Exit animation<select aria-label="Layout exit animation" value={t.clipId} onChange={e=>update({clipId:e.target.value,exitIndex:0})}><option value="">Choose an animation…</option>{(layer?.clips||[]).filter(c=>exitSegments(document,size,t.subjectId,c.id,scopes).length).map(c=><option key={c.id} value={c.id}>{c.label||c.id}</option>)}</select></label>
 {exits.length>0&&<label className={styles.field}>Exit segment<select aria-label="Layout exit segment" value={t.exitIndex} onChange={e=>update({exitIndex:Number(e.target.value)})}>{exits.map((e,i)=><option key={i} value={i}>{(e.start*duration/100).toFixed(2)}–{(e.end*duration/100).toFixed(2)} seconds</option>)}</select></label>}
 <label className={styles.field}>Move remaining items<select aria-label="Layout transition start" value={t.start} onChange={e=>update({start:e.target.value})}><option value="with">During that exit</option><option value="after">After that exit</option></select></label>
 <label className={styles.field}>Duration<select aria-label="Layout transition duration" value={t.duration} onChange={e=>update({duration:e.target.value,durationS:t.durationS||.5})}><option value="follow">Follow the exit’s duration</option><option value="custom">Set duration</option></select></label>
 {t.duration==='custom'&&<label className={styles.field}>Seconds<input aria-label="Layout transition seconds" type="number" min="0.01" step="0.05" value={t.durationS} onChange={e=>update({durationS:Number(e.target.value)})}/></label>}
 <label className={styles.field}>Return to the starting layout<select aria-label="Layout return mode" value={t.return.mode} onChange={e=>update({return:{...t.return,mode:e.target.value,startS:e.target.value==='hidden'?duration:e.target.value==='animate'&&t.return.mode==='hidden'?Math.max(duration*.9,(timing?.end||0)*duration/100):t.return.startS}})}><option value="animate">Animate back before the end</option><option value="hidden">Reset while remaining items are hidden</option>{!document.clock.loop&&<option value="none">Stay in the new layout (no loop)</option>}</select></label>
 {t.return.mode!=='none'&&<div className={styles.grid}><label className={styles.field}>{t.return.mode==='hidden'?'Reset at (seconds)':'Return starts (seconds)'}<input aria-label="Layout return start" type="number" min="0" max={duration} step=".05" value={t.return.startS} onChange={e=>update({return:{...t.return,startS:Number(e.target.value)}})}/></label>{t.return.mode==='animate'&&<label className={styles.field}>Ends (seconds)<input aria-label="Layout return end" type="number" min="0" max={duration} step=".05" value={t.return.endS} onChange={e=>update({return:{...t.return,endS:Number(e.target.value)}})}/></label>}</div>}
 {timing&&<span className={styles.note}>Move {(timing.start*duration/100).toFixed(2)}–{(timing.end*duration/100).toFixed(2)}s · positions follow the fitted artwork</span>}
 <span className={styles.note} title="Space is reserved before the entrance. Empty or state-hidden items do not trigger a movement. Scrubbing and playback use the same timeline.">No opening movement · no movement when already alone</span>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 </>}
 </details>;
}
