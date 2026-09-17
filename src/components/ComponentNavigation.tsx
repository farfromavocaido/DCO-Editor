// @ts-nocheck
'use client';
import {useEffect,useRef,useState} from 'react';
import {componentForTarget} from '@/lib/creative-components';
import {findCreativeTarget} from '@/lib/creative-model';
import {campaignVariantModel,campaignScopes} from '@/lib/campaign-variants';
import {selectPreviewFeedRow,useEditorStore} from '@/store/editor-store';

export function ComponentNavigation() {
 const document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size);
 const targetId=useEditorStore(s=>s.selectedTargetId),path=useEditorStore(s=>s.isolationPath);
 const row=useEditorStore(selectPreviewFeedRow);
 const component=componentForTarget(document,size,targetId) || (path||[]).map(id=>componentForTarget(document,size,id)).find(Boolean);
 const campaign=useEditorStore(s=>s.activeCampaignId),index=useEditorStore(s=>s.feedDraft.selectedIndex);
 if(!component)return null;
 return <ComponentPath key={`${campaign}/${index}/${component.id}`} {...{document,size,targetId,component,row}}/>;
}
function ComponentPath({document,size,targetId,component,row}) {
 const select=useEditorStore(s=>s.setCanvasSelection),update=useEditorStore(s=>s.updateSelectedFeedField),setVariant=useEditorStore(s=>s.setVariantControl);
 const scopes=campaignScopes(document,row);
 const dimensions=campaignVariantModel(document).dimensions.filter(d=>component.stateDimensions?.includes(d.id));
 const remembered=useRef({});const input=useRef(null);
 const [needsValue,setNeedsValue]=useState(null),[error,setError]=useState('');
 useEffect(()=>{for(const d of dimensions)if(String(row[d.field]??'').trim())remembered.current[d.field]=row[d.field];},[row]);
 useEffect(()=>{if(needsValue)input.current?.focus();},[needsValue]);
 const enter=id=>select(id,[id],[component.id]);
 const partName=part=>{const label=findCreativeTarget(document,size,part.targetId,scopes)?.label||part.role;return label.startsWith(component.name+' ')?label.slice(component.name.length+1):label;};
 const choose=(dimension,option)=>{
  setError('');
  try {
   // Presence-driven layouts use their actual feed value, just like delivery.
   if(dimension.derived && dimension.options.some(o=>o.value==='')) {
    if(option.value==='') {if(String(row[dimension.field]??'').trim())remembered.current[dimension.field]=row[dimension.field];update(dimension.field,'');setNeedsValue(null);}
    else {const value=String(row[dimension.field]??'').trim()?row[dimension.field]:remembered.current[dimension.field];if(String(value??'').trim()){update(dimension.field,value);setNeedsValue(null);}else setNeedsValue(dimension);}
   } else setVariant(dimension.field,option.value);
  }catch(cause){setError(cause.message);}
 };
 return <div className="component-navigation" aria-label="Component editing path">
  <button className="component-parent" onClick={()=>select(component.id,[component.id],[])} title="Select the whole component">{component.name}</button>
  {targetId!==component.id&&<><span aria-hidden="true">›</span><select aria-label="Component part" value={targetId} onChange={event=>enter(event.target.value)}>{component.parts.map(part=><option key={part.targetId} value={part.targetId}>{partName(part)}</option>)}</select><button aria-label="Exit component" title="Return to the whole component (Esc)" onClick={()=>select(component.id,[component.id],[])}>↰</button></>}
  {dimensions.map(d=><div key={d.id} className="component-layout-toggle" role="group" aria-label={`${component.name} layout`} title="Changes the sample feed state used by preview and export">{d.options.map(option=><button key={option.scope} aria-pressed={scopes.includes(option.scope)} onClick={()=>choose(d,option)}>{option.label}</button>)}</div>)}
  {needsValue&&<input ref={input} className="component-layout-value" aria-label="Layout value" placeholder="Enter a value" value={row[needsValue.field]||''} onChange={event=>update(needsValue.field,event.target.value)} onBlur={()=>{if(String(row[needsValue.field]??'').trim())setNeedsValue(null);}}/>}
  {error&&<span role="alert">{error}</span>}
 </div>;
}
