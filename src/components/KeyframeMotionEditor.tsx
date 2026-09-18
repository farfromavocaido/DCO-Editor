// @ts-nocheck
'use client';
import {MotionRelationships} from './MotionRelationships';
import {MotionTimingControls} from './MotionTimingControls';
import {MotionDistanceControls} from './MotionDistanceControls';
import {useEffect,useState} from 'react';
import {clipsForProfile} from '@/lib/headline-motion';
import {activeFrameScope} from '@/lib/timing-profiles';
import {useEditorStore} from '@/store/editor-store';
import {editableKeyframes,retimeClip,insertKeyframe} from '@/lib/keyframe-editing';
import {compileAnimationClips,frameAtPercent,resolveTimeRef} from '@/lib/creative-compiler';
import {motionTransitions,animationLabel} from '@/lib/motion-transitions';
import {MotionTransitionEditor} from './MotionTransitionEditor';
import {beatLabel} from '@/lib/timeline-beats';
import {resolveMotionDistance} from '@/lib/motion-units';

function CommitNumber({label,value,onCommit,...rest}){
 const formatted=value!==undefined&&value!==null&&Number.isFinite(Number(value))?String(Number(Number(value).toFixed(3))):'';const [draft,setDraft]=useState(formatted);
 useEffect(()=>setDraft(formatted),[formatted]);
 const help=label.startsWith('Offset')?'Movement from the layout position at this moment. Zero means no extra movement.':label.startsWith('Layout')?'Absolute layout coordinate at this moment, before movement offsets.':label.startsWith('Frame')?'Animated box size at this moment. Use layout means this animation does not set it.':undefined;
 return <label className="inspector-field" title={help}><span>{label}</span><input aria-label={label} type="number" step="any" placeholder="Use layout" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft.trim()&&Number.isFinite(Number(draft))&&Number(draft)!==Number(value))onCommit(Number(draft));setDraft(formatted);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} {...rest}/></label>;
}
function TimingReference({value,onCommit}){
 const [draft,setDraft]=useState(String(value));useEffect(()=>setDraft(String(value)),[value]);
 return <input aria-label="Keyframe timing reference" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(draft!==String(value))onCommit(draft!==''&&Number.isFinite(Number(draft))?Number(draft):draft);setDraft(String(value));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>;
}
export function KeyframeMotionEditor({layer,clip:resolvedClip,beats,canvas,durationS}){
 const scopes=useEditorStore.getState().activeScopes();
 const document=useEditorStore(s=>s.creativeDocument),view=useEditorStore(s=>s.motionView),transitionSelection=useEditorStore(s=>s.selectedTransition);
 const available=clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes);
 const clip=layer.clips?.find(c=>c.id===resolvedClip?.id)||resolvedClip;
 const selection=useEditorStore(s=>s.selectedKeyframe),percent=useEditorStore(s=>s.percent),[error,setError]=useState('');
 const context={canvas,parent:canvas,durationS},frames=clip?editableKeyframes(clip,beats,context):[];
 const transitions=clip?motionTransitions(clip,beats,context):[];
 const transition=transitionSelection?.layerId===layer.id&&transitionSelection?.clipId===clip?.id?transitions.find(t=>t.id===transitionSelection.id):null;
 const selected=selection?.layerId===layer.id&&selection?.clipId===clip?.id?frames.find(f=>f.index===selection.index):null;
 const effective=selected?frameAtPercent(compileAnimationClips([clip],beats,context),selected.at):null;
 const start=clip?.preset==='custom'?frames[0]?.at:resolveTimeRef(clip?.start??0,beats,durationS),end=clip?.preset==='custom'?frames.at(-1)?.at:resolveTimeRef(clip?.end??100,beats,durationS);
 const attempt=fn=>{try{fn();setError('');}catch(e){setError(e.message);}};
 const replace=next=>useEditorStore.getState().replaceEditorClip(layer.id,clip.id,next);
 const edit=patch=>attempt(()=>useEditorStore.getState().editSelectedKeyframe(patch));
 useEffect(()=>{setError('');if(selected||transition)window.document.querySelector('[data-keyframe-editor]')?.scrollIntoView({block:'nearest'});},[selection?.layerId,selection?.clipId,selection?.index,transitionSelection?.layerId,transitionSelection?.clipId,transitionSelection?.id]);
 const number=(label,value,change,extra={})=><CommitNumber key={label} label={label} value={value} onCommit={change} {...extra}/>;
 const move=(axis)=>{const index=axis==='X'?0:1,value=selected.frame.translate?.[index]??effective.translate?.[index]??0,unit=typeof value==='object'?value.unit:'px',n=typeof value==='object'?value.value:value;
 return <div className="keyframe-distance" key={axis}>{number(`Offset ${axis}`,n,v=>{const translate=[...(selected.frame.translate||effective.translate||[0,0])];translate[index]=unit==='px'?v:{value:v,unit};edit({translate});})}<label className="inspector-field"><span>Units</span><select aria-label={`Offset ${axis} units`} value={unit} onChange={e=>{const translate=[...(selected.frame.translate||effective.translate||[0,0])],px=resolveMotionDistance(value,axis.toLowerCase(),context),nextUnit=e.target.value;translate[index]=nextUnit==='px'?px:{value:px/canvas[axis==='X'?'width':'height']*100,unit:nextUnit};edit({translate});}}><option value="px">Pixels</option><option value="canvas">% of ad</option><option value="parent">% of parent</option></select></label></div>;
 };
 return <div className="keyframe-motion-editor">
 <label className="inspector-field"><span title="One animation sequence on this layer; it can contain several transitions.">Animation sequence</span><select aria-label="Selected animation" value={clip?.id||''} onChange={e=>useEditorStore.getState().selectClip(layer.id,e.target.value)}>{!clip&&<option value="">No animation</option>}{available.map(c=><option key={c.id} value={c.id}>{animationLabel(c)}</option>)}</select></label>
 {clip&&<>
 <MotionRelationships layer={layer} clip={clip} beats={beats}/>
 <div className="inspector-grid">{number('Animation starts (s)',start*durationS/100,v=>attempt(()=>replace(retimeClip(clip,v/durationS*100,v/durationS*100+(end-start),beats,context))))}{number('Animation duration (s)',(end-start)*durationS/100,v=>attempt(()=>replace(retimeClip(clip,start,start+v/durationS*100,beats,context))),{min:.01})}</div>
 <div className="motion-view-toggle" role="group" aria-label="Motion detail"><button aria-pressed={view!=='keyframes'} onClick={()=>useEditorStore.setState({motionView:'transitions'})}>Transitions</button><button aria-pressed={view==='keyframes'} onClick={()=>useEditorStore.setState({motionView:'keyframes'})}>Keyframes</button></div>
 {view!=='keyframes'?<>
 <div className="transition-picker">{transitions.map(t=><button key={t.id} aria-pressed={transition?.id===t.id} onClick={()=>useEditorStore.getState().selectTransition(layer.id,clip.id,t.id,t.start)}><span>{t.label}</span><small>{(t.start*durationS/100).toFixed(2)}–{(t.end*durationS/100).toFixed(2)}s</small></button>)}</div>
 {transition&&<MotionTransitionEditor key={`${clip.id}:${transition.id}`} layer={layer} clip={clip} transition={transition} beats={beats} context={context} NumberField={CommitNumber}/>}
 {!transitions.length&&<span className="inspector-note">No changing spans. Open Keyframes to edit this sequence.</span>}
 </>:<>
 <div className="keyframe-editor-actions"><button type="button" title="Adds a keyframe at the current playhead, using its current appearance" onClick={()=>attempt(()=>{const result=insertKeyframe(clip,percent,beats,context);replace(result.clip);useEditorStore.getState().selectKeyframe(layer.id,clip.id,result.index,percent);})}>+ Keyframe here</button><button type="button" onClick={()=>useEditorStore.getState().setPercent(start)}>Go to start</button><button type="button" onClick={()=>useEditorStore.getState().setPercent(end)}>Go to end</button></div>
 <div className="keyframe-picker" aria-label="Animation keyframes">{frames.map((f,i)=><button type="button" key={f.index} aria-pressed={selected?.index===f.index} onClick={()=>useEditorStore.getState().selectKeyframe(layer.id,clip.id,f.index,f.at)} title={clip.preset!=='custom'?'Preset keyframe; editing makes this clip custom':`Keyframe ${i+1}`}><span>◆ {i+1}</span><strong>{(f.at*durationS/100).toFixed(2)}s</strong></button>)}</div>
 {selected?<div data-keyframe-editor className="selected-keyframe-editor">
 <strong>Keyframe {frames.findIndex(f=>f.index===selected.index)+1}</strong>
 {clip.preset!=='custom'&&<span className="inspector-note" title="The preset is converted to its existing keyframes only when you make an edit. Other animations are unchanged.">From {clip.preset} preset ⓘ</span>}
 {clip.geometryEdits?.length>0&&<span className="inspector-note" title="These are authored keyframe values. Version-specific position offsets from the Layout controls are added by the renderer.">Version position offsets also apply ⓘ</span>}
 {number('Keyframe time (s)',selected.at*durationS/100,v=>edit({at:{value:v,unit:'seconds'}}),{min:0,max:durationS})}
 <div className="inspector-grid">{move('X')}{move('Y')}{number('Opacity (%)',(selected.frame.opacity??effective.opacity??1)*100,v=>edit({opacity:v/100}),{min:0,max:100})}{Array.isArray(selected.frame.scale??effective.scale)?(selected.frame.scale??effective.scale).map((v,i)=>number(`Scale ${i===0?'X':'Y'} (%)`,v*100,value=>{const scale=[...(selected.frame.scale??effective.scale)];scale[i]=value/100;edit({scale});},{min:.1})):number('Scale (%)',Number(selected.frame.scale??effective.scale??1)*100,v=>edit({scale:v/100}),{min:.1})}</div>
 {selected.index!==frames.at(-1)?.index&&<label className="inspector-field"><span>Easing to next keyframe</span><select aria-label="Keyframe easing" value={selected.frame.easing||'linear'} onChange={e=>edit({easing:e.target.value})}>{['linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.16, 1, 0.3, 1)'].map(v=><option key={v} value={v}>{v==='cubic-bezier(0.16, 1, 0.3, 1)'?'Soft ease out':v}</option>)}{selected.frame.easing&&!['linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.16, 1, 0.3, 1)'].includes(selected.frame.easing)&&<option value={selected.frame.easing}>Custom curve</option>}</select></label>}
 <details open={['left','top','width','height'].some(k=>selected.frame[k]!==undefined)}><summary title="Absolute layout values at this moment, before movement offsets. Empty fields use the layout.">Layout position and size</summary><div className="inspector-grid">{['left','top','width','height'].map(field=>number(({left:'Layout X (px)',top:'Layout Y (px)',width:'Frame width',height:'Frame height'})[field],selected.frame[field]??effective[field],v=>edit({[field]:v})))}</div></details>
 <details><summary>Timing reference</summary><label className="inspector-field"><span>Named beat or percentage</span><select aria-label="Link keyframe to beat" value={typeof selected.frame.at==='string'&&beats[selected.frame.at]!==undefined?selected.frame.at:''} onChange={e=>{if(e.target.value)edit({at:e.target.value});}}><option value="">Choose beat…</option>{Object.keys(beats).map(id=><option key={id} value={id}>{beatLabel(document,id)}</option>)}</select><TimingReference value={typeof selected.frame.at==='object'?selected.at:selected.frame.at} onCommit={at=>edit({at})}/></label></details>
 <button type="button" disabled={frames.length<=2||Boolean(clip.geometryEdits?.length)} title={clip.geometryEdits?.length?'This clip has indexed position offsets; removing a frame would invalidate them':'Remove this keyframe'} onClick={()=>attempt(()=>useEditorStore.getState().removeSelectedKeyframe())}>Remove keyframe</button>
 </div>:<p className="inspector-note">Select a diamond to edit its values. Drag it in the timeline to change its time.</p>}
 </>}
 </>}
 <details><summary>Add another animation</summary><div className="motion-action-grid">{['fade','slideInRight','fadeUp','popPulse'].map(p=><button key={p} type="button" onClick={()=>useEditorStore.getState().addCreativeClip(layer.id,p)}>{({fade:'Fade',slideInRight:'Slide',fadeUp:'Fade up',popPulse:'Pop'})[p]}</button>)}</div></details>
 {clip&&<details><summary>Sequence settings & sharing</summary><label className="inspector-field"><span>Sequence name</span><input aria-label="Sequence name" key={`${clip.id}:${clip.label||''}`} defaultValue={animationLabel(clip)} onBlur={e=>{const label=e.target.value.trim();if(label&&label!==animationLabel(clip))replace({...clip,label});}}/></label><p className="inspector-note">{clip.preset==='custom'?'Custom keyframes':'Preset: '+clip.preset}</p>{clip.preset!=='custom'&&<><MotionTimingControls clip={clip} durationS={durationS} beats={beats} onChange={(field,value,target)=>useEditorStore.getState().updateCreativeLayerClipValue(layer.id,clip.id,field,value,target)}/><MotionDistanceControls clip={clip} onChange={(field,value,target)=>useEditorStore.getState().updateCreativeLayerClipValue(layer.id,clip.id,field,value,target)}/></>}<button type="button" onClick={()=>useEditorStore.getState().copySelectedClipToAnimationFamily()}>Copy animation to family</button></details>}
 {error&&<p role="alert" className="keyframe-error">{error}</p>}
 </div>;
}
