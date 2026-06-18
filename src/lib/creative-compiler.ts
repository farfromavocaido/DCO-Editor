// @ts-nocheck

export type TimeRef = number | string;

export type CreativeKeyframe = {
  at: number;
  translate?: [number, number];
  scale?: number;
  opacity?: number;
  easing?: string;
};

export type AnimationClip = {
  id: string;
  preset: 'fade' | 'slideInRight' | 'fadeUp' | 'popPulse' | 'waveSweep' | 'custom';
  start: TimeRef;
  end?: TimeRef;
  durationPct?: number;
  params?: Record<string, unknown>;
  keyframes?: CreativeKeyframe[];
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const numberOr = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const legacyMotionDefaults = {
  enter: {
    durationPct: 7,
    distancePx: 320,
    easing: 'ease-out',
  },
  exit: {
    durationPct: 2,
    dropPx: 5,
  },
  pulse: {
    scalePeak: 1.15,
    easing: 'ease-in-out',
  },
  waveSweep: {
    durationPct: 7,
    fadePct: 3,
    easing: 'ease-out',
  },
};

const defaultEnterDurationForPreset = (preset: AnimationClip['preset'], fallback?: number) => {
  if (fallback !== undefined) return fallback;
  if (preset === 'slideInRight') return legacyMotionDefaults.enter.durationPct;
  if (preset === 'fadeUp') return 2;
  if (preset === 'popPulse') return 3;
  if (preset === 'fade') return 1;
  return 1;
};

export const resolveTimeRef = (ref: TimeRef, beats: Record<string, number>) => {
  if (typeof ref === 'number') return ref;
  const numeric = Number(ref);
  if (Number.isFinite(numeric)) return numeric;
  const match = String(ref).match(/^([a-z0-9_]+)\s*([+-]\s*\d+)?$/i);
  if (!match) throw new Error(`Bad time ref: ${ref}`);
  const [, name, offset] = match;
  if (beats[name] === undefined) throw new Error(`Unknown beat: ${name}`);
  const value = beats[name] + (offset ? Number.parseInt(offset.replace(/\s/g, ''), 10) : 0);
  if (value < 0 || value > 100) throw new Error(`Time ref ${ref} resolves to ${value}%`);
  return value;
};

const resolveParamTime = (
  params: Record<string, unknown>,
  name: string,
  beats: Record<string, number>,
  fallback: number,
) => {
  if (params[name] === undefined || params[name] === '') return fallback;
  return resolveTimeRef(params[name] as TimeRef, beats);
};

const normalizeKeyframes = (keyframes: CreativeKeyframe[]) => {
  if (!keyframes.length) return [{ at: 0, translate: [0, 0], scale: 1, opacity: 1 }];
  const out = [...keyframes].sort((a, b) => a.at - b.at);
  const first = out[0];
  const last = out[out.length - 1];
  if (first.at !== 0) out.unshift({ ...first, at: 0 });
  if (last.at !== 100) out.push({ ...last, at: 100 });
  return out;
};

const compileClip = (clip: AnimationClip, beats: Record<string, number>) => {
  const params = clip.params || {};
  if (clip.preset === 'custom') {
    return normalizeKeyframes((clip.keyframes || []).map((keyframe) => ({
      ...keyframe,
      at: resolveTimeRef(keyframe.at, beats),
    })));
  }

  const start = resolveTimeRef(clip.start, beats);
  const end = resolveTimeRef(clip.end ?? 100, beats);
  const enterDuration = numberOr(
    params.enter_duration_pct,
    defaultEnterDurationForPreset(clip.preset, clip.durationPct),
  );
  const fadePct = numberOr(params.fade_pct, legacyMotionDefaults.exit.durationPct);

  if (clip.preset === 'fade') {
    const settled = Math.min(end, start + enterDuration);
    return normalizeKeyframes([
      { at: start, opacity: 0 },
      { at: settled, opacity: 1 },
      { at: Math.max(settled, end - fadePct), opacity: 1 },
      { at: end, opacity: 0 },
    ]);
  }

  if (clip.preset === 'slideInRight') {
    const settled = Math.min(end, start + enterDuration);
    return normalizeKeyframes([
      {
        at: start,
        translate: [numberOr(params.enter_distance_px, legacyMotionDefaults.enter.distancePx), 0],
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, 0], opacity: 1 },
      { at: Math.max(settled, end - fadePct), translate: [0, 0], opacity: 1 },
      { at: end, translate: [0, numberOr(params.exit_dy, legacyMotionDefaults.exit.dropPx)], opacity: 0 },
    ]);
  }

  if (clip.preset === 'fadeUp') {
    const settled = Math.min(end, start + enterDuration);
    return normalizeKeyframes([
      {
        at: start,
        translate: [0, numberOr(params.enter_dy, -7)],
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, numberOr(params.settled_dy, 0)], opacity: 1 },
      { at: Math.max(settled, end - fadePct), translate: [0, numberOr(params.settled_dy, 0)], opacity: 1 },
      { at: end, translate: [0, numberOr(params.exit_dy, legacyMotionDefaults.exit.dropPx)], opacity: 0 },
    ]);
  }

  if (clip.preset === 'popPulse') {
    const anchorY = numberOr(params.anchor_y, 0);
    const settled = Math.min(end, start + enterDuration);
    const pulseStart = resolveParamTime(params, 'pulse_start', beats, Math.min(end, settled + 8));
    const pulsePeak = resolveParamTime(params, 'pulse_peak', beats, Math.min(end, pulseStart + 2));
    const pulseEnd = resolveParamTime(params, 'pulse_end', beats, Math.min(end, pulsePeak + 1));
    return normalizeKeyframes([
      {
        at: start,
        translate: [0, anchorY],
        scale: numberOr(params.start_scale, 0.297),
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, anchorY], scale: 1, opacity: 1 },
      {
        at: pulseStart,
        translate: [0, anchorY],
        scale: 1,
        opacity: 1,
        easing: String(params.ease_pulse || legacyMotionDefaults.pulse.easing),
      },
      { at: pulsePeak, translate: [0, anchorY], scale: numberOr(params.pulse_scale, legacyMotionDefaults.pulse.scalePeak), opacity: 1 },
      { at: pulseEnd, translate: [0, anchorY], scale: 1, opacity: 1 },
      { at: Math.max(pulseEnd, end - fadePct), translate: [0, anchorY], scale: 1, opacity: 1 },
      { at: end, translate: [0, anchorY], scale: 1, opacity: 0 },
    ]);
  }

  if (clip.preset === 'waveSweep') {
    const waveFadePct = numberOr(params.fade_pct, legacyMotionDefaults.waveSweep.fadePct);
    const sweepEnd = Math.min(end, start + numberOr(params.sweep_duration_pct, legacyMotionDefaults.waveSweep.durationPct));
    const startY = params.start_y !== undefined ? numberOr(params.start_y, 0) : numberOr(params.hold_y, 0);
    const endY = params.end_y !== undefined ? numberOr(params.end_y, 0) : numberOr(params.hold_y, 0);
    return normalizeKeyframes([
      {
        at: start,
        translate: [numberOr(params.start_x, 0), startY],
        opacity: 1,
        easing: String(params.ease_in || legacyMotionDefaults.waveSweep.easing),
      },
      { at: sweepEnd, translate: [numberOr(params.end_x, 0), endY], opacity: 1 },
      { at: Math.max(sweepEnd, end - waveFadePct), translate: [numberOr(params.end_x, 0), endY], opacity: 1 },
      { at: end, translate: [numberOr(params.end_x, 0), endY], opacity: 0 },
    ]);
  }

  throw new Error(`Unknown animation preset: ${clip.preset}`);
};

export const compileAnimationClips = (
  clips: AnimationClip[] = [],
  beats: Record<string, number> = {},
) => {
  if (!clips.length) return normalizeKeyframes([]);
  return normalizeKeyframes(clips.flatMap((clip) => compileClip(clip, beats)));
};

export const frameAtPercent = (keyframes: CreativeKeyframe[] = [], percent = 0) => {
  if (!keyframes.length) return { translate: [0, 0], scale: 1, opacity: 1 };
  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];
  for (let index = 0; index < keyframes.length; index += 1) {
    if (keyframes[index].at <= percent) prev = keyframes[index];
    if (keyframes[index].at >= percent) {
      next = keyframes[index];
      break;
    }
  }
  const span = Math.max(1, next.at - prev.at);
  const ratio = prev.at === next.at ? 0 : (percent - prev.at) / span;
  const prevTranslate = prev.translate || [0, 0];
  const nextTranslate = next.translate || prevTranslate;
  return {
    translate: [
      lerp(prevTranslate[0], nextTranslate[0], ratio),
      lerp(prevTranslate[1], nextTranslate[1], ratio),
    ],
    scale: lerp(prev.scale ?? 1, next.scale ?? prev.scale ?? 1, ratio),
    opacity: lerp(prev.opacity ?? 1, next.opacity ?? prev.opacity ?? 1, ratio),
  };
};
