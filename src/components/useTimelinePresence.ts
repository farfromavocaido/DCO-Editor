'use client';
import {useEffect,useMemo,useState} from 'react';
import {getProductionStageSource,getProductionStage,seekProductionAnimations} from '@/lib/production-stage';
import {readProductionTimeline} from '@/lib/timeline-render-model';
import {campaignScopes} from '@/lib/campaign-variants';
import {productionElementPresent,type PresenceSpan} from '@/lib/timeline-presence';
import {useEditorStore} from '@/store/editor-store';

export function useTimelinePresence(document:any,row:any,size:string){
 const mode=useEditorStore(s=>s.previewRenderMode),draft=useEditorStore(s=>s.layoutPreview),copy=useEditorStore(s=>s.layoutPreviewCopy);
 const effectiveDocument=draft?.size===size?draft.document:document;
 const effectiveRow=useMemo(()=>{const base=draft?.size===size?draft.row:row;return copy?.size===size?{...base,...copy.values}:base;},[row,draft,copy,size]);
 const [result,setResult]=useState<{spans:Record<string,PresenceSpan[]>;status:string;layers?:Record<string,any>;opacity?:Record<string,any[]>}>({spans:{},status:'Measuring presence…'});
 useEffect(()=>{
  let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const previous=useEditorStore.getState().timelineResolvedMotion;
  useEditorStore.setState({timelineResolvedMotion:previous?{...previous,pending:true}:null});
  setResult(previous=>({...previous,status:'Measuring presence…'}));
  if(!effectiveDocument)return;
  const ready=async()=>{const started=Date.now();while(!cancelled&&Date.now()-started<20000){const stage=getProductionStage(),source=getProductionStageSource();
    if(stage?.isConnected&&stage.dataset.size===size&&stage.dataset.previewRenderMode===mode&&source?.document===effectiveDocument&&(source?.row===effectiveRow||JSON.stringify(source?.row)===JSON.stringify(effectiveRow)))return stage;
    await new Promise(resolve=>setTimeout(resolve,25));
  }throw new Error('Preview unavailable');};
  void ready().then(stage=>{
   if(cancelled)return;
   const doc=stage.ownerDocument,duration=Number(effectiveDocument.clock.durationS),count=Math.ceil(duration*50);
   const layers:Record<string,any>=readProductionTimeline(stage,effectiveDocument,size,campaignScopes(effectiveDocument,effectiveRow),effectiveRow);
   const opacity:Record<string,any[]>={},seen:Record<string,boolean>={};
   const members=(effectiveDocument.sizes[size].layers||[]).map((layer:any)=>({id:layer.id,element:layer.id==='terms-solo'?stage.querySelector<HTMLElement>('#TC_Solo [data-dco-field="tc_terms_text"], .terms-solo'):doc.getElementById(layer.id.replace(/^offer-slot-(\d+)$/,'offer$1'))}));
   const spans:Record<string,PresenceSpan[]>={};members.forEach(({id}:any)=>{spans[id]=[];opacity[id]=[];});
   let index=0;
   const batch=()=>{
    if(cancelled||getProductionStage()!==stage||!stage.isConnected)return;
    const hidden=doc.querySelector<HTMLStyleElement>('style[data-editor-hidden-layers]'),hiddenRules=hidden?.textContent||'';
    const restore=useEditorStore.getState().percent,started=performance.now();
    try{
     if(hidden)hidden.textContent='';
     do{
      seekProductionAnimations(doc,(index+.5)/count*100,duration);
      for(const {id,element} of members){
       if(layers[id]?.reason)continue;
       let value=1,node=element;while(node&&node!==stage){value*=Number(doc.defaultView!.getComputedStyle(node).opacity);node=node.parentElement;}
       if(value>0)seen[id]=true;
       if(!productionElementPresent(stage,element))continue;
       const alpha=Math.round(value*20)/20,previous=opacity[id].at(-1);
       if(previous&&previous.value===alpha&&Math.abs(previous.end-index/count*100)<.00001)previous.end=(index+1)/count*100;else opacity[id].push({start:index/count*100,end:(index+1)/count*100,value:alpha});
       const start=index/count*100,end=(index+1)/count*100,last=spans[id].at(-1);
       if(last&&Math.abs(last.end-start)<.00001)last.end=end;else spans[id].push({start,end});
      }
      index++;
     }while(index<count&&performance.now()-started<7);
    }catch{cancelled=true;setResult({spans:{},status:'Presence measurement unavailable'});}finally{if(hidden)hidden.textContent=hiddenRules;seekProductionAnimations(doc,restore,duration);}
    if(cancelled)return;
    if(index<count)timer=setTimeout(batch,16);else {for(const {id} of members)if(!spans[id].length&&!layers[id].reason)layers[id].reason=seen[id]?'Outside the canvas throughout this version':'Transparent throughout this version';
      const reports=Object.fromEntries(Object.entries(layers).map(([id,entry]:any)=>[id,{reason:entry.reason,motion:entry.motion}]));
      useEditorStore.setState({timelineResolvedMotion:{size,document:effectiveDocument,layers:reports,pending:false}});
      setResult({spans,opacity,layers:reports,status:'Presence measured from production preview (20 ms precision)'});}
   };timer=setTimeout(batch,0);
  }).catch(()=>{if(!cancelled)setResult({spans:{},status:'Presence unavailable until the production preview is ready'});});
  return()=>{cancelled=true;if(timer)clearTimeout(timer);};
 },[effectiveDocument,effectiveRow,size,mode]);
 return result;
}
