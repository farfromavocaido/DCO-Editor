// @ts-nocheck
'use client';
import { useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { beatLabel, addTimelineBeat, renameTimelineBeat } from '@/lib/timeline-beats';

export function TimelineBeats({ document, beats, percent, onClose }) {
  const [selected, setSelected] = useState(''), [name, setName] = useState('');
  const [time, setTime] = useState(String(Number((percent * document.clock.durationS / 100).toFixed(3))));
  const [error, setError] = useState('');
  const apply = () => {
    try {
      if (!selected && !time.trim()) throw new Error('Enter a time for the beat');
      const next = selected ? renameTimelineBeat(document, selected, name) : addTimelineBeat(document, name, Number(time)).document;
      useEditorStore.getState().applyCreativeOwnershipDocument({...document,clock:next.clock}, selected ? 'Renamed beat' : 'Added beat');
      setName(''); setSelected(''); setError('');
    } catch (e) { setError(e.message); }
  };
  return <div className="timeline-beat-manager" role="region" aria-label="Manage beats">
    <div className="keyframe-editor-actions"><strong>Beats</strong><button onClick={onClose} aria-label="Close beats manager">Close</button></div>
    <label className="inspector-field"><span>Beat</span><select aria-label="Beat to rename" value={selected} onChange={e => { const id=e.target.value;setSelected(id);setName(id?beatLabel(document,id):'');setError('');if(id)useEditorStore.getState().setPercent(beats[id]); }}>
      <option value="">+ New beat</option>{Object.entries(beats).sort((a,b)=>a[1]-b[1]).map(([id,at])=><option key={id} value={id}>{beatLabel(document,id)} · {(at*document.clock.durationS/100).toFixed(2)}s</option>)}
    </select></label>
    <label className="inspector-field"><span>Name</span><input aria-label="Beat name" value={name} onChange={e=>setName(e.target.value)} /></label>
    {!selected&&<label className="inspector-field"><span>Time (s)</span><input aria-label="New beat time (s)" type="number" step="0.1" min="0" max={document.clock.durationS} value={time} onChange={e=>setTime(e.target.value)}/></label>}
    <button onClick={apply}>{selected?'Rename beat':'Add beat'}</button>
    {error&&<p role="alert">{error}</p>}
  </div>;
}
