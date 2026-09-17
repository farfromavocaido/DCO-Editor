// @ts-nocheck
'use client';
import {useEffect,useState} from 'react';
import {useEditorStore,selectPreviewFeedRow} from '@/store/editor-store';
import {feedFieldForEditableTarget} from '@/lib/preview-utils';
import {editableTargetsForLayer} from '@/lib/creative-model';
import styles from './LayoutRulesPanel.module.css';
export function LayoutContentPreview({document,size}){
 const row=useEditorStore(selectPreviewFeedRow),preview=useEditorStore(s=>s.layoutPreviewCopy),[owner]=useState(()=>crypto.randomUUID()),[selected,setSelected]=useState(''),[copy,setCopy]=useState('');
 const options=document.sizes[size].layers.flatMap(layer=>[{id:layer.id,label:layer.label||layer.id},...editableTargetsForLayer(layer)].map(target=>({...target,field:feedFieldForEditableTarget(layer,target.id)}))).filter(t=>t.field);
 const active=preview?.owner===owner;
 const clear=()=>{if(useEditorStore.getState().layoutPreviewCopy?.owner===owner)useEditorStore.setState({layoutPreviewCopy:null});};
 useEffect(()=>clear,[]);
 const show=value=>{const option=options.find(o=>o.id===selected);if(!option)return;setCopy(value);useEditorStore.setState({layoutPreviewCopy:{owner,size,values:{[option.field]:value,[`${option.field}_${size}`]:''}}});};
 return <details className={styles.panel}><summary>Try different content</summary>
 <label className={styles.field}>Text element<select aria-label="Preview text element" value={selected} onChange={e=>{clear();setSelected(e.target.value);const field=options.find(o=>o.id===e.target.value)?.field;setCopy(String(row[`${field}_${size}`]||row[field]||''));}}><option value="">Choose text to try…</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
 {selected&&<><label className={styles.field}>Preview copy<textarea aria-label="Layout preview copy" rows={3} value={copy} onChange={e=>{setCopy(e.target.value);if(active)show(e.target.value);}}/></label><div className={styles.actions}><button type="button" onClick={()=>show(copy)}>Preview copy</button><button type="button" onClick={()=>show('')}>Try empty</button>{active&&<button type="button" onClick={()=>{clear();const field=options.find(o=>o.id===selected)?.field;setCopy(String(row[`${field}_${size}`]||row[field]||''));}}>Restore actual copy</button>}</div></>}
 {active&&<span className={styles.note}>Preview only · campaign copy unchanged</span>}
 </details>;
}
