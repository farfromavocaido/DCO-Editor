// @ts-nocheck
import {useEditorStore} from '@/store/editor-store';
import {moveLayerIntoStack,frontToBack,validateLayerStacks} from './layer-stacks';
export function beginLayerTreeDrag(event,layerId){
 if(event.button!==0)return;event.preventDefault();event.stopPropagation();
 useEditorStore.setState({timelineDragLayerId:layerId,timelineDropTarget:null});
 let target=null;
 const move=e=>{
  const element=window.document.elementFromPoint(e.clientX,e.clientY),stack=element?.closest('[data-stack-drop]'),row=element?.closest('[data-layer-id]');
  target=stack?{stackId:stack.getAttribute('data-stack-drop')}:row&&row.getAttribute('data-layer-id')!==layerId?{layerId:row.getAttribute('data-layer-id'),after:e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2}:null;
  useEditorStore.setState({timelineDropTarget:target});
 };
 const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);useEditorStore.setState({timelineDragLayerId:null,timelineDropTarget:null});};
 const up=()=>{const destination=target;cleanup();if(!destination)return;
  const s=useEditorStore.getState();try{
   let next;if(destination.stackId!==undefined)next=moveLayerIntoStack(s.creativeDocument,s.size,layerId,destination.stackId);
   else{
    next=structuredClone(s.creativeDocument);const creative=next.sizes[s.size],targetFolder=creative.timelineFolders?.find(g=>g.members.includes(destination.layerId));
    for(const group of creative.timelineFolders||[])group.members=group.members.filter(id=>id!==layerId);
    if(targetFolder)targetFolder.members.push(layerId);
    const order=frontToBack(creative),layer=order.find(l=>l.id===layerId),remaining=order.filter(l=>l.id!==layerId),at=remaining.findIndex(l=>l.id===destination.layerId);
    if(!layer||at<0)return;remaining.splice(at+(destination.after?1:0),0,layer);remaining.forEach((l,i)=>l.zIndex=remaining.length-1-i);validateLayerStacks(next);
   }
   s.applyCreativeOwnershipDocument(next,'Updated layer tree');
  }catch(e){s.setStatus(e.message,'error');}
 };
 const cancel=()=>cleanup();window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
}
