// @ts-nocheck
'use client';
import { useEffect, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { beatLabel, addTimelineBeat, renameTimelineBeat, keyTimelineBeats, setKeyTimelineBeat, moveTimelineBeat } from '@/lib/timeline-beats';
import {clipBeatReferences} from '@/lib/timeline-relationships';
import {clipsForProfile} from '@/lib/headline-motion';
import {activeFrameScope} from '@/lib/timing-profiles';

export function TimelineBeats({ document, beats, percent, onClose }) {
  const selected=useEditorStore(s=>s.selectedBeatId),[name,setName]=useState(''),[time,setTime]=useState('');
  const [error,setError]=useState('');
  const scopes=useEditorStore.getState().activeScopes(),size=useEditorStore.getState().size;
  useEffect(()=>{setName(selected?beatLabel(document,selected):'');setTime(String(Number(((selected?beats[selected]:percent)*document.clock.durationS/100).toFixed(3))));setError('');},[selected,document.clock]);
  const refs=(document.sizes[size]?.layers||[]).flatMap(layer=>clipsForProfile(layer.clips||[],activeFrameScope(scopes),scopes).filter(clip=>clipBeatReferences(clip,beats).includes(selected)).map(clip=>({layer,clip})));
  const publish=next=>useEditorStore.getState().applyCreativeOwnershipDocument({...document,clock:next.clock},'Updated timeline beat');
  const apply=()=>{try{
    if(!time.trim())throw new Error('Enter a time for the beat');
    let next=selected?renameTimelineBeat(document,selected,name):addTimelineBeat(document,name,Number(time)).document;
    if(selected&&Math.abs(Number(time)-beats[selected]*document.clock.durationS/100)>.0005)next=moveTimelineBeat(next,selected,Number(time),scopes);
    publish(next);setError('');if(!selected){setName('');}
  }catch(e){setError(e.message);}};
  return <div className="timeline-beat-manager" role="region" aria-label="Manage beats">
    <div className="keyframe-editor-actions"><strong>{selected?'Timing beat':'New beat'}</strong><button onClick={onClose} aria-label="Close beats manager">Close</button></div>
    <label className="inspector-field"><span>Beat</span><select aria-label="Beat to rename" value={selected||''} onChange={e=>{const id=e.target.value;useEditorStore.setState({selectedBeatId:id});if(id)useEditorStore.getState().setPercent(beats[id]);}}>
      <option value="">+ New beat</option>{Object.entries(beats).sort((a,b)=>a[1]-b[1]).map(([id,at])=><option key={id} value={id}>{beatLabel(document,id)} · {(at*document.clock.durationS/100).toFixed(2)}s</option>)}
    </select></label>
    <label className="inspector-field"><span>Name</span><input aria-label="Beat name" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="inspector-field" title="Changing timing moves animations anchored to this beat, across formats in the current frame arrangement."><span>Time (s)</span><input aria-label="Beat time (s)" type="number" step="0.1" min="0" max={document.clock.durationS} value={time} onChange={e=>setTime(e.target.value)}/></label>
    {selected&&<label className="beat-key-choice"><input type="checkbox" checked={keyTimelineBeats(document,beats).includes(selected)} onChange={e=>publish(setKeyTimelineBeat(document,selected,e.target.checked,beats))}/>Show as key beat</label>}
    <button onClick={apply}>{selected?'Apply beat':'Add beat'}</button>
    {selected&&<div className="beat-references"><strong>{refs.length} anchored sequences in this version</strong>{refs.map(({layer,clip})=><button key={`${layer.id}/${clip.id}`} onClick={()=>{useEditorStore.getState().selectClip(layer.id,clip.id);onClose();}}>{layer.label||layer.id}</button>)}{!refs.length&&<small>No direct clip references in this version.</small>}</div>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
