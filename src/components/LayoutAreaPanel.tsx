// @ts-nocheck
'use client';
import {LayoutTransitionControls} from './LayoutTransitionControls';
import {useEffect,useState} from 'react';
import {useEditorStore,selectPreviewFeedRow} from '@/store/editor-store';
import {getProductionStage,withProductionRestPose,unionProductionBounds,seekProductionAnimations} from '@/lib/production-stage';
import {createResponsiveLayoutRuntime} from '@/lib/responsive-layout';
import {setCreativeOwnershipField} from '@/lib/creative-ownership';
import {validateLayoutRules} from '@/lib/layout-rules';
import {campaignVariantModel} from '@/lib/campaign-variants';
import {findCreativeTarget} from '@/lib/creative-model';
import styles from './LayoutRulesPanel.module.css';

export function revealLayoutTargets(ids){
 const stage=getProductionStage();if(!stage)return;
 const state=useEditorStore.getState(),runtime=createResponsiveLayoutRuntime(stage.ownerDocument.defaultView),doc=stage.ownerDocument,duration=Number(state.creativeDocument.clock?.durationS||15);
 const eligible=withProductionRestPose(stage,()=>ids.filter(id=>{const el=runtime.element(id);return el&&runtime.ink(el);}));if(!eligible.length)return;
 const score=()=>{const visible=eligible.map(id=>{let node=runtime.element(id),opacity=1;while(node&&node!==doc.documentElement){const css=doc.defaultView.getComputedStyle(node);if(css.display==='none'||css.visibility==='hidden')return false;opacity*=Number(css.opacity);node=node.parentElement;}return opacity>=.98;});return visible.filter(Boolean).length+(visible[0] ? .25 : 0);};
 let best=state.percent,bestScore=score();
 if(bestScore<eligible.length+.25)for(let at=0;at<=100;at++){seekProductionAnimations(doc,at,duration);const value=score();if(value>bestScore){best=at;bestScore=value;}if(value===eligible.length+.25)break;}
 seekProductionAnimations(doc,best,duration);state.setPercent(best);useEditorStore.setState({layoutTimingNotice:bestScore<eligible.length?{ids}:null});
}

export function captureLayoutSelection(ids){
 const stage=getProductionStage();if(!stage)throw new Error('Wait for the preview to finish rendering');
 return withProductionRestPose(stage,()=>{const runtime=createResponsiveLayoutRuntime(stage.ownerDocument.defaultView),origin=stage.getBoundingClientRect();return ids.map(id=>{const el=runtime.element(id),ink=el&&runtime.ink(el);return {id,ink:ink?{left:ink.left-origin.left,top:ink.top-origin.top,width:ink.width,height:ink.height}:null};});});
}
export function LayoutAreaPanel({document,size,targetIds,scopes,diagnostics,onChange,onSelectRule}){
 const [draft,setDraft]=useState(null),[error,setError]=useState('');
 const timing=useEditorStore(s=>s.layoutTimingNotice);
 const row=useEditorStore(selectPreviewFeedRow);
 const areaDraft=useEditorStore(s=>s.layoutAreaDraft);
 useEffect(()=>()=>{if(useEditorStore.getState().layoutAreaDraft?.ruleId===draft?.id)useEditorStore.setState({layoutAreaDraft:null});},[draft?.id]);
 const currentVersion=campaignVariantModel(document).dimensions.filter(d=>!d.derived).flatMap(d=>d.options.filter(o=>scopes.includes(o.scope)).map(o=>o.scope));
 const scopeLabel=when=>(when||[]).map(scope=>{const dimension=campaignVariantModel(document).dimensions.find(d=>d.options.some(o=>o.scope===scope));return dimension?`${dimension.label}: ${dimension.options.find(o=>o.scope===scope).label}`:scope;}).join(' · ');
 const name=id=>findCreativeTarget(document,size,id,[])?.label||id;
 const rules=(document.layoutRules||[]).filter(r=>r.type==='distribute'&&r.targets.some(t=>t.size===size&&targetIds.includes(t.targetId)));
 const clear=()=>{setDraft(null);useEditorStore.setState({layoutAreaDraft:null});};
 const edit=rule=>{revealLayoutTargets(rule.targets.filter(t=>t.size===size).map(t=>t.targetId));setDraft(structuredClone(rule));useEditorStore.setState({layoutAreaDraft:{ruleId:rule.id,size,area:rule.areas[size]}});onSelectRule?.(rule.id);setError('');};
 const create=()=>{try{const measured=captureLayoutSelection(targetIds),bounds=unionProductionBounds(measured.map(x=>x.ink).filter(Boolean));if(!bounds)throw new Error('Select at least one element with visible artwork');
  const sorted=[...measured].sort((a,b)=>(a.ink?.top??Infinity)-(b.ink?.top??Infinity));
  edit({id:crypto.randomUUID(),name:`Layout area ${1+(document.layoutRules||[]).filter(r=>r.type==='distribute').length}`,type:'distribute',enabled:true,targets:sorted.map(x=>({size,targetId:x.id})),areas:{[size]:{...bounds,width:Math.max(1,bounds.width),height:Math.max(1,bounds.height)}},axis:'y',single:'center',crossAlign:'center',minGap:0,overflow:'authored',when:currentVersion});
 }catch(e){setError(e.message);}};
 const publish=next=>{try{onChange({...document,layoutRules:next});setError('');return true;}catch(e){setError(e.message);return false;}};
 const detach=rule=>{try{
  let next=structuredClone(document);const removed=rule.targets.filter(t=>t.size===size&&targetIds.includes(t.targetId));
  next.layoutRules=next.layoutRules.flatMap(r=>{if(r.id!==rule.id)return[r];const targets=r.targets.filter(t=>!removed.some(m=>m.size===t.size&&m.targetId===t.targetId));return targets.length?[{...r,targets}]:[];});
  const fields=rule.crossAlign&&rule.crossAlign!=='keep'?['left','top']:[rule.axis==='x'?'left':'top'];
  for(const field of fields)for(const member of removed){const result=diagnostics.find(d=>d.id===rule.id&&d.targetId===member.targetId&&d.status==='active');if(result?.after)next=setCreativeOwnershipField(next,size,member.targetId,scopes,'values',field,result.after[field]);}
  onChange(next);setError('');
 }catch(e){setError(e.message);}};
 const area=draft?(areaDraft?.ruleId===draft.id?areaDraft.area:draft.areas[size]):null;
 const patch=values=>setDraft({...draft,...values});
 useEffect(()=>{
  if(!draft)return;const rule={...draft,areas:{...draft.areas,[size]:area}};const all=document.layoutRules||[];
  const next={...document,layoutRules:all.some(r=>r.id===rule.id)?all.map(r=>r.id===rule.id?rule:r):[...all,rule]};
  try{validateLayoutRules(next);setError('');useEditorStore.setState({layoutPreview:{kind:'area',ruleId:rule.id,size,document:next,row}});}catch(e){setError(e.message);}
  return()=>{if(useEditorStore.getState().layoutPreview?.ruleId===rule.id)useEditorStore.setState({layoutPreview:null});};
 },[JSON.stringify(draft),JSON.stringify(area),document,size,row]);
 const alreadyArranged=rules.some(r=>r.enabled&&(r.when||[]).every(scope=>scopes.includes(scope)));

 if(targetIds.length===1&&!rules.length&&!draft)return null;
 return <div className={styles.panel}>
 {targetIds.length>1&&timing&&targetIds.every(id=>timing.ids.includes(id))&&<span className={styles.note} title="These items do not appear together in the animation. Layout uses their resting artwork so spacing does not jump during fades. The timeline is showing the first item.">Different animation times ⓘ</span>}
 {rules.map(rule=><article key={rule.id} className={styles.rule}>
  <div className={styles.ruleHeader}><button className={styles.ruleTitle} onClick={()=>{revealLayoutTargets(rule.targets.filter(t=>t.size===size).map(t=>t.targetId));onSelectRule?.(rule.id);}}>{rule.name}</button><span className={styles.status}>{!rule.enabled?'Disabled':diagnostics.some(d=>d.id===rule.id&&d.status==='active')?'Automatic':'Inactive'}</span></div>
  {rule.transition&&<span className={styles.note}>{rule.transition.enabled===false?'Exit transition disabled':'Linked to an exit animation'}</span>}
  <span>{rule.targets.filter(t=>t.size===size).map(t=>name(t.targetId)).join(' + ')}</span>
  <span className={styles.note} title={scopeLabel(rule.when)}>{rule.when?.length?'Limited to chosen campaign settings':'All versions in this size'}</span><span className={styles.note}>{rule.axis==='y'?'Spread top to bottom':'Spread left to right'} · One item: {rule.single==='center'?'centre':rule.single==='start'?'start':'end'}</span>
  {diagnostics.filter(d=>d.id===rule.id&&d.message).slice(0,1).map(d=><p className={styles.error} key={d.targetId}>{d.message}</p>)}
  <div className={styles.actions}><button onClick={()=>edit(rule)}>Edit area</button><button onClick={()=>publish((document.layoutRules||[]).map(r=>r.id===rule.id?{...r,enabled:!r.enabled}:r))}>{rule.enabled?'Disable':'Enable'}</button><button title="Remove selected items from this layout, keeping their current positions" onClick={()=>detach(rule)}>Detach selected</button><button title="Remove this layout; restore the elements’ original positions" onClick={()=>publish(document.layoutRules.filter(r=>r.id!==rule.id))}>Remove layout</button></div>
 </article>)}
 {!draft&&<button className={styles.primary} disabled={alreadyArranged} title={alreadyArranged?"Edit the existing area, or detach these items before creating another layout":"Arrange the selected artwork inside a fixed area"} onClick={create}>{targetIds.length>1?'Arrange selected items…':'Create layout area…'}</button>}
 {draft&&<form className={styles.draft} onSubmit={e=>{e.preventDefault();const rule={...draft,areas:{...draft.areas,[size]:area}};const all=document.layoutRules||[];if(publish(all.some(r=>r.id===rule.id)?all.map(r=>r.id===rule.id?rule:r):[...all,rule])){clear();onSelectRule?.(rule.id);}}}>
 <strong>Arrange in an area</strong>
 <label className={styles.field}>Applies to<select aria-label="Layout versions" value={!draft.when?.length?'all':[...draft.when].sort().join('.')===[...currentVersion].sort().join('.')?'current':'stored'} onChange={e=>patch({when:e.target.value==='current'?currentVersion:e.target.value==='all'?[]:draft.when})}><option value="stored">Keep existing version limits</option><option value="current">This campaign version</option><option value="all">All versions in this size</option></select></label>
 
 <label className={styles.field}>Direction<select aria-label="Layout direction" value={draft.axis} onChange={e=>patch({axis:e.target.value})}><option value="y">Vertical · spread top to bottom</option><option value="x">Horizontal · spread left to right</option></select></label>
 <label className={styles.field}>{draft.axis==='y'?'Horizontal alignment':'Vertical alignment'}<select aria-label="Layout alignment" value={draft.crossAlign||'keep'} onChange={e=>patch({crossAlign:e.target.value})}><option value="keep">Keep existing positions</option><option value="start">{draft.axis==='y'?'Left':'Top'}</option><option value="center">Centre</option><option value="end">{draft.axis==='y'?'Right':'Bottom'}</option></select></label>
 <ol className={styles.memberList} aria-label="Layout order">{draft.targets.filter(t=>t.size===size).map((t,i,items)=><li key={t.targetId}><span>{name(t.targetId)}</span><button type="button" aria-label={`Move ${name(t.targetId)} earlier`} disabled={!i} onClick={()=>{const targets=[...draft.targets],at=targets.indexOf(t);[targets[at-1],targets[at]]=[targets[at],targets[at-1]];patch({targets});}}>↑</button><button type="button" aria-label={`Move ${name(t.targetId)} later`} disabled={i===items.length-1} onClick={()=>{const targets=[...draft.targets],at=targets.indexOf(t);[targets[at+1],targets[at]]=[targets[at],targets[at+1]];patch({targets});}}>↓</button><button type="button" aria-label={`Remove ${name(t.targetId)} from layout`} disabled={draft.targets.length===1} onClick={()=>patch({targets:draft.targets.filter(item=>item!==t)})}>×</button></li>)}</ol>
 <select aria-label="Add layout item" value="" onChange={e=>patch({targets:[...draft.targets,{size,targetId:e.target.value}]})}><option value="">Add another item…</option>{document.sizes[size].layers.filter(layer=>!draft.targets.some(t=>t.size===size&&t.targetId===layer.id)).map(layer=><option key={layer.id} value={layer.id}>{layer.label||layer.id}</option>)}</select>
 <span className={styles.note} title="Only visible ink is distributed. Empty text and state-hidden elements leave the layout. Animation fades do not alter it.">Visible artwork only · skip empty items</span>
 <label className={styles.field}>When one item remains<select aria-label="Single item placement" value={draft.single} onChange={e=>patch({single:e.target.value})}><option value="center">Centre {draft.axis==='y'?'vertically':'horizontally'}</option><option value="start">At the {draft.axis==='y'?'top':'left'}</option><option value="end">At the {draft.axis==='y'?'bottom':'right'}</option></select></label>
 <details><summary title="Drag the purple outline or its corner on the canvas. The area stays this size when content disappears.">Layout area</summary><div className={styles.grid}>{['left','top','width','height'].map(key=><label className={styles.field} key={key}>{({left:'X',top:'Y',width:'Width',height:'Height'})[key]}<input aria-label={`Layout area ${key}`} type="number" step="any" value={Math.round(area[key]*10)/10} onChange={e=>useEditorStore.setState({layoutAreaDraft:{ruleId:draft.id,size,area:{...area,[key]:Number(e.target.value)}}})}/></label>)}</div></details>
 <LayoutTransitionControls {...{document,size,draft,patch,scopes}}/>
 <details><summary>Spacing limits & name</summary><label className={styles.field}>Name<input value={draft.name} onChange={e=>patch({name:e.target.value})}/></label><label className={styles.field}>Minimum gap (px)<input aria-label="Minimum gap" type="number" min="0" value={draft.minGap} onChange={e=>patch({minGap:Number(e.target.value)})}/></label>
 <label className={styles.field}>If there isn’t enough room<select aria-label="Layout overflow" value={draft.overflow} onChange={e=>patch({overflow:e.target.value})}><option value="authored">Keep original positions and flag it</option><option value="extend">Keep minimum gap; extend beyond area</option></select></label></details>
 <div className={styles.actions}><button className={styles.primary} type="submit">Apply layout</button><button type="button" onClick={clear}>Cancel</button></div>
 </form>}{error&&<p role="alert" className={styles.error}>{error}</p>}
 </div>;
}
