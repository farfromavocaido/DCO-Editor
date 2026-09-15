'use client';

import type { MotionDistance } from '@/lib/motion-units';

type Clip = { preset: string; params?: Record<string, unknown>; keyframes?: Array<Record<string, unknown>> };
type Props = { clip: Clip; onChange: (field: string, value: unknown, target?: 'params' | 'clip') => void };
const axes: Record<string, 'x' | 'y'> = {enter_distance:'x',enter_distance_px:'x',enter_dy:'y',settled_dy:'y',exit_dy:'y',anchor_y:'y',start_x:'x',end_x:'x',start_y:'y',end_y:'y',hold_y:'y'};

function DistanceControl({ label, distance, onChange }: { label: string; distance: MotionDistance; onChange: (value: MotionDistance) => void }) {
  const value = typeof distance === 'object' ? distance.value : Number(distance);
  const unit = typeof distance === 'object' ? distance.unit : 'px';
  return <div className="inspector-grid">
    <label className="inspector-field"><span>{label}</span><input type="number" value={Number.isFinite(value) ? value : 0} onChange={event => onChange({value:Number(event.target.value),unit})}/></label>
    <label className="inspector-field"><span>{label} reference</span><select value={unit} onChange={event => onChange({value,unit:event.target.value as 'px'|'canvas'|'parent'})}>
      <option value="px">Pixels</option><option value="canvas">% of canvas</option><option value="parent">% of parent</option>
    </select></label>
  </div>;
}

export function MotionDistanceControls({ clip, onChange }: Props) {
  const params = clip.params || {};
  const fields = Object.keys(params).filter(field => field in axes);
  if (clip.preset === 'slideInRight' && !fields.some(field=>field==='enter_distance'||field==='enter_distance_px')) fields.unshift('enter_distance');
  if (clip.preset === 'fadeUp' && !fields.includes('enter_dy')) fields.unshift('enter_dy');
  return <div aria-label="Motion distances">
    {fields.map(field => <DistanceControl key={field} label={field.replaceAll('_',' ')} distance={(params[field] ?? (field === 'enter_distance' ? 320 : -7)) as MotionDistance} onChange={value=>onChange(field,value,'params')}/>)}
    {clip.preset === 'custom' ? clip.keyframes?.map((frame,index) => Array.isArray(frame.translate) ? <div key={index}>
      {(['x','y'] as const).map((axis,axisIndex) => <DistanceControl key={axis} label={`Keyframe ${index+1} ${axis}`} distance={(frame.translate as MotionDistance[])[axisIndex]} onChange={value=>onChange('keyframes',clip.keyframes?.map((item,i)=>i===index?{...item,translate:(item.translate as MotionDistance[]).map((distance,j)=>j===axisIndex?value:distance)}:item),'clip')}/>)}
    </div> : null) : null}
  </div>;
}

export const isMotionDistanceField = (field: string) => field in axes;
