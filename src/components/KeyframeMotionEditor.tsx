// @ts-nocheck
'use client';
import {MotionTimingControls} from './MotionTimingControls';
import {MotionDistanceControls} from './MotionDistanceControls';
import {useEffect,useState} from 'react';
import {clipsForProfile} from '@/lib/headline-motion';
import {activeFrameScope} from '@/lib/timing-profiles';
import {useEditorStore} from '@/store/editor-store';
import {editableKeyframes,retimeClip,insertKeyframe} from '@/lib/keyframe-editing';
import {compileAnimationClips,frameAtPercent,resolveTimeRef} from '@/lib/creative-compiler';
import {resolveMotionDistance} from '@/lib/motion-units';

function CommitNumber({label,value,onCommit,...rest}){
 const formatted=Number.isFinite(Number(value))?String(Number(Number(value).toFixed(3))):'0';const [draft,setDraft]=useState(formatted);
 useEffect(()=>setDraft(formatted),[formatted]);
 return <label className="inspector-field"><span>{label}</span><input aria-label={label} type="number" step="any" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft.trim()&&Number.isFinite(Number(draft))&&Number(draft)!==Number(value))onCommit(Number(draft));setDraft(formatted);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} {...rest}/></label>;
}
function TimingReference({value,onCommit}){
 const [draft,setDraft]=useState(String(value));useEffect(()=>setDraft(String(value)),[value]);
 return <input aria-label="Keyframe timing reference" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==String(value))onCommit(draft!==''&&Number.isFinite(Number(draft))?Number(draft):draft);setDraft(String(value));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>;
}
export function KeyframeMotionEditor({layer,clip:resolvedClip,beats,canvas,durationS}){
 const scopes=useEditorStore.getState().activeScopes();
 const available=clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes);
 const clip=layer.clips?.find(c=>c.id===resolvedClip?.id)||resolvedClip;
 const selection=useEditorStore(s=>s.selectedKeyframe),percent=useEditorStore(s=>s.percent),[error,setError]=useState('');
 const context={canvas,parent:canvas,durationS},frames=clip?editableKeyframes(clip,beats,context):[];
 const selected=selection?.layerId===layer.id&&selection?.clipId===clip?.id?frames.find(f=>f.index===selection.index):null;
 const effective=selected?frameAtPercent(compileAnimationClips([clip],beats,context),selected.at):null;
 const start=clip?.preset==='custom'?frames[0]?.at:resolveTimeRef(clip?.start??0,beats,durationS),end=clip?.preset==='custom'?frames.at(-1)?.at:resolveTimeRef(clip?.end??100,beats,durationS);
 const attempt=fn=>{try{fn();setError('');}catch(e){setError(e.message);}};
 const replace=next=>useEditorStore.getState().replaceEditorClip(layer.id,clip.id,next);
 const edit=patch=>attempt(()=>useEditorStore.getState().editSelectedKeyframe(patch));
 useEffect(()=>{setError('');if(selected)window.document.querySelector('[data-keyframe-editor]')?.scrollIntoView({block:'nearest'});},[selection?.layerId,selection?.clipId,selection?.index]);
 const number=(label,value,change,extra={})=><CommitNumber key={label} label={label} value={value} onCommit={change} {...extra}/>;
 const move=(axis)=>{const index=axis==='X'?0:1,value=selected.frame.translate?.[index]??effective.translate?.[index]??0,unit=typeof value==='object'?value.unit:'px',n=typeof value==='object'?value.value:value;
 return <div className="keyframe-distance" key={axis}>{number(`Offset ${axis}`,n,v=>{const translate=[...(selected.frame.translate||effective.translate||[0,0])];translate[index]=unit==='px'?v:{value:v,unit};edit({translate});})}<label className="inspector-field"><span>Relative to</span><select aria-label={`Offset ${axis} units`} value={unit} onChange={e=>{const translate=[...(selected.frame.translate||effective.translate||[0,0])],px=resolveMotionDistance(value,axis.toLowerCase(),context),nextUnit=e.target.value;translate[index]=nextUnit==='px'?px:{value:px/canvas[axis==='X'?'width':'height']*100,unit:nextUnit};edit({translate});}}><option value="px">Pixels</option><option value="canvas">% of ad</option><option value="parent">% of parent</option></select></label></div>;
 };
 return <div className="keyframe-motion-editor">
 <label className="inspector-field"><span>Animation</span><select aria-label="Selected animation" value={clip?.id||''} onChange={e=>useEditorStore.getState().selectClip(layer.id,e.target.value)}>{!clip&&<option value="">No animation</option>}{available.map(c=><option key={c.id} value={c.id}>{c.label||c.id}</option>)}</select></label>
 {clip&&<>
 <div className="inspector-grid">{number('Animation starts (s)',start*durationS/100,v=>attempt(()=>replace(retimeClip(clip,v/durationS*100,v/durationS*100+(end-start),beats,context))))}{number('Animation duration (s)',(end-start)*durationS/100,v=>attempt(()=>replace(retimeClip(clip,start,start+v/durationS*100,beats,context))),{min:.01})}</div>
 <div className="keyframe-editor-actions"><button type="button" title="Adds a keyframe at the current playhead, using its current appearance" onClick={()=>attempt(()=>{const result=insertKeyframe(clip,percent,beats,context);replace(result.clip);useEditorStore.getState().selectKeyframe(layer.id,clip.id,result.index,percent);})}>+ Keyframe here</button><button type="button" onClick={()=>useEditorStore.getState().setPercent(start)}>Go to start</button><button type="button" onClick={()=>useEditorStore.getState().setPercent(end)}>Go to end</button></div>
 <div className="keyframe-picker" aria-label="Animation keyframes">{frames.map((f,i)=><button type="button" key={f.index} aria-pressed={selected?.index===f.index} onClick={()=>useEditorStore.getState().selectKeyframe(layer.id,clip.id,f.index,f.at)} title={clip.preset!=='custom'?'Preset keyframe; editing makes this clip custom':`Keyframe ${i+1}`}><span>◆ {i+1}</span><strong>{(f.at*durationS/100).toFixed(2)}s</strong></button>)}</div>
 {selected?<div data-keyframe-editor className="selected-keyframe-editor">
 <strong>Keyframe {frames.findIndex(f=>f.index===selected.index)+1}</strong>
 {clip.preset!=='custom'&&<span className="inspector-note" title="The preset is converted to its existing keyframes only when you make an edit. Other animations are unchanged.">From {clip.preset} preset ⓘ</span>}
 {clip.geometryEdits?.length>0&&<span className="inspector-note" title="These are authored keyframe values. Version-specific position offsets from the Layout controls are added by the renderer.">Version position offsets also apply ⓘ</span>}
 {number('Keyframe time (s)',selected.at*durationS/100,v=>edit({at:{value:v,unit:'seconds'}}),{min:0,max:durationS})}
 <div className="inspector-grid">{move('X')}{move('Y')}{number('Opacity (%)',(selected.frame.opacity??effective.opacity??1)*100,v=>edit({opacity:v/100}),{min:0,max:100})}{Array.isArray(selected.frame.scale??effective.scale)?(selected.frame.scale??effective.scale).map((v,i)=>number(`Scale ${i===0?'X':'Y'} (%)`,v*100,value=>{const scale=[...(selected.frame.scale??effective.scale)];scale[i]=value/100;edit({scale});},{min:.1})):number('Scale (%)',Number(selected.frame.scale??effective.scale??1)*100,v=>edit({scale:v/100}),{min:.1})}</div>
 <label className="inspector-field"><span>Easing to next keyframe</span><select aria-label="Keyframe easing" value={selected.frame.easing||'linear'} onChange={e=>edit({easing:e.target.value})}>{['linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.16, 1, 0.3, 1)'].map(v=><option key={v} value={v}>{v==='cubic-bezier(0.16, 1, 0.3, 1)'?'Soft ease out':v}</option>)}{selected.frame.easing&&!['linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.16, 1, 0.3, 1)'].includes(selected.frame.easing)&&<option value={selected.frame.easing}>Custom curve</option>}</select></label>
 <details open={['left','top','width','height'].some(k=>selected.frame[k]!==undefined)}><summary>Layout position and size</summary><div className="inspector-grid">{['left','top','width','height'].map(field=>number(({left:'Position X',top:'Position Y',width:'Frame width',height:'Frame height'})[field],selected.frame[field]??effective[field]??layer.base?.[field]??0,v=>edit({[field]:v})))}</div></details>
 <details><summary>Timing reference</summary><label className="inspector-field"><span>Named beat or percentage</span><TimingReference value={typeof selected.frame.at==='object'?selected.at:selected.frame.at} onCommit={at=>edit({at})}/></label></details>
 <button type="button" disabled={frames.length<=2||Boolean(clip.geometryEdits?.length)} title={clip.geometryEdits?.length?'This clip has indexed position offsets; removing a frame would invalidate them':'Remove this keyframe'} onClick={()=>attempt(()=>useEditorStore.getState().removeSelectedKeyframe())}>Remove keyframe</button>
 </div>:<p className="inspector-note">Select a diamond to edit its values. Drag it in the timeline to change its time.</p>}
 </>}
 <details><summary>Add another animation</summary><div className="motion-action-grid">{['fade','slideInRight','fadeUp','popPulse'].map(p=><button key={p} type="button" onClick={()=>useEditorStore.getState().addCreativeClip(layer.id,p)}>{({fade:'Fade',slideInRight:'Slide',fadeUp:'Fade up',popPulse:'Pop'})[p]}</button>)}</div></details>
 {clip&&<details><summary>Preset settings & sharing</summary><p className="inspector-note">{clip.preset==='custom'?'Custom keyframes':'Preset: '+clip.preset}</p>{clip.preset!=='custom'&&<><MotionTimingControls clip={clip} durationS={durationS} beats={beats} onChange={(field,value,target)=>useEditorStore.getState().updateCreativeLayerClipValue(layer.id,clip.id,field,value,target)}/><MotionDistanceControls clip={clip} onChange={(field,value,target)=>useEditorStore.getState().updateCreativeLayerClipValue(layer.id,clip.id,field,value,target)}/></>}<button type="button" onClick={()=>useEditorStore.getState().copySelectedClipToAnimationFamily()}>Copy animation to family</button></details>}
 {error&&<p role="alert" className="keyframe-error">{error}</p>}
 </div>;
}
