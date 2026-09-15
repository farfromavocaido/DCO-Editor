/** Relative distance values are percentages of the named reference, never of the animated element. */
export type MotionDistance = number | { value: number; unit: 'px' | 'canvas' | 'parent' };
export type MotionTime = { value: number; unit: 'seconds' | 'timeline-percent' };
export type MotionContext = {
  canvas?: { width: number; height: number };
  parent?: { width: number; height: number };
  durationS?: number;
};

export const resolveMotionDistance = (distance: MotionDistance, axis: 'x' | 'y', context: MotionContext = {}) => {
  if (typeof distance !== 'object' || distance === null) {
    const pixels = Number(distance);
    if (!Number.isFinite(pixels)) throw new Error(`Invalid pixel motion distance: ${String(distance)}`);
    return pixels;
  }
  if (!Number.isFinite(distance.value)) throw new Error('Motion distance must be finite');
  if (distance.unit === 'px') return distance.value;
  if (distance.unit !== 'canvas' && distance.unit !== 'parent') throw new Error(`Unknown motion distance unit: ${distance.unit}`);
  const dimension = context[distance.unit]?.[axis === 'x' ? 'width' : 'height'];
  if (!Number.isFinite(dimension) || Number(dimension) <= 0) throw new Error(`Motion distance requires ${distance.unit} ${axis === 'x' ? 'width' : 'height'}`);
  return Number(((distance.value / 100) * Number(dimension)).toFixed(6));
};

export const resolveMotionTime = (time: MotionTime, durationS?: number) => {
  if (!Number.isFinite(time.value)) throw new Error('Motion time must be finite');
  if (time.unit === 'timeline-percent') return time.value;
  if (time.unit !== 'seconds') throw new Error(`Unknown motion time unit: ${time.unit}`);
  if (!Number.isFinite(durationS) || Number(durationS) <= 0) throw new Error('Motion in seconds requires timeline duration');
  return Number(((time.value / Number(durationS)) * 100).toFixed(6));
};

/** Resolve units for embedded legacy runtimes while retaining named beat references. */
export const resolveClipMotionUnits = (clip: Record<string, any>, context: MotionContext = {}) => {
  const time = (value: any) => value && typeof value === 'object' ? resolveMotionTime(value, context.durationS) : value;
  const next: Record<string, any> = { ...clip, start: time(clip.start), end: time(clip.end), params: { ...(clip.params || {}) } };
  const axes: Record<string, 'x'|'y'> = {enter_distance:'x',enter_distance_px:'x',enter_dy:'y',exit_dy:'y',settled_dy:'y',anchor_y:'y',start_x:'x',end_x:'x',start_y:'y',end_y:'y',hold_y:'y'};
  for (const [field, axis] of Object.entries(axes)) {
    if (next.params[field] !== undefined) next.params[field] = resolveMotionDistance(next.params[field], axis, context);
  }
  if (next.params.enter_distance !== undefined) next.params.enter_distance_px = next.params.enter_distance;
  if (next.params.enter_duration) next.params.enter_duration_pct = time(next.params.enter_duration);
  if (next.params.fade_duration) next.params.fade_pct = time(next.params.fade_duration);
  for (const field of ['pulse_start','pulse_peak','pulse_end']) if (next.params[field] !== undefined) next.params[field] = time(next.params[field]);
  if (clip.keyframes) next.keyframes = clip.keyframes.map((frame: Record<string, any>) => ({...frame,at:time(frame.at),...(frame.translate?{translate:[resolveMotionDistance(frame.translate[0],'x',context),resolveMotionDistance(frame.translate[1],'y',context)]}:{})}));
  return next;
};
