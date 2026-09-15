'use client';

import { resolveTimeRef } from '@/lib/creative-compiler';
import type { MotionTime } from '@/lib/motion-units';

type Clip = { preset: string; start?: unknown; end?: unknown; durationPct?: number; params?: Record<string, unknown>; keyframes?: Array<Record<string, unknown>> };
type Props = { clip: Clip; durationS: number; beats?: Record<string, number>; onChange: (field: string, value: unknown, target?: 'params' | 'clip') => void };

function TimeControl({ label, value, durationS, beats, onChange }: {label:string;value:unknown;durationS:number;beats:Record<string,number>;onChange:(value:unknown)=>void}) {
  const object = value && typeof value === 'object' ? value as MotionTime : null;
  const named = !object && !Number.isFinite(Number(value));
  const unit = object?.unit || (named ? 'beat' : 'timeline-percent');
  const numeric = object?.value ?? value;
  return <div className="inspector-grid">
    <label className="inspector-field"><span>{label}</span><input type={named ? 'text':'number'} value={String(numeric ?? 0)} onChange={event=>onChange(named ? event.target.value : {value:Number(event.target.value),unit})}/></label>
    <label className="inspector-field"><span>{label} time unit</span><select value={unit} onChange={event=>{
      const percent = resolveTimeRef(value as Parameters<typeof resolveTimeRef>[0],beats,durationS);
      onChange({value:event.target.value==='seconds'?percent*durationS/100:percent,unit:event.target.value});
    }}>
      {named ? <option value="beat">Named beat</option>:null}
      <option value="timeline-percent">% of timeline</option><option value="seconds">Seconds</option>
    </select></label>
  </div>;
}

export function MotionTimingControls({clip,durationS,beats={},onChange}:Props) {
  const render = (label:string,value:unknown,apply:(value:unknown)=>void) => <TimeControl label={label} value={value} beats={beats} durationS={durationS} onChange={apply}/>;
  return <div aria-label="Motion timing">
    {clip.preset === 'custom' && clip.keyframes?.length ? clip.keyframes.map((frame,index)=><div key={index}>{render(`Keyframe ${index+1} time`,frame.at,value=>onChange('keyframes',clip.keyframes?.map((item,i)=>i===index?{...item,at:value}:item),'clip'))}</div>) : <>
      {render('Clip start',clip.start ?? 0,value=>onChange('start',value,'clip'))}
      {render('Clip end',clip.end ?? 100,value=>onChange('end',value,'clip'))}
      {render('Enter duration',clip.params?.enter_duration ?? (clip.preset==='waveSweep' ? clip.params?.sweep_duration_pct : clip.params?.enter_duration_pct) ?? clip.durationPct ?? (clip.preset==='slideInRight'||clip.preset==='waveSweep'?7:clip.preset==='fadeUp'?2:clip.preset==='popPulse'?3:1),value=>onChange('enter_duration',value,'params'))}
      {render('Exit duration',clip.params?.fade_duration ?? clip.params?.fade_pct ?? (clip.preset==='waveSweep'?3:2),value=>onChange('fade_duration',value,'params'))}
    </>}
  </div>;
}
