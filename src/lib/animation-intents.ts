// @ts-nocheck

import { resolveTimeRef } from './creative-compiler';

const roundPct = (value: number) => Number(value.toFixed(3));
const deepClone = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

export const animationIntentDefinitions = {
  fadeIn: {
    id: 'fadeIn',
    label: 'Fade in',
    durationS: 0.5,
    anchor: 'start',
    easing: 'ease-out',
  },
  fadeOut: {
    id: 'fadeOut',
    label: 'Fade out',
    durationS: 0.5,
    anchor: 'end',
    easing: 'ease-out',
  },
  slideInRight: {
    id: 'slideInRight',
    label: 'Slide in from right',
    durationS: 0.5,
    anchor: 'start',
    easing: 'ease-out',
    distancePx: 60,
  },
  fadeUp: {
    id: 'fadeUp',
    label: 'Fade up',
    durationS: 0.5,
    anchor: 'start',
    easing: 'ease-out',
    distancePx: 12,
  },
};

const pctForSeconds = (seconds: number, durationS = 15) => roundPct((seconds / durationS) * 100);

const startEndForIntent = (intent: Record<string, unknown>, anchorPct: number, durationS: number) => {
  const span = pctForSeconds(Number(intent.durationS || 0.5), durationS);
  if (intent.anchor === 'end') {
    return {
      start: roundPct(Math.max(0, anchorPct - span)),
      end: roundPct(anchorPct),
    };
  }
  return {
    start: roundPct(anchorPct),
    end: roundPct(Math.min(100, anchorPct + span)),
  };
};

const keyframesForIntent = (intent: Record<string, unknown>, start: number, end: number) => {
  if (intent.id === 'fadeOut') {
    return [
      { at: start, opacity: 1, easing: intent.easing },
      { at: end, opacity: 0 },
    ];
  }
  if (intent.id === 'slideInRight') {
    return [
      { at: start, translate: [Number(intent.distancePx || 60), 0], opacity: 0, easing: intent.easing },
      { at: end, translate: [0, 0], opacity: 1 },
    ];
  }
  if (intent.id === 'fadeUp') {
    return [
      { at: start, translate: [0, Number(intent.distancePx || 12)], opacity: 0, easing: intent.easing },
      { at: end, translate: [0, 0], opacity: 1 },
    ];
  }
  return [
    { at: start, opacity: 0, easing: intent.easing },
    { at: end, opacity: 1 },
  ];
};

export const createAnimationIntentClip = ({
  layerId,
  layerLabel = layerId,
  intentId,
  anchorPct,
  durationS = 15,
}) => {
  const intent = animationIntentDefinitions[intentId];
  if (!intent) throw new Error(`Unknown animation intent: ${intentId}`);
  const { start, end } = startEndForIntent(intent, Number(anchorPct), durationS);
  return {
    id: `${layerId}-${intentId}-${String(start).replace('.', '_')}-${String(end).replace('.', '_')}`,
    label: `${layerLabel} ${intent.label}`,
    preset: 'custom',
    intentId,
    linked: true,
    start,
    end,
    params: {
      duration_s: intent.durationS,
      easing: intent.easing,
    },
    keyframes: keyframesForIntent(intent, start, end),
  };
};

export const timelineSpanForClip = (clip: Record<string, unknown>, beats: Record<string, number> = {}) => {
  const intent = animationIntentDefinitions[clip.intentId] || null;
  const keyframes = clip.keyframes || [];
  let start = clip.start;
  let end = clip.end;
  if (keyframes.length) {
    const times = keyframes.map((keyframe) => resolveTimeRef(keyframe.at, beats));
    start = Math.min(...times);
    end = Math.max(...times);
  } else {
    start = resolveTimeRef(start ?? 0, beats);
    end = resolveTimeRef(end ?? 100, beats);
  }
  return {
    start: roundPct(Number(start)),
    end: roundPct(Number(end)),
    duration: roundPct(Number(end) - Number(start)),
    intentId: clip.intentId || clip.preset || 'custom',
    label: intent?.label || clip.preset || 'Custom',
    linked: clip.linked !== false,
  };
};

export const animationFamilyForLayer = (layer: Record<string, unknown> = {}) => {
  const id = String(layer.id || '');
  const group = String(layer.group || '').toLowerCase();
  if (id.startsWith('headline-') || group.includes('headline')) return { id: 'headlines', label: 'Headlines' };
  if (id.startsWith('offer-slot-')) return { id: 'offer-slots', label: 'Offer slots' };
  if (id.startsWith('plus-')) return { id: 'offer-pluses', label: 'Offer plus signs' };
  if (id.startsWith('logo-') || group.includes('logo')) return { id: 'logos', label: 'Logos' };
  if (id.startsWith('terms-') || id.startsWith('unit-rate-') || group.includes('terms')) return { id: 'legal', label: 'Legal lines' };
  if (id.includes('wave') || group.includes('wave')) return { id: 'waves', label: 'Waves' };
  if (id === 'cta' || group.includes('cta')) return { id: 'cta', label: 'CTA' };
  return { id: 'single-layer', label: 'Single layer' };
};

const findSize = (document: Record<string, unknown>, size: string) => document?.sizes?.[size] || null;

const findLayer = (document: Record<string, unknown>, size: string, layerId: string) => (
  findSize(document, size)?.layers?.find((layer: Record<string, unknown>) => layer.id === layerId)
);

const cloneClipForLayer = (clip: Record<string, unknown>, layer: Record<string, unknown>) => {
  const cloned = deepClone(clip);
  const start = String(cloned.start).replace('.', '_');
  const end = String(cloned.end).replace('.', '_');
  cloned.id = `${layer.id}-${cloned.intentId || cloned.preset}-${start}-${end}`;
  cloned.label = `${layer.label || layer.id} ${animationIntentDefinitions[cloned.intentId]?.label || cloned.preset || 'motion'}`;
  cloned.linked = true;
  return cloned;
};

export const addAnimationIntentToLayer = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  intentId: string,
  anchorPct: number,
) => {
  const next = deepClone(document);
  const layer = findLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  const clip = createAnimationIntentClip({
    layerId,
    layerLabel: layer.label || layerId,
    intentId,
    anchorPct,
    durationS: next.clock?.durationS || 15,
  });
  layer.clips = [...(layer.clips || []), clip];
  return { document: next, clip };
};

export const copyClipToAnimationFamily = (
  document: Record<string, unknown>,
  size: string,
  sourceLayerId: string,
  clipId: string,
) => {
  const next = deepClone(document);
  const sizeCreative = findSize(next, size);
  const sourceLayer = findLayer(next, size, sourceLayerId);
  const sourceClip = (sourceLayer?.clips || []).find((clip: Record<string, unknown>) => clip.id === clipId);
  if (!sizeCreative || !sourceLayer || !sourceClip) return next;
  const family = animationFamilyForLayer(sourceLayer);
  for (const layer of sizeCreative.layers || []) {
    if (layer.id === sourceLayer.id) continue;
    if (animationFamilyForLayer(layer).id !== family.id) continue;
    layer.clips = [cloneClipForLayer(sourceClip, layer), ...(layer.clips || []).filter((clip) => clip.id !== sourceClip.id)];
  }
  return next;
};
