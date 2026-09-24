// @ts-nocheck
'use client';
import {useState,useRef,useEffect} from 'react';
import {useEditorStore} from '@/store/editor-store';
import {motionTransitions} from '@/lib/motion-transitions';
import {makeMotionIndependent} from '@/lib/motion-overrides';
import {beatLabel} from '@/lib/timeline-beats';
export function ResolvedMotionEditor({layer,report,beats,canvas,durationS}){
 const [error,setError]=useState(''),document=useEditorStore(s=>s.creativeDocument),selection=useEditorStore(s=>s.selectedTransition),frameSelection=useEditorStore(s=>s.selectedKeyframe);
 const panel=useRef(null);
 useEffect(()=>{if(selection?.layerId===layer.id||frameSelection?.layerId===layer.id)panel.current?.scrollIntoView({block:'nearest'});},[selection?.layerId,selection?.id,frameSelection?.layerId,frameSelection?.index]);
 const pending=useEditorStore(s=>s.timelineResolvedMotion?.pending);
 const transitions=motionTransitions(report.clip,beats,{canvas,parent:canvas,durationS}),chosen=transitions.find(t=>t.id===selection?.id),frame=report.clip.keyframes[frameSelection?.index];
 const independent=()=>{try{const state=useEditorStore.getState(),result=makeMotionIndependent(document,state.size,layer.id,report.clip,state.activeScopes());state.applyCreativeOwnershipDocument(result.document,'Made timing independent for this version');state.selectClip(layer.id,result.id);}catch(e){setError(e.message);}};
 const anchors=report.scheduled?(report.source==='Distributed headline timing'?['act1_in','act4_in']:['act1_in','act2_in','act3_in','act4_in']).filter(id=>beats[id]!==undefined):[];
 return <div ref={panel} className="keyframe-motion-editor resolved-motion-editor"><strong>{report.source}{pending?' · updating…':''}</strong><span className="inspector-note">{report.source==='Distributed headline timing'?'Non-empty headlines share the time before the final act.':'These are the final animation values used by the production preview.'}</span>
  <div className="transition-picker">{transitions.map(t=><button key={t.id} aria-pressed={chosen?.id===t.id} onClick={()=>useEditorStore.getState().selectTransition(layer.id,report.clip.id,t.id,t.start)}>{t.label}<small>{(t.start*durationS/100).toFixed(2)}–{(t.end*durationS/100).toFixed(2)}s</small></button>)}</div>
  {(chosen||frame)&&<div className="resolved-motion-values"><span>{frame?'Calculated keyframe':chosen.label}</span><small>{frame?`${(frame.at*durationS/100).toFixed(2)}s`:`${((chosen.end-chosen.start)*durationS/100).toFixed(2)}s duration`}</small><span>Opacity</span><small>{frame?`${Math.round((frame.opacity??1)*100)}%`:`${Math.round(chosen.from.opacity*100)}% → ${Math.round(chosen.to.opacity*100)}%`}</small></div>}
  {anchors.length>0&&<div className="keyframe-editor-actions">{anchors.map(id=><button key={id} title="Edit the shared timing anchor" onClick={()=>{useEditorStore.setState({selectedBeatId:id});useEditorStore.getState().setPercent(beats[id]);}}>{beatLabel(document,id)}</button>)}</div>}
  <button disabled={pending} title="Keep the animation you see now, and replace automatic timing for this format and these conditions. Other versions are unaffected." onClick={independent}>Make timing independent</button>
  {error&&<p role="alert">{error}</p>}
 </div>;
}
export function ResolvedTimelineRanges({layer,report,beats,context}){
 const view=useEditorStore(s=>s.motionView),selected=useEditorStore(s=>s.selectedTransition);
 if(view==='keyframes')return <>{report.clip.keyframes.map((f,i)=><button key={i} className="resolved-keyframe" style={{left:`${f.at}%`}} aria-label={`${layer.label}: calculated keyframe at ${(f.at*context.durationS/100).toFixed(2)} seconds`} title="Calculated by the production timing rule" onClick={e=>{e.stopPropagation();useEditorStore.getState().selectKeyframe(layer.id,report.clip.id,i,f.at);}}>◇</button>)}</>;
 return <>{motionTransitions(report.clip,beats,context).map(t=><div key={t.id} className={`timeline-transition is-derived ${selected?.layerId===layer.id&&selected?.id===t.id?'is-selected':''}`} style={{left:`${t.start}%`,width:`${t.end-t.start}%`}}><button className="transition-body" title={`${report.source}: ${(t.start*context.durationS/100).toFixed(2)}–${(t.end*context.durationS/100).toFixed(2)}s. Select to inspect the rule.`} aria-label={`${layer.label}: ${t.label} (calculated)`} onClick={e=>{e.stopPropagation();useEditorStore.getState().selectTransition(layer.id,report.clip.id,t.id,t.start);}}>◇ {t.label}</button><span className="derived-endpoint"/></div>)}</>;
}
