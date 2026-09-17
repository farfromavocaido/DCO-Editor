// @ts-nocheck
'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {useEditorStore} from '@/store/editor-store';
import {captureProperties,pasteProperties} from '@/lib/property-clipboard';
import {VisualCopyTray} from './VisualCopyTray';

export function CreativeTransferLauncher(){
 const request=useEditorStore(s=>s.creativeTransferRequest),document=useEditorStore(s=>s.creativeDocument);
 if(!request||!document)return null;
 const {key,...transferProps}=request;
 const close=()=>useEditorStore.setState({creativeTransferRequest:null});
 return createPortal(<VisualCopyTray key={key} document={document} {...transferProps} onCancel={close} onApply={(next,count,mode)=>{useEditorStore.getState().applyCreativeOwnershipDocument(next,mode==='link'?`Linked ${count} versions`:`Copied to ${count} versions`);close();}}/>,window.document.body);
}
export function CreativeContextMenu({menu,onClose}){
 const state=useEditorStore(),ref=useRef(null),[branch,setBranch]=useState(null);
 const target=state.selectedTarget(),clipboard=state.propertyClipboard;
 const layer=state.selectedTargetIds.length===1&&state.creativeDocument?.sizes?.[state.size]?.layers?.find(l=>l.id===menu.layerId);
 const concrete=Boolean(captureProperties(target));
 const transferable=concrete||target?.kind==='component';
 const left=Math.max(8,Math.min(menu.x,window.innerWidth-232)),top=Math.max(8,Math.min(menu.y,window.innerHeight-410));
 useEffect(()=>{const previous=window.document.activeElement;ref.current?.querySelector('button:not(:disabled)')?.focus();const outside=e=>{if(!ref.current?.contains(e.target))onClose();};window.document.addEventListener('pointerdown',outside);return()=>{window.document.removeEventListener('pointerdown',outside);if(previous?.isConnected)previous.focus?.();};},[]);
 const run=action=>{try{action();onClose();}catch(error){state.setStatus(error.message,'warn');onClose();}};
 const transfer=operation=>run(()=>useEditorStore.setState({creativeTransferRequest:{key:crypto.randomUUID(),size:state.size,target,scopes:state.activeScopes(),operation}}));
 const item=(label,action,disabled=false,title='')=><button type="button" role="menuitem" disabled={disabled} title={title} onClick={()=>run(action)}>{label}</button>;
 const sub=(label,children)=><div className="creative-menu-branch" onMouseEnter={()=>setBranch(label)}><button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={branch===label} onClick={()=>setBranch(branch===label?null:label)} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();const trigger=e.currentTarget;setBranch(label);requestAnimationFrame(()=>trigger.nextElementSibling?.querySelector('button:not(:disabled)')?.focus());}}}>{label}<span aria-hidden="true">›</span></button>{branch===label&&<div className="creative-submenu" role="menu" aria-label={label}>{children}</div>}</div>;
 return createPortal(<div ref={ref} role="menu" aria-label="Element actions" className={`canvas-menu creative-context-menu ${left+464>window.innerWidth?'opens-left':''}`} style={{left,top}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
 if(e.key==='Tab'){onClose();return;}
 if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();return;}
 if(e.key==='ArrowLeft'&&branch){e.preventDefault();const trigger=ref.current.querySelector('[aria-expanded="true"]');setBranch(null);trigger?.focus();return;}
 if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const root=e.target.closest('[role="menu"]'),items=[...root.querySelectorAll('[role=menuitem]:not(:disabled)')].filter(item=>item.closest('[role=menu]')===root);const index=items.indexOf(window.document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
 }}>
 <strong>{target?.label||menu.title||menu.layerLabel}</strong>
 <button role="menuitem" disabled={!transferable} title={transferable?undefined:"Select one element or component to transfer its appearance"} onClick={()=>transfer('to')}>Copy to…</button>
 <button role="menuitem" disabled={!transferable} title={transferable?undefined:"Select one element or component to transfer its appearance"} onClick={()=>transfer('from')}>Copy from…</button>
 {item('Copy properties',()=>{useEditorStore.setState({propertyClipboard:captureProperties(target)});state.setStatus('Properties copied');},!concrete,'Copy appearance and text fitting once. Text, animation and links stay unchanged. For a whole group, use Copy to.')}
 {item('Paste properties',()=>{const fields=Object.keys(clipboard.values);if(state.layoutRuleBlocksEdit([target.id],fields))return;state.applyCreativeOwnershipDocument(pasteProperties(state.creativeDocument,state.size,target,state.activeScopes(),clipboard),`Pasted properties from ${clipboard.label}`);},!concrete||!clipboard,clipboard?`Paste appearance and fitting from ${clipboard.label}; leaves text and animation unchanged.`:'Copy properties from an element first.')}
 <div role="separator"/>
 {item('Group selection',()=>state.groupSelectedCanvasTargets(),state.selectedTargetIds.length<2)}
 {item('Ungroup',()=>state.ungroupSelectedCanvasTargets(),!state.selectedTargetIds.some(id=>String(id).startsWith('canvas-group:')))}
 {sub('Select',(menu.choices||[]).map(choice=><span key={choice.id}>{item(choice.label,choice.select)}</span>))}
 <div role="separator"/>
 {sub('Actions',<>{menu.editField&&item('Edit text',()=>state.requestEditFeedField(menu.editField))}{item('Duplicate',()=>state.duplicateLayer(menu.layerId),!layer)}{item('Delete',()=>state.deleteLayer(menu.layerId),!layer)}{item(menu.locked?'Unlock':'Lock',()=>state.toggleLayerLock(menu.layerId),!layer)}{item(menu.hidden?'Show':'Hide',()=>state.toggleLayerVisibility(menu.layerId),!layer)}{item('Add rectangle',()=>state.addShapeLayer())}</>)}
 {sub('Arrange',<>{item('Bring forward',()=>state.moveLayerZ(menu.layerId,1),!layer)}{item('Send backward',()=>state.moveLayerZ(menu.layerId,-1),!layer)}</>)}
 {sub('Animations',<>{item('Fade in here',()=>state.addAnimationIntent(menu.layerId,'fadeIn'),!layer)}{item('Fade out here',()=>state.addAnimationIntent(menu.layerId,'fadeOut'),!layer)}{item('Apply motion to family',()=>state.copySelectedClipToAnimationFamily(),!state.creativeDocument?.sizes?.[state.size]?.layers?.find(l=>l.id===menu.layerId)?.clips?.some(c=>c.id===state.selectedClipId))}</>)}
 </div>,window.document.body);
}
