// @ts-nocheck
'use client';
import {useRef} from 'react';
import {useEditorStore} from '@/store/editor-store';
import {validateLayoutRules} from '@/lib/layout-rules';
export function LayoutAreaOverlay({document,size,scale}){
 const selected=useEditorStore(s=>s.selectedLayoutRuleId),draft=useEditorStore(s=>s.layoutAreaDraft),drag=useRef(null);
 const rule=document.layoutRules?.find(r=>r.id===selected&&r.type==='distribute'),activeDraft=draft?.size===size&&draft.ruleId===selected?draft:null,area=activeDraft?.area||rule?.areas?.[size];
 if(!area)return null;
 const start=(event,resize)=>{event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY,area:{...area},resize,next:{...area}};};
 const move=event=>{const d=drag.current;if(!d)return;const dx=(event.clientX-d.x)/scale,dy=(event.clientY-d.y)/scale;d.next=d.resize?{...d.area,width:Math.max(1,d.area.width+dx),height:Math.max(1,d.area.height+dy)}:{...d.area,left:d.area.left+dx,top:d.area.top+dy};useEditorStore.setState({layoutAreaDraft:{ruleId:activeDraft?.ruleId||rule.id,size,area:d.next,overlayOnly:activeDraft?.overlayOnly??!activeDraft}});};
 const end=event=>{const d=drag.current;if(!d)return;drag.current=null;event.currentTarget.releasePointerCapture(event.pointerId);const current=useEditorStore.getState().layoutAreaDraft;if(current?.overlayOnly){const next={...document,layoutRules:document.layoutRules.map(r=>r.id===rule.id?{...r,areas:{...r.areas,[size]:d.next}}:r)};try{validateLayoutRules(next);useEditorStore.getState().applyCreativeOwnershipDocument(next,'Updated layout area');}catch(e){useEditorStore.getState().setStatus(e.message,'warn');}useEditorStore.setState({layoutAreaDraft:null});}};
 return <div className="layout-area-outline" style={{left:area.left,top:area.top,width:area.width,height:area.height}}>
 <button className="layout-area-move" title="Drag to move the fixed layout area" aria-label="Move layout area" onPointerDown={e=>start(e,false)} onPointerMove={move} onPointerUp={end}>Layout area</button>
 <button className="layout-area-resize" title="Drag to resize the layout area" aria-label="Resize layout area" onPointerDown={e=>start(e,true)} onPointerMove={move} onPointerUp={end}/>
 </div>;
}
