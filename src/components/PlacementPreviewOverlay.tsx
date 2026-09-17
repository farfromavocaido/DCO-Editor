// @ts-nocheck
'use client';
import {useRef,useState} from 'react';
import {useEditorStore} from '@/store/editor-store';
export function PlacementPreviewOverlay({targets,scale,size}){
 const preview=useEditorStore(s=>s.layoutPreview),drag=useRef(null),[delta,setDelta]=useState({x:0,y:0});
 if(!preview||preview.kind!=='placement'||preview.size!==size)return null;const bounds=targets.find(t=>t.id===preview.targetId);if(!bounds)return null;
 return <div className="layout-area-outline placement-preview-outline" style={{left:bounds.left+delta.x,top:bounds.top+delta.y,width:bounds.width,height:bounds.height}}><button className="layout-area-move" aria-label="Move conditional placement" onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY};}} onPointerMove={e=>{if(drag.current)setDelta({x:(e.clientX-drag.current.x)/scale,y:(e.clientY-drag.current.y)/scale});}} onPointerUp={e=>{if(!drag.current)return;useEditorStore.setState({layoutPlacementDraft:{ruleId:preview.ruleId,left:preview.left+delta.x,top:preview.top+delta.y}});drag.current=null;setDelta({x:0,y:0});e.currentTarget.releasePointerCapture(e.pointerId);}}>Placement {preview.branch==='when'?'A':'B'} · drag</button></div>;
}
