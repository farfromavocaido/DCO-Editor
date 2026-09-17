// @ts-nocheck
'use client';
import {revealLayoutTargets} from './LayoutAreaPanel';
import {useEffect,useState} from 'react';
import {useEditorStore,selectPreviewFeedRow} from '@/store/editor-store';
import {getProductionStage} from '@/lib/production-stage';
import {createResponsiveLayoutRuntime} from '@/lib/responsive-layout';
import {feedFieldForEditableTarget} from '@/lib/preview-utils';
import {findCreativeTarget} from '@/lib/creative-model';
import {campaignScopes} from '@/lib/campaign-variants';
import styles from './LayoutRulesPanel.module.css';
export const conditionLabels={'has-text':'has text','empty':'is empty','shown':'is shown','hidden':'is hidden','lines-at-least':'has at least this many fitted lines','lines-at-most':'has at most this many fitted lines','lines-equal':'has exactly this many fitted lines','height-at-least':'is at least this tall (px)'};
export function ContentPlacementControls({draft,patch,document,size,targetId,targets}){
 const [branch,setBranch]=useState('when'),[preview,setPreview]=useState(false);
 const moved=useEditorStore(s=>s.layoutPlacementDraft),row=useEditorStore(selectPreviewFeedRow);
 const c=draft.condition;
 const branchNames=c.test==='has-text'?['With text · A','Empty · B']:c.test==='empty'?['Empty · A','With text · B']:c.test==='shown'?['Shown · A','Not shown · B']:c.test==='hidden'?['Hidden · A','Shown · B']:c.test==='lines-at-least'?[`${c.value}+ lines · A`,'Fewer lines · B']:c.test==='lines-at-most'?[`Up to ${c.value} lines · A`,'More lines · B']:c.test==='lines-equal'?[`${c.value} lines · A`,'Other line counts · B']:['Taller · A','Shorter · B'];
 const values=(branch==='when'?draft.values:draft.otherwise)||{};
 const update=next=>patch({[branch==='when'?'values':'otherwise']:next});
 const capture=()=>{const stage=getProductionStage();if(!stage)return;const runtime=createResponsiveLayoutRuntime(stage.ownerDocument.defaultView),el=runtime.element(targetId);if(el){const css=stage.ownerDocument.defaultView.getComputedStyle(el);update({...values,left:parseFloat(css.left)||0,top:parseFloat(css.top)||0});}};
 useEffect(()=>{if(moved?.ruleId===draft.id){update({...values,left:moved.left,top:moved.top});useEditorStore.setState({layoutPlacementDraft:null});}},[moved]);
 useEffect(()=>{
  if(!preview){if(useEditorStore.getState().layoutPreview?.ruleId===draft.id)useEditorStore.setState({layoutPreview:null});return;}
  const rule={...draft,condition:undefined,otherwise:undefined,when:[],enabled:true,values,targets:[{size,targetId}]};
  const rules=(document.layoutRules||[]).filter(r=>r.id!==draft.id);
  const next={...document,layoutRules:Object.keys(values).length?[...rules,rule]:rules};
  const referenceLayer=document.sizes[size].layers.find(layer=>layer.id===c.targetId.split('::')[0]);
  const field=feedFieldForEditableTarget(referenceLayer,c.targetId);let previewRow=row;
  if(field&&['has-text','empty'].includes(c.test)){const empty=c.test==='has-text'?branch==='otherwise':branch==='when';previewRow={...row,[field]:empty?'':String(row[field]||'Preview text'),[`${field}_${size}`]:''};}
  const original=findCreativeTarget(document,size,targetId,campaignScopes(document,row))?.values||{};
  useEditorStore.setState({layoutPreview:{kind:'placement',document:next,row:previewRow,size,ruleId:draft.id,targetId,branch,left:Number(values.left??original.left)||0,top:Number(values.top??original.top)||0}});
  return()=>{if(useEditorStore.getState().layoutPreview?.ruleId===draft.id)useEditorStore.setState({layoutPreview:null});};
 },[preview,JSON.stringify(draft),branch,document,row,size,targetId]);
 return <>
 <fieldset><legend>When</legend>
 <label className={styles.field}>Element<select aria-label="Condition element" value={draft.condition.targetId} onChange={e=>patch({condition:{...draft.condition,targetId:e.target.value}})}><option value="">Choose an element…</option>{targets.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
 <label className={styles.field}>Condition<select aria-label="Element condition" value={draft.condition.test} onChange={e=>patch({condition:{...draft.condition,test:e.target.value,value:draft.condition.value??2}})}>{Object.entries(conditionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 {['lines-at-least','lines-at-most','lines-equal','height-at-least'].includes(draft.condition.test)&&<label className={styles.field}>{draft.condition.test.startsWith('lines')?'Fitted lines':'Height (px)'}<input aria-label="Condition threshold" type="number" min="0" step={draft.condition.test.startsWith('lines')?'1':'any'} value={draft.condition.value??2} onChange={e=>patch({condition:{...draft.condition,value:Number(e.target.value)}})}/></label>}
 </fieldset>
 <fieldset><legend>Placements</legend><div className={styles.actions} role="group" aria-label="Placement branch"><button type="button" aria-pressed={branch==='when'} onClick={()=>setBranch('when')}>{branchNames[0]}</button><button type="button" aria-pressed={branch==='otherwise'} onClick={()=>setBranch('otherwise')}>{branchNames[1]}</button></div>
 <div className={styles.grid}>{['left','top','width','height'].map(key=><label key={key} className={styles.field}>{({left:'X',top:'Y',width:'Width',height:'Height'})[key]}<input aria-label={`Placement ${key}`} type="number" step="any" placeholder="Keep original" value={values[key]??''} onChange={e=>{const next={...values};if(e.target.value==='')delete next[key];else next[key]=Number(e.target.value);update(next);}}/></label>)}</div>
 <div className={styles.actions}><button type="button" onClick={capture} title="Capture the element’s currently rendered X and Y">Use current position</button><button type="button" aria-pressed={preview} onClick={()=>{if(!preview)revealLayoutTargets([targetId]);setPreview(!preview);}}>{preview?'End preview':'Preview & place on canvas'}</button></div>
 {preview&&<span className={styles.note}>Preview only · drag the purple placement handle</span>}
 {branch==='otherwise'&&<button type="button" onClick={()=>update({})}>Use original placement for B</button>}
 </fieldset>
 </>;
}
