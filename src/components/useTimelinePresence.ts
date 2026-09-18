'use client';
import {useEffect,useMemo,useState} from 'react';
import {getProductionStageSource,getProductionStage,seekProductionAnimations} from '@/lib/production-stage';
import {productionElementPresent,type PresenceSpan} from '@/lib/timeline-presence';
import {useEditorStore} from '@/store/editor-store';

export function useTimelinePresence(document:any,row:any,size:string){
 const mode=useEditorStore(s=>s.previewRenderMode),draft=useEditorStore(s=>s.layoutPreview),copy=useEditorStore(s=>s.layoutPreviewCopy);
 const effectiveDocument=draft?.size===size?draft.document:document;
 const effectiveRow=useMemo(()=>{const base=draft?.size===size?draft.row:row;return copy?.size===size?{...base,...copy.values}:base;},[row,draft,copy,size]);
 const [result,setResult]=useState<{spans:Record<string,PresenceSpan[]>;status:string}>({spans:{},status:'Measuring presence…'});
 useEffect(()=>{
  let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
  setResult({spans:{},status:'Measuring presence…'});
  if(!effectiveDocument)return;
  const ready=async()=>{const started=Date.now();while(!cancelled&&Date.now()-started<20000){const stage=getProductionStage(),source=getProductionStageSource();
    if(stage?.isConnected&&stage.dataset.size===size&&stage.dataset.previewRenderMode===mode&&source?.document===effectiveDocument&&(source?.row===effectiveRow||JSON.stringify(source?.row)===JSON.stringify(effectiveRow)))return stage;
    await new Promise(resolve=>setTimeout(resolve,25));
  }throw new Error('Preview unavailable');};
  void ready().then(stage=>{
   if(cancelled)return;
   const doc=stage.ownerDocument,duration=Number(effectiveDocument.clock.durationS),count=Math.ceil(duration*50);
   const members=(effectiveDocument.sizes[size].layers||[]).map((layer:any)=>({id:layer.id,element:layer.id==='terms-solo'?stage.querySelector<HTMLElement>('#TC_Solo [data-dco-field="tc_terms_text"], .terms-solo'):doc.getElementById(layer.id.replace(/^offer-slot-(\d+)$/,'offer$1'))}));
   const spans:Record<string,PresenceSpan[]>={};members.forEach(({id}:any)=>spans[id]=[]);
   let index=0;
   const batch=()=>{
    if(cancelled||getProductionStage()!==stage||!stage.isConnected)return;
    const hidden=doc.querySelector<HTMLStyleElement>('style[data-editor-hidden-layers]'),hiddenRules=hidden?.textContent||'';
    const restore=useEditorStore.getState().percent,started=performance.now();
    try{
     if(hidden)hidden.textContent='';
     do{
      seekProductionAnimations(doc,(index+.5)/count*100,duration);
      for(const {id,element} of members){if(!productionElementPresent(stage,element))continue;
       const start=index/count*100,end=(index+1)/count*100,last=spans[id].at(-1);
       if(last&&Math.abs(last.end-start)<.00001)last.end=end;else spans[id].push({start,end});
      }
      index++;
     }while(index<count&&performance.now()-started<7);
    }catch{cancelled=true;setResult({spans:{},status:'Presence measurement unavailable'});}finally{if(hidden)hidden.textContent=hiddenRules;seekProductionAnimations(doc,restore,duration);}
    if(cancelled)return;
    if(index<count)timer=setTimeout(batch,16);else setResult({spans,status:'Presence measured from production preview (20 ms precision)'});
   };timer=setTimeout(batch,0);
  }).catch(()=>{if(!cancelled)setResult({spans:{},status:'Presence unavailable until the production preview is ready'});});
  return()=>{cancelled=true;if(timer)clearTimeout(timer);};
 },[effectiveDocument,effectiveRow,size,mode]);
 return result;
}
