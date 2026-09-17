// @ts-nocheck
'use client';
import {LayoutRulesPanel} from './LayoutRulesPanel';
import {validateLayoutRules} from '@/lib/layout-rules';
import {setCreativeOwnershipField} from '@/lib/creative-ownership';
import {findCreativeTarget} from '@/lib/creative-model';
import {useEditorStore} from '@/store/editor-store';
export function SelectedLayoutRules({document,size,targetId,scopes}){
 const diagnostics=useEditorStore(s=>s.layoutDiagnostics),select=useEditorStore(s=>s.selectLayoutRule),apply=useEditorStore(s=>s.applyCreativeOwnershipDocument);
 const change=next=>{validateLayoutRules(next);apply(next,'Updated layout rules');};
 const freeze=id=>{
  const rule=document.layoutRules.find(r=>r.id===id),diagnostic=diagnostics.find(d=>d.id===id&&d.size===size&&d.targetId===targetId&&d.status==='active');
  if(!rule||!diagnostic?.after)throw new Error('Wait for the active rule to finish rendering before freezing');
  const members=rule.targets.filter(m=>m.size===size&&m.targetId===targetId&&String(m.scope||'').split('.').filter(Boolean).every(s=>scopes.includes(s)));
  let next=structuredClone(document);next.layoutRules=next.layoutRules.flatMap(r=>r.id!==id?[r]:r.targets.filter(m=>!members.some(old=>JSON.stringify(old)===JSON.stringify(m))).length?[{...r,targets:r.targets.filter(m=>!members.some(old=>JSON.stringify(old)===JSON.stringify(m)))}]:[]);
  const fields=rule.type==='spacing'?[rule.axis==='x'?'left':'top']:Object.keys(rule.values);
  const effective=findCreativeTarget(document,size,targetId,scopes);
  for(const member of members)for(const field of fields)next=setCreativeOwnershipField(next,size,targetId,[...String(member.scope||'').split('.').filter(Boolean),...(rule.when||[])],'values',field,diagnostic.after[field]??effective.values[field]);
  change(next);select(null);
 };
 return <details className="inspector-section selected-layout-rules" open={undefined}><summary>Layout rules</summary><LayoutRulesPanel key={`${size}/${targetId}`} {...{document,size,targetId,scopes,diagnostics}} onChange={change} onSelectRule={select} onFreeze={freeze}/></details>;
}
