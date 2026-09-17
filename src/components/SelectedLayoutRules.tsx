// @ts-nocheck
'use client';
import {LayoutContentPreview} from './LayoutContentPreview';
import {LayoutAreaPanel} from './LayoutAreaPanel';
import {LayoutRulesPanel} from './LayoutRulesPanel';
import {validateLayoutRules} from '@/lib/layout-rules';
import {setCreativeOwnershipField} from '@/lib/creative-ownership';
import {findCreativeTarget} from '@/lib/creative-model';
import {useEditorStore} from '@/store/editor-store';
export function SelectedLayoutRules({document,size,targetId,targetIds=[targetId],scopes}){
 const panelOpen=useEditorStore(s=>s.layoutRulesOpen);
 const diagnostics=useEditorStore(s=>s.layoutDiagnostics),select=useEditorStore(s=>s.selectLayoutRule),apply=useEditorStore(s=>s.applyCreativeOwnershipDocument);
 const change=next=>{validateLayoutRules(next);apply(next,'Updated layout rules');};
 const freeze=id=>{
  const rule=document.layoutRules.find(r=>r.id===id),diagnostic=diagnostics.find(d=>d.id===id&&d.size===size&&d.targetId===targetId&&d.status==='active');
  if(!rule||!diagnostic?.after)throw new Error('Wait for the active rule to finish rendering before freezing');
  const members=rule.targets.filter(m=>m.size===size&&m.targetId===targetId&&String(m.scope||'').split('.').filter(Boolean).every(s=>scopes.includes(s)));
  let next=structuredClone(document);next.layoutRules=next.layoutRules.flatMap(r=>r.id!==id?[r]:r.targets.filter(m=>!members.some(old=>JSON.stringify(old)===JSON.stringify(m))).length?[{...r,targets:r.targets.filter(m=>!members.some(old=>JSON.stringify(old)===JSON.stringify(m)))}]:[]);
  const fields=rule.type!=='conditional'?[rule.axis==='x'?'left':'top']:Object.keys(diagnostic.values||rule.values);
  const effective=findCreativeTarget(document,size,targetId,scopes);
  for(const member of members)for(const field of fields)next=setCreativeOwnershipField(next,size,targetId,[...String(member.scope||'').split('.').filter(Boolean),...(rule.when||[])],'values',field,diagnostic.after[field]??diagnostic.values?.[field]??effective.values[field]);
  change(next);select(null);
 };
 return <details className="inspector-section selected-layout-rules" open={Boolean(panelOpen)} onToggle={e=>{if(e.currentTarget.open!==useEditorStore.getState().layoutRulesOpen)useEditorStore.setState({layoutRulesOpen:e.currentTarget.open});}}><summary>Layout rules</summary><LayoutAreaPanel key={`${useEditorStore.getState().activeCampaignId}/${size}`} {...{document,size,targetIds,scopes,diagnostics}} onChange={change} onSelectRule={select}/>{targetIds.length===1&&<LayoutRulesPanel key={`${size}/${targetId}`} {...{document,size,targetId,scopes,diagnostics}} onChange={change} onSelectRule={select} onFreeze={freeze}/>}{targetIds.length>1&&<label className="layout-member-condition">Conditional placement for<select aria-label="Conditional placement item" value="" onChange={e=>{useEditorStore.getState().setCanvasSelection(e.target.value,[e.target.value]);useEditorStore.setState({layoutRulesOpen:true,layoutRuleStart:e.target.value});}}><option value="">Choose an item…</option>{targetIds.map(id=><option key={id} value={id}>{findCreativeTarget(document,size,id,scopes)?.label||id}</option>)}</select></label>}<LayoutContentPreview document={document} size={size}/></details>;
}
