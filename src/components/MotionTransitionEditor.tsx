// @ts-nocheck
'use client';
import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { retimeTransition, editTransitionEndpoint } from '@/lib/motion-transitions';
import { keyframeClip } from '@/lib/keyframe-editing';

export const easingOptions = ['linear','ease-in','ease-out','ease-in-out'];
export function EasingSelect({value,onChange,label='Easing'}) {
 return <label className="inspector-field"><span>{label}</span><select aria-label={label} value={value||'linear'} onChange={e=>onChange(e.target.value)}>{easingOptions.map(v=><option key={v} value={v}>{({linear:'Linear','ease-in':'Ease in','ease-out':'Ease out','ease-in-out':'Ease in and out'})[v]}</option>)}{value&&!easingOptions.includes(value)&&<option value={value}>Custom curve</option>}</select></label>;
}
export function MotionTransitionEditor({layer,clip,transition:t,beats,context,NumberField}) {
 const [error,setError]=useState('');
 const attempt=fn=>{try{const next=fn();useEditorStore.getState().replaceEditorClip(layer.id,clip.id,next);setError('');}catch(e){setError(e.message);}};
 const edit=(endpoint,patch)=>attempt(()=>editTransitionEndpoint(clip,t,endpoint,patch,beats,context));
 const seconds=p=>p*context.durationS/100, percent=s=>s/context.durationS*100;
 const fields=[];
 for(const channel of t.channels){
  if(channel==='translate')for(const [i,axis] of ['X','Y'].entries()){
   if(t.from.translate[i]===t.to.translate[i])continue;
   fields.push({label:`Move ${axis} (px)`,values:[t.from.translate[i],t.to.translate[i]],set:(endpoint,v)=>{
    const authored=keyframeClip(clip,beats,context).keyframes[endpoint==='from'?t.fromIndex:t.toIndex];
    const pair=[...(authored.translate||t[endpoint].translate)],old=pair[i];pair[i]=old&&typeof old==='object'?{...old,value:old.unit==='px'?v:v/context[old.unit][i===0?'width':'height']*100}:v;edit(endpoint,{translate:pair});
   }});
  }
  else if(channel==='scale')for(const i of (Array.isArray(t.from.scale)||Array.isArray(t.to.scale)?[0,1]:[null]))fields.push({label:i===null?'Scale (%)':`Scale ${i===0?'X':'Y'} (%)`,values:['from','to'].map(e=>(Array.isArray(t[e].scale)?t[e].scale[i]:t[e].scale)*100),set:(endpoint,v)=>{let scale=v/100;if(i!==null){scale=Array.isArray(t[endpoint].scale)?[...t[endpoint].scale]:[t[endpoint].scale,t[endpoint].scale];scale[i]=v/100;}edit(endpoint,{scale});}});
  else if(channel!=='color')fields.push({label:({opacity:'Opacity (%)',left:'Layout X (px)',top:'Layout Y (px)',width:'Width (px)',height:'Height (px)'})[channel],values:[t.from[channel],t.to[channel]].map(v=>channel==='opacity'?v*100:v),set:(endpoint,v)=>edit(endpoint,{[channel]:channel==='opacity'?v/100:v})});
 }
 return <div className="selected-keyframe-editor" data-keyframe-editor>
  <strong>{t.label}</strong>
  <div className="inspector-grid"><NumberField label="Starts at (s)" value={seconds(t.start)} onCommit={v=>attempt(()=>retimeTransition(clip,t,percent(v),percent(v)+t.end-t.start,beats,context))}/><NumberField label="Duration (s)" value={seconds(t.end-t.start)} onCommit={v=>attempt(()=>retimeTransition(clip,t,t.start,t.start+percent(v),beats,context))}/></div>
  {fields.map(f=><div key={f.label} className="transition-values"><span title="Values at the start and end of this transition. Movement is an offset from the layout position.">{f.label}</span><div className="inspector-grid">{['from','to'].map((endpoint,i)=><NumberField key={endpoint} label={`${endpoint==='from'?'From':'To'} · ${f.label}`} value={f.values[i]} onCommit={v=>f.set(endpoint,v)}/>)}</div></div>)}
  {t.channels.includes('color')&&<div className="inspector-grid">{['from','to'].map(endpoint=><label className="inspector-field" key={endpoint}><span>{endpoint==='from'?'From colour':'To colour'}</span><input aria-label={`${endpoint} colour`} key={t[endpoint].color} defaultValue={t[endpoint].color} onBlur={e=>{if(CSS.supports('color',e.target.value))edit(endpoint,{color:e.target.value});else setError('Enter a valid colour');}}/></label>)}</div>}
  <EasingSelect value={t.easing} onChange={easing=>edit('from',{easing})}/>
  <div className="keyframe-editor-actions"><button onClick={()=>useEditorStore.getState().setPercent(t.start)}>View start</button><button onClick={()=>useEditorStore.getState().setPercent(t.end)}>View end</button></div>
  {error&&<p className="keyframe-error" role="alert">{error}</p>}
 </div>;
}
