// @ts-nocheck

import { resolveMotionDistance, resolveMotionTime, type MotionContext, type MotionTime, type MotionDistance } from './motion-units';

export type TimeRef = number | string | MotionTime;

/** Uniform scale number, or `[scaleX, scaleY]` if ever needed. Prefer uniform for image assets. */
export type KeyframeScale = number | [number, number];

export type CreativeKeyframe = {
  at: number;
  translate?: [number, number];
  scale?: KeyframeScale;
  opacity?: number;
  /** Optional layout channels (px) — used when a clip must change box geometry mid-timeline. */
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  /** Optional ink color (e.g. skip-hold endframe handoff). Not interpolated. */
  color?: string;
  easing?: string;
};

export const normalizeScale = (scale: KeyframeScale | undefined): [number, number] => {
  if (Array.isArray(scale)) {
    return [Number(scale[0]) || 1, Number(scale[1]) || 1];
  }
  const n = scale === undefined ? 1 : Number(scale);
  const v = Number.isFinite(n) ? n : 1;
  return [v, v];
};

export const scalesEqual = (a: KeyframeScale | undefined, b: KeyframeScale | undefined) => {
  const [ax, ay] = normalizeScale(a);
  const [bx, by] = normalizeScale(b);
  return ax === bx && ay === by;
};

export const formatScale3d = (scale: KeyframeScale | undefined) => {
  const [sx, sy] = normalizeScale(scale);
  if (sx === 1 && sy === 1) return '';
  return `scale3d(${sx}, ${sy}, 1)`;
};

export const lerpScale = (
  from: KeyframeScale | undefined,
  to: KeyframeScale | undefined,
  t: number,
): KeyframeScale => {
  const [ax, ay] = normalizeScale(from);
  const [bx, by] = normalizeScale(to);
  const sx = lerp(ax, bx, t);
  const sy = lerp(ay, by, t);
  return sx === sy ? sx : [sx, sy];
};

export type AnimationClip = {
  id: string;
  preset: 'fade' | 'slideInRight' | 'fadeUp' | 'popPulse' | 'waveSweep' | 'custom';
  start: TimeRef;
  end?: TimeRef;
  durationPct?: number;
  params?: Record<string, unknown>;
  keyframes?: Array<Omit<CreativeKeyframe, 'at' | 'translate'> & { at: TimeRef; translate?: [MotionDistance, MotionDistance] }>;
  /** When set, clip applies only for these frame profiles (frames-3 / frames-4). */
  profiles?: string[];
  /** When set, clip applies only when any listed offer/CSS scope is active. */
  scopes?: string[];
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

export const resolveTimeRef = (ref: TimeRef, beats: Record<string, number>, durationS?: number) => {
  if (typeof ref === 'object' && ref !== null) return resolveMotionTime(ref, durationS);
  if (typeof ref === 'number') return ref;
  const numeric = Number(ref);
  if (Number.isFinite(numeric)) return numeric;
  const match = String(ref).match(/^([a-z0-9_]+)\s*([+-]\s*\d+(?:\.\d+)?)?$/i);
  if (!match) throw new Error(`Bad time ref: ${ref}`);
  const [, name, offset] = match;
  if (beats[name] === undefined) throw new Error(`Unknown beat: ${name}`);
  const value = beats[name] + (offset ? Number.parseFloat(offset.replace(/\s/g, '')) : 0);
  const rounded = Math.round(value * 1000) / 1000;
  if (rounded < 0 || rounded > 100) throw new Error(`Time ref ${ref} resolves to ${rounded}%`);
  return rounded;
};

const resolveParamTime = (
  params: Record<string, unknown>,
  name: string,
  beats: Record<string, number>,
  fallback: number,
  durationS?: number,
) => {
  if (params[name] === undefined || params[name] === '') return fallback;
  return resolveTimeRef(params[name] as TimeRef, beats, durationS);
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

/** Forward-fill missing translate/scale/opacity/layout so multi-clip merges never invent [0,0]. */
const LAYOUT_KEYS = ['left', 'top', 'width', 'height'] as const;

const fillMotionChannels = (keyframes: CreativeKeyframe[]) => {
  let translate: [number, number] | undefined;
  let scale: KeyframeScale | undefined;
  let opacity: number | undefined;
  const layout: Partial<Record<(typeof LAYOUT_KEYS)[number], number>> = {};
  return keyframes.map((frame) => {
    if (frame.translate) translate = [frame.translate[0], frame.translate[1]];
    if (frame.scale !== undefined) scale = frame.scale;
    if (frame.opacity !== undefined) opacity = frame.opacity;
    for (const key of LAYOUT_KEYS) {
      if (frame[key] !== undefined) layout[key] = Number(frame[key]);
    }
    return {
      ...frame,
      translate: translate ? [translate[0], translate[1]] as [number, number] : [0, 0],
      scale: scale !== undefined ? scale : 1,
      opacity: opacity !== undefined ? opacity : 1,
      ...Object.fromEntries(
        LAYOUT_KEYS
          .filter((key) => layout[key] !== undefined)
          .map((key) => [key, layout[key]]),
      ),
    };
  });
};

/** Compile one clip to authored frames only — no 0%/100% padding. */
const compileClipFrames = (clip: AnimationClip, beats: Record<string, number>, context: MotionContext) => {
  const params = clip.params || {};
  const distance = (value, axis, fallback = 0) => resolveMotionDistance(value ?? fallback, axis, context);
  const time = (value) => resolveTimeRef(value, beats, context.durationS);
  if (clip.preset === 'custom') {
    return (clip.keyframes || []).map((keyframe) => ({
      ...keyframe,
      at: time(keyframe.at),
      ...(keyframe.translate ? { translate: [distance(keyframe.translate[0], 'x'), distance(keyframe.translate[1], 'y')] } : {}),
    }));
  }

  const start = time(clip.start);
  const end = time(clip.end ?? 100);
  const enterDuration = params.enter_duration ? resolveMotionTime(params.enter_duration, context.durationS) : numberOr(
    params.enter_duration_pct,
    defaultEnterDurationForPreset(clip.preset, clip.durationPct),
  );
  const fadePct = params.fade_duration ? resolveMotionTime(params.fade_duration, context.durationS) : numberOr(params.fade_pct, legacyMotionDefaults.exit.durationPct);

  if (clip.preset === 'fade') {
    const settled = Math.min(end, start + enterDuration);
    const enterFrame: CreativeKeyframe = { at: start, opacity: 0 };
    // Optional — omit by default so existing opacity-only fades stay unchanged.
    if (params.ease_in !== undefined) {
      enterFrame.easing = String(params.ease_in || legacyMotionDefaults.enter.easing);
    }
    return [
      enterFrame,
      { at: settled, opacity: 1 },
      { at: Math.max(settled, end - fadePct), opacity: 1 },
      { at: end, opacity: 0 },
    ];
  }

  if (clip.preset === 'slideInRight') {
    const settled = Math.min(end, start + enterDuration);
    return [
      {
        at: start,
        translate: [distance(params.enter_distance ?? params.enter_distance_px, 'x', legacyMotionDefaults.enter.distancePx), 0] as [number, number],
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, 0] as [number, number], opacity: 1 },
      { at: Math.max(settled, end - fadePct), translate: [0, 0] as [number, number], opacity: 1 },
      { at: end, translate: [0, distance(params.exit_dy, 'y', legacyMotionDefaults.exit.dropPx)] as [number, number], opacity: 0 },
    ];
  }

  if (clip.preset === 'fadeUp') {
    const settled = Math.min(end, start + enterDuration);
    return [
      {
        at: start,
        translate: [0, distance(params.enter_dy, 'y', -7)] as [number, number],
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, distance(params.settled_dy, 'y', 0)] as [number, number], opacity: 1 },
      { at: Math.max(settled, end - fadePct), translate: [0, distance(params.settled_dy, 'y', 0)] as [number, number], opacity: 1 },
      { at: end, translate: [0, distance(params.exit_dy, 'y', legacyMotionDefaults.exit.dropPx)] as [number, number], opacity: 0 },
    ];
  }

  if (clip.preset === 'popPulse') {
    const anchorY = distance(params.anchor_y, 'y', 0);
    const settled = Math.min(end, start + enterDuration);
    const pulseStart = resolveParamTime(params, 'pulse_start', beats, Math.min(end, settled + 8), context.durationS);
    const pulsePeak = resolveParamTime(params, 'pulse_peak', beats, Math.min(end, pulseStart + 2), context.durationS);
    const pulseEnd = resolveParamTime(params, 'pulse_end', beats, Math.min(end, pulsePeak + 1), context.durationS);
    return [
      {
        at: start,
        translate: [0, anchorY] as [number, number],
        scale: numberOr(params.start_scale, 0.297),
        opacity: 0,
        easing: String(params.ease_in || legacyMotionDefaults.enter.easing),
      },
      { at: settled, translate: [0, anchorY] as [number, number], scale: 1, opacity: 1 },
      {
        at: pulseStart,
        translate: [0, anchorY] as [number, number],
        scale: 1,
        opacity: 1,
        easing: String(params.ease_pulse || legacyMotionDefaults.pulse.easing),
      },
      { at: pulsePeak, translate: [0, anchorY] as [number, number], scale: numberOr(params.pulse_scale, legacyMotionDefaults.pulse.scalePeak), opacity: 1 },
      { at: pulseEnd, translate: [0, anchorY] as [number, number], scale: 1, opacity: 1 },
      { at: Math.max(pulseEnd, end - fadePct), translate: [0, anchorY] as [number, number], scale: 1, opacity: 1 },
      { at: end, translate: [0, anchorY] as [number, number], scale: 1, opacity: 0 },
    ];
  }

  if (clip.preset === 'waveSweep') {
    const waveFadePct = numberOr(params.fade_pct, legacyMotionDefaults.waveSweep.fadePct);
    const sweepEnd = Math.min(end, start + numberOr(params.sweep_duration_pct, legacyMotionDefaults.waveSweep.durationPct));
    const startY = params.start_y !== undefined ? distance(params.start_y, 'y', 0) : distance(params.hold_y, 'y', 0);
    const endY = params.end_y !== undefined ? distance(params.end_y, 'y', 0) : distance(params.hold_y, 'y', 0);
    return [
      {
        at: start,
        translate: [distance(params.start_x, 'x', 0), startY] as [number, number],
        opacity: 1,
        easing: String(params.ease_in || legacyMotionDefaults.waveSweep.easing),
      },
      { at: sweepEnd, translate: [distance(params.end_x, 'x', 0), endY] as [number, number], opacity: 1 },
      { at: Math.max(sweepEnd, end - waveFadePct), translate: [distance(params.end_x, 'x', 0), endY] as [number, number], opacity: 1 },
      { at: end, translate: [distance(params.end_x, 'x', 0), endY] as [number, number], opacity: 0 },
    ];
  }

  throw new Error(`Unknown animation preset: ${clip.preset}`);
};

export const compileAnimationClips = (
  clips: AnimationClip[] = [],
  beats: Record<string, number> = {},
  context: MotionContext = {},
): CreativeKeyframe[] => {
  if (!clips.length) return normalizeKeyframes([]);
  // Merge clips raw, fill missing channels, THEN pad to 0/100. Per-clip padding
  // used to inject opacity-only frames at 0% that stole translate from [0,0]
  // and made waveSweep layers creep on-stage before their real start.
  const merged = clips
    .flatMap((clip) => compileClipFrames(clip, beats, context))
    .sort((a, b) => a.at - b.at);
  return normalizeKeyframes(fillMotionChannels(merged));
};

const parseRgb = (value: unknown): [number, number, number] | null => {
  const match = String(value ?? '').match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const lerpColor = (from: string, to: string, t: number) => {
  const a = parseRgb(from);
  const b = parseRgb(to);
  if (!a || !b) return t < 0.5 ? from : to;
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
};

/** CSS named easings → cubic-bezier control points (matches browser presets). */
const NAMED_CUBIC_BEZIERS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

const parseCubicBezier = (value: string): [number, number, number, number] | null => {
  const named = NAMED_CUBIC_BEZIERS[String(value || '').trim().toLowerCase()];
  if (named) return named;
  const match = String(value || '').match(
    /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/i,
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
};

/**
 * Sample a CSS cubic-bezier(x1,y1,x2,y2) at progress p in [0,1].
 * Solves X(t)=p then returns Y(t) — same model browsers use for timing functions.
 */
export const sampleCubicBezier = (p: number, x1: number, y1: number, x2: number, y2: number) => {
  const t = Math.min(1, Math.max(0, p));
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const sampleCurveX = (guess: number) => {
    // X(t) = 3(1-t)^2 t x1 + 3(1-t) t^2 x2 + t^3
    const inv = 1 - guess;
    return 3 * inv * inv * guess * x1 + 3 * inv * guess * guess * x2 + guess * guess * guess;
  };
  const sampleCurveY = (guess: number) => {
    const inv = 1 - guess;
    return 3 * inv * inv * guess * y1 + 3 * inv * guess * guess * y2 + guess * guess * guess;
  };
  const sampleCurveDerivativeX = (guess: number) => {
    const inv = 1 - guess;
    return 3 * inv * inv * x1
      + 6 * inv * guess * (x2 - x1)
      + 3 * guess * guess * (1 - x2);
  };

  // Newton–Raphson for X(t) = tTarget, then Y(t).
  let guess = t;
  for (let i = 0; i < 8; i += 1) {
    const x = sampleCurveX(guess) - t;
    const d = sampleCurveDerivativeX(guess);
    if (Math.abs(d) < 1e-6) break;
    guess -= x / d;
    if (guess < 0) guess = 0;
    if (guess > 1) guess = 1;
  }
  return sampleCurveY(guess);
};

/** Apply a CSS timing-function name or cubic-bezier(...) to a linear 0–1 ratio. */
export const applyTimingFunction = (ratio: number, easing?: string) => {
  const t = Math.min(1, Math.max(0, ratio));
  if (!easing || easing === 'linear') return t;
  const bezier = parseCubicBezier(easing);
  if (!bezier) return t;
  return sampleCubicBezier(t, bezier[0], bezier[1], bezier[2], bezier[3]);
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
  const span = Math.max(1e-6, next.at - prev.at);
  const linearRatio = prev.at === next.at ? 0 : (percent - prev.at) / span;
  // CSS: timing-function on a keyframe eases the segment *to the next* keyframe.
  // That matches export `animation-timing-function` on the from-frame.
  const ratio = applyTimingFunction(linearRatio, prev.easing);
  // Carry forward when a keyframe omits a channel (defensive; compile fills these).
  const prevTranslate = prev.translate || [0, 0];
  const nextTranslate = next.translate || prevTranslate;
  // Lerp color across a handoff window (navy→white); otherwise hold the latest.
  let color: string | undefined;
  if (prev.color !== undefined && next.color !== undefined && prev.color !== next.color) {
    color = lerpColor(prev.color, next.color, ratio);
  } else {
    for (let index = 0; index < keyframes.length; index += 1) {
      if (keyframes[index].at > percent) break;
      if (keyframes[index].color !== undefined) color = keyframes[index].color;
    }
  }
  return {
    translate: [
      lerp(prevTranslate[0], nextTranslate[0], ratio),
      lerp(prevTranslate[1], nextTranslate[1], ratio),
    ],
    scale: lerpScale(prev.scale, next.scale ?? prev.scale, ratio),
    opacity: lerp(prev.opacity ?? 1, next.opacity ?? prev.opacity ?? 1, ratio),
    ...Object.fromEntries(
      LAYOUT_KEYS
        .filter((key) => prev[key] !== undefined || next[key] !== undefined)
        .map((key) => {
          const from = prev[key] ?? next[key] ?? 0;
          const to = next[key] ?? prev[key] ?? from;
          return [key, lerp(Number(from), Number(to), ratio)];
        }),
    ),
    ...(color !== undefined ? { color } : {}),
  };
};
