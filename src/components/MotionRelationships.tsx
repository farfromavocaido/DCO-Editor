// @ts-nocheck
'use client';
import {useEditorStore} from '@/store/editor-store';
import {linkedMotionMembers,clipBeatReferences,detachClipTiming} from '@/lib/timeline-relationships';
import {beatLabel} from '@/lib/timeline-beats';
export function MotionRelationships({layer,clip,beats}){
 const document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size),scope=useEditorStore(s=>s.motionEditScope);
 if(!clip)return null;
 const members=linkedMotionMembers(document,size,layer.id,clip.id),refs=clipBeatReferences(clip,beats);
 const detach=()=>{
  useEditorStore.setState({motionEditScope:'single'});
  const next={...clip,linked:false};delete next.motionLinkId;
  useEditorStore.getState().replaceEditorClip(layer.id,clip.id,next);
 };
 return <div className="motion-relationships">
  {members.length>1?<><span title={members.map(m=>m.layer.label||m.layer.id).join(', ')}>{members.length} linked sequences ⓘ</span><div className="motion-view-toggle"><button aria-pressed={scope==='single'} onClick={()=>useEditorStore.setState({motionEditScope:'single'})}>Edit this one</button><button aria-pressed={scope==='linked'} onClick={()=>useEditorStore.setState({motionEditScope:'linked'})}>Edit linked</button></div><button onClick={detach}>Make independent</button></>:<span title="Using the same preset does not link two sequences.">Independent motion</span>}
  {refs.length>0&&<details><summary title="Shared timing does not share movement, opacity or easing values.">Timing anchors · {refs.length}</summary>{refs.map(id=><button key={id} onClick={()=>{useEditorStore.setState({selectedBeatId:id});useEditorStore.getState().setPercent(beats[id]);}}>{beatLabel(document,id)}</button>)}<button title="Keep this sequence’s current timing but remove its beat references. Other versions using this sequence also use these fixed times." onClick={()=>{useEditorStore.setState({motionEditScope:'single'});useEditorStore.getState().replaceEditorClip(layer.id,clip.id,detachClipTiming(clip,beats,document.clock.durationS));}}>Detach timing</button></details>}
 </div>;
}
