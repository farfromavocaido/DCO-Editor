'use client';
import { useEffect, useState } from 'react';
import { campaignVariantModel, isGenericCampaign, validateCampaignStateEdit, type CampaignCondition } from '@/lib/campaign-variants';
import { useEditorStore } from '@/store/editor-store';

const stateDraft = (document:any) => {const model=structuredClone(campaignVariantModel(document));if(document.variantPresentation?.hidden)model.dimensions=model.dimensions.map((d:any)=>({...d,header:!document.variantPresentation.hidden.includes(d.id)}));return model;};
const scalar = (text:string, type:string) => type==='boolean' ? text==='true' : type==='number' ? Number(text) : text;
function Conditions({value=[],onChange,fields}:{value?:CampaignCondition[];onChange:(value:CampaignCondition[])=>void;fields:string[]}) {
  return <div className="campaign-state-conditions">{value.map((test,index)=><div key={index} className="campaign-state-condition">
    <label>Field<input aria-label="Condition field" list="campaign-state-fields" value={test.field} onChange={e=>onChange(value.map((v,i)=>i===index?{...v,field:e.target.value}:v))}/></label>
    <select aria-label="Condition test" value={test.operator} onChange={e=>onChange(value.map((v,i)=>i===index?{...v,operator:e.target.value as CampaignCondition['operator'],value:v.value??''}:v))}><option value="eq">equals</option><option value="neq">does not equal</option><option value="present">has a value</option><option value="absent">is empty</option></select>
    {['eq','neq'].includes(test.operator)&&<><select aria-label="Condition value type" value={typeof test.value} onChange={e=>onChange(value.map((v,i)=>i===index?{...v,value:scalar(String(v.value??''),e.target.value)}:v))}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select><input aria-label="Condition value" value={String(test.value??'')} onChange={e=>onChange(value.map((v,i)=>i===index?{...v,value:scalar(e.target.value,typeof v.value)}:v))}/></>}
    <button type="button" aria-label="Remove condition" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>×</button>
  </div>)}<button type="button" onClick={()=>onChange([...value,{field:fields[0]||'',operator:'eq',value:''}])}>Add condition</button></div>;
}
/** Draft changes are validated and applied together as one document undo step. */
export function CampaignStateController({document}:{document:any}) {
  const [draft,setDraft]=useState<any>(()=>stateDraft(document));
  const [error,setError]=useState('');
  const configuration=JSON.stringify([document.variantModel,document.campaignState,document.variantPresentation]);
  useEffect(()=>{setDraft(stateDraft(document));setError('');},[configuration]);
  const generic=isGenericCampaign(document);
  const fields=[...new Set<string>([...draft.dimensions.map((d:any)=>d.field),...(document.feed?.fields||[]).map((f:any)=>typeof f==='string'?f:f.name).filter(Boolean)])];
  const update=(index:number,patch:any)=>setDraft({...draft,dimensions:draft.dimensions.map((d:any,i:number)=>i===index?{...d,...patch}:d)});
  const save=()=>{try{const next={...document,[generic?'variantModel':'campaignState']:draft};
    const hidden=draft.dimensions.filter((d:any)=>!d.derived&&d.header===false).map((d:any)=>d.id);
    next.variantPresentation={...document.variantPresentation,hidden};
    if(generic){
      const fields=[...(document.feed?.fields||[])];
      for(const dimension of draft.dimensions.filter((d:any)=>!d.derived)){
        const definition={name:dimension.field,label:dimension.label,type:'enum',group:'Variables',options:dimension.options.map((o:any)=>o.value)};
        const index=fields.findIndex((f:any)=>f.name===dimension.field);if(index>=0)fields[index]={...fields[index],...definition};else fields.push(definition);
      }
      next.feed={...document.feed,fields};
    }
    validateCampaignStateEdit(document,next);useEditorStore.getState().applyCreativeOwnershipDocument(next,'Updated campaign states');setError('');
  }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}};
  return <section className="campaign-state-controller" aria-label="Campaign state controller"><h3>Campaign states</h3>
    <p>Define the choices for this campaign and how they appear in the header. Apply saves all changes together.</p>
    {!generic&&<p>SSE serving mappings are retained. Labels, defaults, header visibility and availability can be configured here.</p>}
    <datalist id="campaign-state-fields">{fields.map(field=><option key={field} value={field}/>)}</datalist>
    {draft.dimensions.map((d:any,index:number)=><details key={index}><summary>{d.label||'New state'}{d.derived?' · Derived':''}</summary>
      <label>Name<input value={d.label} onChange={e=>update(index,{label:e.target.value})}/></label>
      {generic&&<><details><summary>Data mapping</summary><label>Identifier<input value={d.id} onChange={e=>update(index,{id:e.target.value})}/></label><label>Feed field<input value={d.field} onChange={e=>update(index,{field:e.target.value})}/></label></details><label><input type="checkbox" checked={Boolean(d.derived)} onChange={e=>update(index,{derived:e.target.checked,rules:d.rules||[]})}/>Derive from other fields</label></>}
      {!d.derived&&<label><input type="checkbox" checked={d.header!==false} onChange={e=>update(index,{header:e.target.checked})}/>Show in header</label>}
      <label>Default<select disabled={!generic&&d.derived} value={String(d.options.findIndex((o:any)=>o.value===d.defaultValue))} onChange={e=>update(index,{defaultValue:d.options[Number(e.target.value)].value})}>{d.options.map((o:any,i:number)=><option value={i} key={i}>{o.label}</option>)}</select></label>
      {!generic&&d.derived&&<p>{d.id==='frameCount'?'Three frames when the offer roundel is off; four when it is on.':'Text + number when roundel value has content; text only when it is empty.'}</p>}
      <fieldset><legend>Choices</legend>{d.options.map((o:any,i:number)=><div className="campaign-state-option" key={i}><label>Label<input value={o.label} onChange={e=>update(index,{options:d.options.map((v:any,j:number)=>j===i?{...v,label:e.target.value}:v)})}/></label>{generic&&<><details><summary>Data value</summary><label>Value<input value={String(o.value)} onChange={e=>update(index,{options:d.options.map((v:any,j:number)=>j===i?{...v,value:scalar(e.target.value,typeof v.value)}:v)})}/></label><select aria-label="Choice value type" value={typeof o.value} onChange={e=>update(index,{options:d.options.map((v:any,j:number)=>j===i?{...v,value:scalar(String(v.value),e.target.value)}:v)})}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select><label>State scope<input value={o.scope} onChange={e=>update(index,{options:d.options.map((v:any,j:number)=>j===i?{...v,scope:e.target.value}:v)})}/></label></details><button type="button" onClick={()=>update(index,{options:d.options.filter((_:any,j:number)=>j!==i)})}>Remove choice</button></>}</div>)}{generic&&<button type="button" onClick={()=>update(index,{options:[...d.options,{label:'New choice',value:`choice-${d.options.length+1}`,scope:`${d.id}-choice-${d.options.length+1}`}]})}>Add choice</button>}</fieldset>
      <fieldset><legend>Available when all conditions match</legend><Conditions value={d.enabledWhen} fields={fields} onChange={enabledWhen=>update(index,{enabledWhen})}/></fieldset>
      {generic&&d.derived&&<fieldset><legend>Derived value · first matching rule wins</legend>{(d.rules||[]).map((rule:any,i:number)=><div key={i}><label>Choose<select value={String(d.options.findIndex((o:any)=>o.value===rule.value))} onChange={e=>update(index,{rules:d.rules.map((r:any,j:number)=>j===i?{...r,value:d.options[Number(e.target.value)].value}:r)})}>{d.options.map((o:any,j:number)=><option key={j} value={j}>{o.label}</option>)}</select></label><Conditions value={rule.when} fields={fields} onChange={when=>update(index,{rules:d.rules.map((r:any,j:number)=>j===i?{...r,when}:r)})}/><button type="button" onClick={()=>update(index,{rules:d.rules.filter((_:any,j:number)=>j!==i)})}>Remove rule</button></div>)}<button type="button" onClick={()=>update(index,{rules:[...(d.rules||[]),{value:d.defaultValue,when:[]}]})}>Add derived rule</button></fieldset>}
      {generic&&<button type="button" onClick={()=>setDraft({...draft,dimensions:draft.dimensions.filter((_:any,i:number)=>i!==index)})}>Remove state</button>}
    </details>)}
    {generic&&<button type="button" onClick={()=>{let n=draft.dimensions.length+1;while(draft.dimensions.some((d:any)=>d.id===`state${n}`))n++;setDraft({...draft,dimensions:[...draft.dimensions,{id:`state${n}`,label:'New state',field:`state${n}`,defaultValue:'default',options:[{value:'default',label:'Default',scope:`state${n}-default`}]}]});}}>Add state</button>}
    <details><summary>Valid combinations</summary><p>When the first conditions match, require the second conditions. Empty conditions match every row.</p>{(draft.constraints||[]).map((constraint:any,index:number)=>{const change=(patch:any)=>setDraft({...draft,constraints:draft.constraints.map((c:any,i:number)=>i===index?{...c,...patch}:c)});return <fieldset key={index}><legend>Constraint {index+1}</legend><label>Explanation<input value={constraint.message} onChange={e=>change({message:e.target.value})}/></label><strong>When</strong><Conditions value={constraint.when} fields={fields} onChange={when=>change({when})}/><strong>Require</strong><Conditions value={constraint.require} fields={fields} onChange={require=>change({require})}/><button type="button" onClick={()=>setDraft({...draft,constraints:draft.constraints.filter((_:any,i:number)=>i!==index)})}>Remove constraint</button></fieldset>})}<button type="button" onClick={()=>setDraft({...draft,constraints:[...(draft.constraints||[]),{message:'This combination is unavailable',when:[],require:[]}]})}>Add constraint</button></details>
    {error&&<p role="alert">{error}</p>}<div className="campaign-state-actions"><button type="button" onClick={save}>Apply states</button><button type="button" onClick={()=>{setDraft(stateDraft(document));setError('');}}>Reset draft</button></div>
  </section>;
}
