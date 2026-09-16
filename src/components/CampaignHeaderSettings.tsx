'use client';
import { useState } from 'react';
import { campaignHeaderOrder } from '@/lib/campaign-variants';
import { useEditorStore } from '@/store/editor-store';

type Dimension = {id:string;label:string;derived?:boolean;header?:boolean};
/** Presentation settings never opt a legacy campaign into another renderer. */
export function CampaignHeaderSettings({document,dimensions}:{document:any;dimensions:Dimension[]}) {
  const [open,setOpen]=useState(false);
  const configured=document.variantPresentation || {};
  const available=dimensions.filter(d=>!d.derived);
  const ordered=campaignHeaderOrder(document);
  const hidden:string[]=configured.hidden || available.filter(d=>d.header===false).map(d=>d.id);
  const update=(patch:object)=>useEditorStore.getState().applyCreativeOwnershipDocument({...document,variantPresentation:{order:ordered,hidden,...patch}},'Updated campaign header controls');
  const move=(id:string,step:number)=>{const order=[...ordered],i=order.indexOf(id),j=i+step;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];update({order});};
  return <div className="campaign-header-settings"><button type="button" aria-label="Configure campaign header" aria-expanded={open} onClick={()=>setOpen(!open)}>Controls</button>
    {open && <div className="campaign-header-popover" role="group" aria-label="Campaign header controls"><strong>Show in this campaign’s header</strong><p>These are saved campaign settings. They don’t change the ads.</p>
      {ordered.map((id:string,index:number)=><div className="campaign-control-setting" key={id}><label><input type="checkbox" checked={!hidden.includes(id)} onChange={event=>update({hidden:event.target.checked?hidden.filter(v=>v!==id):[...hidden,id]})}/>{available.find(d=>d.id===id)?.label}</label><button aria-label={`Move ${id} earlier`} disabled={index===0} onClick={()=>move(id,-1)}>↑</button><button aria-label={`Move ${id} later`} disabled={index===ordered.length-1} onClick={()=>move(id,1)}>↓</button></div>)}
      <button type="button" onClick={()=>setOpen(false)}>Done</button>
    </div>}
  </div>;
}
