import {
  compileAnimationClips,
  frameAtPercent,
  type AnimationClip,
  type CreativeKeyframe,
} from '@/lib/creative-compiler';
import {
  activeScopesFromControls,
  controlsFromFeedRow,
} from '@/lib/feed-model';
import {
  clipsForProfile,
  compileHeadlineKeyframes,
  HEADLINE_LAYER_IDS,
} from '@/lib/headline-motion';
import {
  activeFrameScope,
  beatsForScopes,
} from '@/lib/timing-profiles';

const OPACITY_SETTLED = 0.985;
const SCALE_SETTLED_TOLERANCE = 0.02;
/** Ignore plateaus shorter than this (timeline %). */
const MIN_PLATEAU_PCT = 1;
/** Walk step in timeline %. */
const WALK_STEP_PCT = 0.25;

const HEADLINE_IDS = new Set<string>(HEADLINE_LAYER_IDS);

/** Layers whose settled holds matter for visual QA. */
export const QA_HOLD_LAYER_IDS = [
  ...HEADLINE_LAYER_IDS,
  'offer-slot-1',
  'offer-slot-2',
  'offer-slot-3',
  'plus-1',
  'plus-2',
  'terms-prices',
  'unit-rate-prices',
  'terms-solo',
  'roundel-frame',
  'roundel-copy',
  'roundel-value',
  'cta',
] as const;

export type HoldSample = {
  tMs: number;
  pct: number;
  labels: string[];
};

export type SizeHoldSamples = {
  holdsMs: number[];
  frames: string[];
  samples: HoldSample[];
};

export type SessionHoldSamples = {
  variantId: string;
  copySetId?: string;
  scopes: string[];
  bySize: Record<string, SizeHoldSamples>;
};

export type HoldSamplesManifest = {
  durationS: number;
  intervalMs: number;
  bySession: Record<string, SessionHoldSamples>;
};

const padTime = (timeMs: number) => String(timeMs).padStart(4, '0');

export const frameNameForMs = (timeMs: number) => `t${padTime(timeMs)}.png`;

export const snapToIntervalMs = (timeMs: number, intervalMs: number) => {
  if (intervalMs <= 0) return Math.round(timeMs);
  return Math.round(timeMs / intervalMs) * intervalMs;
};

const isSettledPose = (frame: { opacity?: number; scale?: number }) => {
  const opacity = frame.opacity ?? 1;
  const scale = frame.scale ?? 1;
  return opacity >= OPACITY_SETTLED && Math.abs(scale - 1) <= SCALE_SETTLED_TOLERANCE;
};

const offerCountFromScopes = (scopes: string[]) => {
  const match = scopes.find((scope) => /^offers-\d+$/.test(scope));
  if (!match) return 3;
  return Number(match.split('-')[1]);
};

/** Which QA layers can contribute holds for these scopes. */
export const qaHoldLayerIdsForScopes = (scopes: string[]): string[] => {
  const offerCount = offerCountFromScopes(scopes);
  const tcPrices = scopes.includes('tc-prices');
  const roundelOn = scopes.includes('frames-4') || scopes.includes('roundel-frame-on');

  return QA_HOLD_LAYER_IDS.filter((id) => {
    if (id.startsWith('offer-slot-')) {
      const n = Number(id.slice('offer-slot-'.length));
      return n >= 1 && n <= offerCount;
    }
    if (id === 'plus-1') return offerCount >= 2;
    if (id === 'plus-2') return offerCount >= 3;
    if (id === 'terms-prices' || id === 'unit-rate-prices') return tcPrices && offerCount > 0;
    if (id === 'terms-solo') return !tcPrices && offerCount > 0;
    if (id.startsWith('roundel-')) return roundelOn;
    return true;
  });
};

const labelForLayer = (layerId: string) => {
  if (HEADLINE_IDS.has(layerId)) return 'headline';
  if (layerId.startsWith('offer-slot-') || layerId.startsWith('plus-')) return 'offer';
  if (layerId.startsWith('terms-') || layerId.startsWith('unit-rate-')) return 'legal';
  if (layerId.startsWith('roundel-')) return 'roundel';
  if (layerId === 'cta') return 'cta';
  return layerId;
};

const findSettledPlateaus = (keyframes: CreativeKeyframe[]) => {
  const plateaus: Array<{ startPct: number; endPct: number }> = [];
  let plateauStart: number | null = null;

  for (let pct = 0; pct <= 100 + 1e-9; pct += WALK_STEP_PCT) {
    const clamped = Math.min(100, pct);
    const settled = isSettledPose(frameAtPercent(keyframes, clamped));
    if (settled && plateauStart === null) plateauStart = clamped;
    if (!settled && plateauStart !== null) {
      const endPct = Math.max(plateauStart, clamped - WALK_STEP_PCT);
      if (endPct - plateauStart >= MIN_PLATEAU_PCT) {
        plateaus.push({ startPct: plateauStart, endPct });
      }
      plateauStart = null;
    }
  }

  if (plateauStart !== null) {
    const endPct = 100;
    if (endPct - plateauStart >= MIN_PLATEAU_PCT) {
      plateaus.push({ startPct: plateauStart, endPct });
    }
  }

  return plateaus;
};

const keyframesForLayer = (
  layer: Record<string, unknown>,
  layers: Array<Record<string, unknown>>,
  row: Record<string, unknown>,
  profile: string,
  beats: Record<string, number>,
): CreativeKeyframe[] => {
  const clips = (layer.clips || []) as AnimationClip[];
  if (HEADLINE_IDS.has(String(layer.id))) {
    return compileHeadlineKeyframes(layer, layers, row, profile, beats);
  }
  const profileClips = clipsForProfile(clips, profile);
  if (!profileClips.length) return [];
  return compileAnimationClips(profileClips, beats);
};

/**
 * Derive settled hold sample times for one size under active scopes.
 * Midpoints of opacity≈1 / scale≈1 plateaus on QA-relevant layers, snapped to capture ticks.
 */
export const holdSamplesForSize = (
  document: Record<string, unknown>,
  size: string,
  activeScopes: string[],
  options: {
    row?: Record<string, unknown>;
    intervalMs?: number;
  } = {},
): SizeHoldSamples => {
  const clock = (document.clock || {}) as { durationS?: number };
  const durationS = Number(clock.durationS) || 15;
  const intervalMs = options.intervalMs && options.intervalMs > 0 ? options.intervalMs : 250;
  const row = options.row || {};
  const beats = beatsForScopes(document, activeScopes);
  const profile = activeFrameScope(activeScopes);
  const sizeCreative = (document.sizes as Record<string, { layers?: Array<Record<string, unknown>> }> | undefined)?.[size];
  const layers = sizeCreative?.layers || [];
  const layerById = new Map(layers.map((layer) => [String(layer.id), layer]));
  const wantedIds = qaHoldLayerIdsForScopes(activeScopes);

  const durationMs = durationS * 1000;

  const snapInsidePlateau = (
    keyframes: CreativeKeyframe[],
    plateau: { startPct: number; endPct: number },
  ) => {
    const midPct = (plateau.startPct + plateau.endPct) / 2;
    const preferredMs = snapToIntervalMs((midPct / 100) * durationMs, intervalMs);
    const startMs = snapToIntervalMs((plateau.startPct / 100) * durationMs, intervalMs);
    const endMs = snapToIntervalMs((plateau.endPct / 100) * durationMs, intervalMs);
    const lo = Math.max(0, Math.min(startMs, endMs));
    const hi = Math.min(durationMs, Math.max(startMs, endMs));

    const candidates: number[] = [];
    for (let t = lo; t <= hi + 1e-9; t += intervalMs) candidates.push(t);
    if (!candidates.length) candidates.push(preferredMs);

    const ranked = candidates
      .map((tMs) => {
        const pct = (tMs / durationMs) * 100;
        return { tMs, pct, settled: isSettledPose(frameAtPercent(keyframes, pct)) };
      })
      .filter((item) => item.settled)
      .sort((a, b) => Math.abs(a.tMs - preferredMs) - Math.abs(b.tMs - preferredMs));

    return ranked[0] || null;
  };

  const byMs = new Map<number, Set<string>>();

  for (const layerId of wantedIds) {
    const layer = layerById.get(layerId);
    if (!layer) continue;
    const keyframes = keyframesForLayer(layer, layers, row, profile, beats);
    if (!keyframes.length) continue;
    // Always-on (no motion after normalize) still yields opacity 1 everywhere — skip flat full-timeline.
    const plateaus = findSettledPlateaus(keyframes);
    for (const plateau of plateaus) {
      if (plateau.startPct <= 0 && plateau.endPct >= 100) continue;
      const picked = snapInsidePlateau(keyframes, plateau);
      if (!picked) continue;
      const labels = byMs.get(picked.tMs) || new Set<string>();
      labels.add(labelForLayer(layerId));
      byMs.set(picked.tMs, labels);
    }
  }

  const samples: HoldSample[] = [...byMs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tMs, labels]) => ({
      tMs,
      pct: (tMs / (durationS * 1000)) * 100,
      labels: [...labels].sort(),
    }));

  return {
    holdsMs: samples.map((sample) => sample.tMs),
    frames: samples.map((sample) => frameNameForMs(sample.tMs)),
    samples,
  };
};

export const scopesFromFeedRow = (row: Record<string, unknown> = {}) => (
  activeScopesFromControls(controlsFromFeedRow(row))
);

export const holdSamplesForSession = (
  document: Record<string, unknown>,
  options: {
    variantId: string;
    copySetId?: string;
    row: Record<string, unknown>;
    sizes: string[];
    intervalMs?: number;
  },
): SessionHoldSamples => {
  const scopes = scopesFromFeedRow(options.row);
  const bySize: Record<string, SizeHoldSamples> = {};
  for (const size of options.sizes) {
    bySize[size] = holdSamplesForSize(document, size, scopes, {
      row: options.row,
      intervalMs: options.intervalMs,
    });
  }
  return {
    variantId: options.variantId,
    copySetId: options.copySetId,
    scopes,
    bySize,
  };
};
