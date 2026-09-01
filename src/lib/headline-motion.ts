// @ts-nocheck

import { layerAnimationShorthand } from '@/lib/animation-css';
import {
  compileAnimationClips,
  formatScale3d,
  resolveTimeRef,
  type AnimationClip,
  type CreativeKeyframe,
} from '@/lib/creative-compiler';

export const HEADLINE_LAYER_IDS = [
  'headline-act1',
  'headline-act2',
  'headline-act3',
  'headline-act4',
] as const;

export const normalizeHeadlineText = (value: unknown) => String(value ?? '').trim();

export const headlineTextsFromRow = (row: Record<string, unknown> = {}, count = 4) => (
  Array.from({ length: count }, (_, index) => normalizeHeadlineText(row[`heading${index + 1}_text`]))
);

export const headlineAct4DisplayText = (
  row: Record<string, unknown> = {},
  includeRoundelFrame = false,
) => {
  const heading4 = normalizeHeadlineText(row.heading4_text);
  if (includeRoundelFrame || heading4) return heading4;
  return normalizeHeadlineText(row.heading3_text);
};

/**
 * Filter layer clips by frame profile and optional active offer/CSS scopes.
 * Missing/empty `profiles` or `scopes` on a clip → matches all.
 * When `activeScopes` is omitted, offer-scoped clips are excluded (callers that
 * compile multi-offer vs offers-0 motion must pass scopes explicitly).
 */
export const clipsForProfile = (
  clips: AnimationClip[] = [],
  profile = 'frames-3',
  activeScopes?: string[] | null,
) => (
  (clips || []).filter((clip: Record<string, unknown>) => {
    const profiles = clip.profiles as string[] | undefined;
    if (profiles?.length && !profiles.includes(profile)) return false;
    const scopes = clip.scopes as string[] | undefined;
    if (!scopes?.length) return true;
    if (!activeScopes?.length) return false;
    return scopes.some((scope) => activeScopes.includes(scope));
  })
);

export const skippedHeadlineActs = (
  headings: string[],
  includeRoundelFrame = false,
) => {
  const skipped = new Set<number>();
  if (headings[0] && headings[1] && headings[0] === headings[1]) skipped.add(2);
  if (includeRoundelFrame) {
    if (headings[1] && headings[2] && headings[1] === headings[2]) skipped.add(3);
    if (headings[2] && headings[3] && headings[2] === headings[3]) skipped.add(4);
  } else if (headings[1] && headings[3] && headings[1] === headings[3]) {
    skipped.add(4);
  }
  return skipped;
};

export const hasHeadlineSkips = (
  row: Record<string, unknown> = {},
  profile = 'frames-3',
) => skippedHeadlineActs(
  headlineTextsFromRow(row),
  profile === 'frames-4',
).size > 0;

/** Eligible headline acts for the active frame profile (act 3 only with roundel). */
export const eligibleHeadlineActs = (includeRoundelFrame = false) => (
  includeRoundelFrame ? [1, 2, 3, 4] : [1, 2, 4]
);

export const isZeroOffersRow = (row: Record<string, unknown> = {}) => {
  const parsed = Number.parseInt(String(row.offer_count_num ?? ''), 10);
  return Number.isFinite(parsed) && parsed === 0;
};

/**
 * Policy B for offers-0: blank pre-CTA acts are omitted; remaining acts 1–3
 * share [act1_in, green_in) evenly so the last photo headline is gone when
 * greenwave starts fading in. Act 4 keeps its authored CTA-window clips.
 */
export const equalHeadlineWindowsForZeroOffers = (
  headings: string[],
  includeRoundelFrame = false,
  beats: Record<string, number> = {},
) => {
  const eligible = eligibleHeadlineActs(includeRoundelFrame).filter((act) => act !== 4);
  const activeActs = eligible.filter((act) => Boolean(headings[act - 1]));
  const windowStart = Number(beats.act1_in ?? 0);
  const windowEnd = Number(
    beats.green_in
    ?? ((beats.act4_in ?? beats.bn_cta_in ?? beats.cta_in ?? 100) - 3.3),
  );
  const span = Math.max(0.01, windowEnd - windowStart);
  const slice = activeActs.length ? span / activeActs.length : span;
  const windows = new Map();
  activeActs.forEach((act, index) => {
    const start = Number((windowStart + slice * index).toFixed(4));
    const end = Number((windowStart + slice * (index + 1)).toFixed(4));
    windows.set(act, { start, end });
  });
  return { activeActs, windows, windowStart, windowEnd };
};

/** Studio include_heading4_enum: missing/undefined/blank → true (show when copy present). */
export const isHeading4Enabled = (row: Record<string, unknown> = {}) => {
  if (row.include_heading4_enum === undefined || row.include_heading4_enum === null) return true;
  if (typeof row.include_heading4_enum === 'boolean') return row.include_heading4_enum;
  const normalized = String(row.include_heading4_enum).trim().toLowerCase();
  // Empty string is the exporter's fieldValue(undefined) — treat as missing, not off.
  if (!normalized) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return true;
};

const hiddenKeyframes = (): CreativeKeyframe[] => ([
  { at: 0, translate: [0, 0], opacity: 0 },
  { at: 100, translate: [0, 0], opacity: 0 },
]);

const DEFAULT_SKIP_FADE_PCT = 2;

/** Authored clip exit (%), not the padded last keyframe at 100. */
const authoredClipExit = (clips: AnimationClip[] = [], beats: Record<string, number> = {}) => {
  if (!clips.length) return 100;
  return Math.max(...clips.map((clip) => resolveTimeRef(clip.end ?? 100, beats)));
};

/** Brand navy — default headline ink on the green wave. */
const DEFAULT_HEADLINE_INK = 'rgb(0, 41, 117)';

/**
 * When a later headline act is skipped (duplicate copy), extend the previous
 * act through `holdUntil` (the skipped act's authored exit), then fade out.
 * Always append the exit — holding to 100 without a fade was leaving the last
 * visible headline stuck at opacity 1.
 *
 * When the skipped act has a `base.color` (e.g. white endframe on 320x50),
 * crossfade the holder's ink → skipped ink over `fadePct` starting at the
 * skipped act's start (matches the ~300ms logo blue→white handoff at 2%/15s).
 * Earlier frames stay navy so CSS does not wash the green-wave window white.
 */
const applyColorHandoff = (
  frames: CreativeKeyframe[] = [],
  colorAt: number,
  toColor: string,
  fromColor: string,
  fadePct = DEFAULT_SKIP_FADE_PCT,
) => {
  const sorted = [...frames].sort((a, b) => a.at - b.at);
  const poseAt = (at: number) => (
    [...sorted].reverse().find((frame) => frame.at <= at) || sorted[0]
  );
  const colorEnd = Math.min(100, Number((colorAt + Math.max(0.01, fadePct)).toFixed(4)));
  // Drop interior frames so CSS only lerps navy→white across the handoff window.
  const cleaned = sorted.filter((frame) => frame.at <= colorAt || frame.at >= colorEnd);
  const withPoint = [
    ...cleaned.filter((frame) => frame.at !== colorAt && frame.at !== colorEnd),
    { ...poseAt(colorAt), at: colorAt },
    { ...poseAt(colorEnd), at: colorEnd },
  ].sort((a, b) => a.at - b.at);

  return withPoint.map((frame) => ({
    ...frame,
    color: frame.at >= colorEnd ? toColor : fromColor,
  }));
};

const mergeSkipHold = (
  keyframes: CreativeKeyframe[] = [],
  holdUntil: number,
  fadePct = DEFAULT_SKIP_FADE_PCT,
  colorHandoff: {
    at: number;
    color: string;
    fromColor?: string;
    fadePct?: number;
  } | null = null,
) => {
  if (!keyframes.length) return keyframes;
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);
  const settled = sorted.find((frame) => frame.opacity === 1) || sorted[0];
  const settledAt = settled?.at ?? sorted[0].at;
  const kept = sorted.filter((frame) => frame.at <= settledAt);
  const originalExit = [...sorted]
    .reverse()
    .find((frame) => (frame.opacity ?? 1) === 0 && frame.at > settledAt);

  const exitAt = Math.min(100, Math.max(settledAt + 0.01, holdUntil));
  const fadeStart = Math.max(settledAt, exitAt - fadePct);
  const exitPose = originalExit
    ? { ...originalExit, opacity: 0 }
    : { ...settled, opacity: 0 };

  const frames = [
    ...kept,
    { ...settled, at: settledAt, opacity: 1 },
    { ...settled, at: fadeStart, opacity: 1 },
    { ...exitPose, at: exitAt, opacity: 0 },
  ];
  if (exitAt < 100) frames.push({ ...exitPose, at: 100, opacity: 0 });
  if (!colorHandoff?.color) return frames;
  const colorAt = Math.max(settledAt, Math.min(fadeStart, colorHandoff.at));
  const fromColor = colorHandoff.fromColor || DEFAULT_HEADLINE_INK;
  const colorFadePct = colorHandoff.fadePct ?? DEFAULT_SKIP_FADE_PCT;
  return applyColorHandoff(frames, colorAt, colorHandoff.color, fromColor, colorFadePct);
};

type HeadlineWindow = {
  act: number;
  layerId: string;
  keyframes: CreativeKeyframe[];
  start: number;
  end: number;
  hidden: boolean;
  color: string | null;
  enterDurationPct: number;
};

const layerInkColor = (layer: Record<string, unknown> | undefined) => {
  const color = layer?.base?.color;
  return typeof color === 'string' && color.trim() ? color.trim() : null;
};

const rebuildSlideWindow = (
  window: HeadlineWindow,
  start: number,
  end: number,
  sourceClips: AnimationClip[] = [],
  beats: Record<string, number> = {},
) => {
  const source = sourceClips[0] || {};
  const params = { ...(source.params || {}) };
  const clip = {
    id: `${window.layerId}-equal-split`,
    preset: source.preset || 'slideInRight',
    start,
    end,
    params,
  };
  window.start = start;
  window.end = end;
  window.hidden = false;
  window.keyframes = compileAnimationClips([clip], beats);
};

export const buildHeadlineMotionPlan = (
  layers: Array<Record<string, unknown>> = [],
  row: Record<string, unknown> = {},
  profile = 'frames-3',
  beats: Record<string, number> = {},
) => {
  const includeRoundelFrame = profile === 'frames-4';
  const headings = headlineTextsFromRow(row);
  const zeroOffers = isZeroOffersRow(row);
  const skipped = zeroOffers
    ? new Set()
    : skippedHeadlineActs(headings, includeRoundelFrame);
  const headlineLayers = HEADLINE_LAYER_IDS
    .map((id) => layers.find((layer) => layer.id === id))
    .filter(Boolean);

  const windows: HeadlineWindow[] = headlineLayers.map((layer, index) => {
    const act = index + 1;
    const clips = clipsForProfile(layer.clips, profile);
    const keyframes = clips.length ? compileAnimationClips(clips, beats) : hiddenKeyframes();
    const end = authoredClipExit(clips, beats);
    const start = clips.length
      ? Math.min(...clips.map((clip) => resolveTimeRef(clip.start ?? 0, beats)))
      : (keyframes[0]?.at ?? 0);
    const enterDurationPct = Number(clips[0]?.params?.enter_duration_pct);
    return {
      act,
      layerId: String(layer.id),
      keyframes,
      start,
      end,
      hidden: act === 3 && !includeRoundelFrame,
      color: layerInkColor(layer),
      enterDurationPct: Number.isFinite(enterDurationPct) && enterDurationPct > 0
        ? enterDurationPct
        : DEFAULT_SKIP_FADE_PCT,
      _clips: clips,
    };
  });

  if (zeroOffers) {
    const heading4Enabled = isHeading4Enabled(row);
    const { activeActs, windows: equalWindows } = equalHeadlineWindowsForZeroOffers(
      headings,
      includeRoundelFrame,
      beats,
    );
    const eligible = new Set(eligibleHeadlineActs(includeRoundelFrame));
    for (const window of windows) {
      // Act 4 stays on the offers-0 CTA beat (act4_in / green fade end), not
      // size-specific banner aliases like bn_cta_in that leave a dead gap after
      // the equal-split photo window.
      if (window.act === 4) {
        const showAct4 = heading4Enabled && Boolean(headings[3]);
        if (!showAct4) {
          window.hidden = true;
          window.keyframes = hiddenKeyframes();
        } else {
          const act4Start = Number(
            beats.act4_in ?? beats.bn_cta_in ?? beats.cta_in ?? window.start,
          );
          rebuildSlideWindow(window, act4Start, window.end, window._clips, beats);
        }
        continue;
      }
      if (!eligible.has(window.act) || !activeActs.includes(window.act)) {
        window.hidden = true;
        window.keyframes = hiddenKeyframes();
        continue;
      }
      const slot = equalWindows.get(window.act);
      if (!slot) {
        window.hidden = true;
        window.keyframes = hiddenKeyframes();
        continue;
      }
      rebuildSlideWindow(window, slot.start, slot.end, window._clips, beats);
    }
    for (const window of windows) delete window._clips;
    return windows;
  }

  for (const window of windows) delete window._clips;

  for (let act = 2; act <= 4; act += 1) {
    if (act === 3 && !includeRoundelFrame) continue;
    if (!skipped.has(act)) continue;
    const current = windows[act - 1];
    let previousIndex = act - 2;
    while (previousIndex >= 0 && windows[previousIndex].hidden) previousIndex -= 1;
    if (previousIndex < 0 || !current) continue;
    const previous = windows[previousIndex];
    previous.keyframes = mergeSkipHold(
      previous.keyframes,
      current.end,
      DEFAULT_SKIP_FADE_PCT,
      current.color
        ? {
          at: current.start,
          color: current.color,
          fromColor: previous.color || DEFAULT_HEADLINE_INK,
          fadePct: current.enterDurationPct,
        }
        : null,
    );
    previous.end = current.end;
    current.hidden = true;
    current.keyframes = hiddenKeyframes();
  }

  return windows;
};

export const compileHeadlineKeyframes = (
  layer: Record<string, unknown>,
  layers: Array<Record<string, unknown>> = [],
  row: Record<string, unknown> = {},
  profile = 'frames-3',
  beats: Record<string, number> = {},
) => {
  const plan = buildHeadlineMotionPlan(layers, row, profile, beats);
  return plan.find((item) => item.layerId === layer.id)?.keyframes
    || compileAnimationClips(clipsForProfile(layer.clips, profile), beats);
};

const formatTransform = (frame: CreativeKeyframe) => {
  const [x = 0, y = 0] = frame.translate || [0, 0];
  const parts = [`translate3d(${x}px, ${y}px, 0px)`];
  const scalePart = formatScale3d(frame.scale);
  if (scalePart) parts.push(scalePart);
  return parts.join(' ');
};

export const keyframesCss = (name: string, keyframes: CreativeKeyframe[] = []) => (
  keyframes.map((frame) => {
    const color = frame.color ? `; color: ${frame.color}` : '';
    return `      ${frame.at}% { transform: ${formatTransform(frame)}; opacity: ${frame.opacity ?? 1}${color}; }`;
  }).join('\n')
);

export const headlineSkipOverrideCss = (
  layers: Array<Record<string, unknown>> = [],
  row: Record<string, unknown> = {},
  profile = 'frames-3',
  beats: Record<string, number> = {},
  durationS = 15,
  loop = false,
) => {
  const plan = buildHeadlineMotionPlan(layers, row, profile, beats);
  const blocks: string[] = [];

  for (const item of plan) {
    const name = `${item.layerId}-skip-${profile.replace(/[^a-z0-9]+/gi, '-')}`;
    blocks.push(`    @keyframes ${name} {\n${keyframesCss(name, item.keyframes)}\n    }`);
    if (item.hidden) {
      blocks.push(`    #${item.layerId} { visibility: hidden !important; animation: none !important; }`);
      continue;
    }
    blocks.push(`    #${item.layerId} { animation: ${layerAnimationShorthand(durationS, name, { loop, important: true })}; }`);
  }

  return blocks.join('\n\n');
};

export const serializeHeadlineMotionLayers = (layers: Array<Record<string, unknown>> = []) => (
  HEADLINE_LAYER_IDS.map((id) => {
    const layer = layers.find((item) => item.id === id);
    if (!layer) return null;
    return {
      id,
      color: layerInkColor(layer),
      clips: {
        'frames-3': clipsForProfile(layer.clips, 'frames-3'),
        'frames-4': clipsForProfile(layer.clips, 'frames-4'),
      },
    };
  }).filter(Boolean)
);

export const headlineTransitionRuntimeBlock = (
  layers: Array<Record<string, unknown>> = [],
  beatsProfiles: Record<string, Record<string, number>> = {},
  durationS = 15,
  loop = false,
) => {
  const headlineLayers = serializeHeadlineMotionLayers(layers);
  const iteration = loop ? 'infinite' : 1;
  return `
        var __headlineMotionLayers = ${JSON.stringify(headlineLayers)};
        var __headlineMotionBeats = ${JSON.stringify(beatsProfiles)};
        var __headlineMotionDuration = ${Number(durationS) || 15};
        var __headlineMotionIteration = ${JSON.stringify(iteration)};

        function __normalizeHeadlineText(value) {
          return String(value || '').trim();
        }

        function __headlineAct4DisplayText(data, includeRoundel) {
          var heading4 = __normalizeHeadlineText(data.heading4_text);
          if (includeRoundel || heading4) return heading4;
          return __normalizeHeadlineText(data.heading3_text);
        }

        function __compileSlideInRight(clip, beats) {
          var params = clip.params || {};
          var start = __resolveBeat(clip.start, beats);
          var end = __resolveBeat(clip.end || 100, beats);
          var enterDuration = Number(params.enter_duration_pct || 7);
          var fadePct = Number(params.fade_pct || 2);
          var settled = Math.min(end, start + enterDuration);
          var enterDistance = Number(params.enter_distance_px || 320);
          var exitDy = Number(params.exit_dy || 5);
          return [
            { at: start, translate: [enterDistance, 0], opacity: 0 },
            { at: settled, translate: [0, 0], opacity: 1 },
            { at: Math.max(settled, end - fadePct), translate: [0, 0], opacity: 1 },
            { at: end, translate: [0, exitDy], opacity: 0 }
          ];
        }

        function __compileFade(clip, beats) {
          var params = clip.params || {};
          var start = __resolveBeat(clip.start, beats);
          var end = __resolveBeat(clip.end || 100, beats);
          var enterDuration = Number(params.enter_duration_pct || 1);
          var fadePct = Number(params.fade_pct || 2);
          var settled = Math.min(end, start + enterDuration);
          return [
            { at: start, translate: [0, 0], opacity: 0 },
            { at: settled, translate: [0, 0], opacity: 1 },
            { at: Math.max(settled, end - fadePct), translate: [0, 0], opacity: 1 },
            { at: end, translate: [0, 0], opacity: 0 }
          ];
        }

        function __resolveBeat(ref, beats) {
          if (typeof ref === 'number') return ref;
          var match = String(ref).match(/^([a-z0-9_]+)\\s*([+-]\\s*\\d+(?:\\.\\d+)?)?$/i);
          if (!match || beats[match[1]] === undefined) return 0;
          return beats[match[1]] + (match[2] ? parseFloat(match[2].replace(/\\s/g, '')) : 0);
        }

        function __compileHeadlineClips(clips, beats) {
          if (!clips || !clips.length) {
            return [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
          }
          if (clips[0].preset === 'fade') return __compileFade(clips[0], beats);
          return __compileSlideInRight(clips[0], beats);
        }

        var __DEFAULT_HEADLINE_INK = 'rgb(0, 41, 117)';

        function __applyColorHandoff(frames, colorAt, toColor, fromColor, fadePct) {
          var sorted = frames.slice().sort(function(a, b) { return a.at - b.at; });
          function poseAt(at) {
            for (var i = sorted.length - 1; i >= 0; i -= 1) {
              if (sorted[i].at <= at) return sorted[i];
            }
            return sorted[0];
          }
          var colorFade = fadePct == null ? 2 : fadePct;
          var colorEnd = Math.min(100, Number((colorAt + Math.max(0.01, colorFade)).toFixed(4)));
          var cleaned = sorted.filter(function(frame) {
            return frame.at <= colorAt || frame.at >= colorEnd;
          });
          var withPoint = cleaned.filter(function(frame) {
            return frame.at !== colorAt && frame.at !== colorEnd;
          })
            .concat([Object.assign({}, poseAt(colorAt), { at: colorAt })])
            .concat([Object.assign({}, poseAt(colorEnd), { at: colorEnd })])
            .sort(function(a, b) { return a.at - b.at; });
          return withPoint.map(function(frame) {
            return Object.assign({}, frame, {
              color: frame.at >= colorEnd ? toColor : fromColor
            });
          });
        }

        function __mergeSkipHold(keyframes, holdUntil, colorHandoff) {
          var fadePct = 2;
          var sorted = keyframes.slice().sort(function(a, b) { return a.at - b.at; });
          var settled = sorted.find(function(frame) { return frame.opacity === 1; }) || sorted[0];
          var settledAt = settled ? settled.at : sorted[0].at;
          var kept = sorted.filter(function(frame) { return frame.at <= settledAt; });
          var originalExit = null;
          for (var i = sorted.length - 1; i >= 0; i -= 1) {
            var frame = sorted[i];
            if ((frame.opacity == null ? 1 : frame.opacity) === 0 && frame.at > settledAt) {
              originalExit = frame;
              break;
            }
          }
          var exitAt = Math.min(100, Math.max(settledAt + 0.01, holdUntil));
          var fadeStart = Math.max(settledAt, exitAt - fadePct);
          var exitPose = originalExit
            ? Object.assign({}, originalExit, { opacity: 0 })
            : Object.assign({}, settled, { opacity: 0 });
          var frames = kept.concat([
            Object.assign({}, settled, { at: settledAt, opacity: 1 }),
            Object.assign({}, settled, { at: fadeStart, opacity: 1 }),
            Object.assign({}, exitPose, { at: exitAt, opacity: 0 })
          ]);
          if (exitAt < 100) frames.push(Object.assign({}, exitPose, { at: 100, opacity: 0 }));
          if (!colorHandoff || !colorHandoff.color) return frames;
          var colorAt = Math.max(settledAt, Math.min(fadeStart, colorHandoff.at));
          var fromColor = colorHandoff.fromColor || __DEFAULT_HEADLINE_INK;
          var colorFadePct = colorHandoff.fadePct == null ? 2 : colorHandoff.fadePct;
          return __applyColorHandoff(frames, colorAt, colorHandoff.color, fromColor, colorFadePct);
        }

        function __formatTransform(frame) {
          var translate = frame.translate || [0, 0];
          var scale = frame.scale == null ? 1 : frame.scale;
          var parts = ['translate3d(' + translate[0] + 'px, ' + translate[1] + 'px, 0px)'];
          var sx;
          var sy;
          if (Array.isArray(scale)) {
            sx = scale[0];
            sy = scale[1];
          } else {
            sx = scale;
            sy = scale;
          }
          if (sx !== 1 || sy !== 1) parts.push('scale3d(' + sx + ', ' + sy + ', 1)');
          return parts.join(' ');
        }

        function __keyframesCss(name, keyframes) {
          return keyframes.map(function(frame) {
            var color = frame.color ? '; color: ' + frame.color : '';
            return '      ' + frame.at + '% { transform: ' + __formatTransform(frame) + '; opacity: ' + (frame.opacity == null ? 1 : frame.opacity) + color + '; }';
          }).join('\\n');
        }

        function __skippedHeadlineActs(headings, includeRoundel) {
          var skipped = {};
          if (headings[0] && headings[1] && headings[0] === headings[1]) skipped[2] = true;
          if (includeRoundel) {
            if (headings[1] && headings[2] && headings[1] === headings[2]) skipped[3] = true;
            if (headings[2] && headings[3] && headings[2] === headings[3]) skipped[4] = true;
          } else if (headings[1] && headings[3] && headings[1] === headings[3]) {
            skipped[4] = true;
          }
          return skipped;
        }

        function __isZeroOffers(data) {
          var parsed = parseInt(data && data.offer_count_num, 10);
          return isFinite(parsed) && parsed === 0;
        }

        function __eligibleHeadlineActs(includeRoundel) {
          return includeRoundel ? [1, 2, 3, 4] : [1, 2, 4];
        }

        function __applyOffers0BeatOverlay(beats) {
          var next = Object.assign({}, beats || {});
          next.act1_begin = 4;
          next.act1_in = 7;
          var act4 = Number(
            next.act4_in != null ? next.act4_in
              : (next.bn_cta_in != null ? next.bn_cta_in : (next.cta_in != null ? next.cta_in : 100))
          );
          var greenIn = Math.round((act4 - 3.3) * 1000) / 1000;
          next.green_in = Math.max(0, Math.min(100, greenIn));
          return next;
        }

        function __isHeading4Enabled(data) {
          if (!data || data.include_heading4_enum === undefined || data.include_heading4_enum === null) return true;
          if (typeof data.include_heading4_enum === 'boolean') return data.include_heading4_enum;
          var normalized = String(data.include_heading4_enum).trim().toLowerCase();
          // Empty string is normalizeProfileRow/fieldValue(undefined) — treat as missing.
          if (!normalized) return true;
          if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
          return true;
        }

        function __buildHeadlineMotionPlan(data, profile) {
          var baseBeats = __headlineMotionBeats[profile] || {};
          var zeroOffers = __isZeroOffers(data);
          var beats = zeroOffers ? __applyOffers0BeatOverlay(baseBeats) : baseBeats;
          var includeRoundel = profile === 'frames-4';
          var headings = [];
          for (var index = 1; index <= 4; index += 1) {
            headings.push(__normalizeHeadlineText(data['heading' + index + '_text']));
          }
          var skipped = zeroOffers ? {} : __skippedHeadlineActs(headings, includeRoundel);
          var windows = __headlineMotionLayers.map(function(layer, index) {
            var act = index + 1;
            var clips = (layer.clips[profile] || []);
            var keyframes = __compileHeadlineClips(clips, beats);
            var authoredEnd = clips.length ? __resolveBeat(clips[0].end || 100, beats) : 100;
            var authoredStart = clips.length ? __resolveBeat(clips[0].start || 0, beats) : 0;
            var enterDuration = clips.length && clips[0].params
              ? Number(clips[0].params.enter_duration_pct)
              : NaN;
            return {
              act: act,
              layerId: layer.id,
              keyframes: keyframes,
              start: authoredStart,
              end: authoredEnd,
              hidden: act === 3 && !includeRoundel,
              color: layer.color || null,
              enterDurationPct: isFinite(enterDuration) && enterDuration > 0 ? enterDuration : 2,
              clips: clips
            };
          });
          if (zeroOffers) {
            var eligible = __eligibleHeadlineActs(includeRoundel).filter(function(act) { return act !== 4; });
            var activeActs = eligible.filter(function(act) { return headings[act - 1]; });
            var windowStart = Number(beats.act1_in || 0);
            var windowEnd = Number(
              beats.green_in != null ? beats.green_in
                : ((beats.act4_in != null ? beats.act4_in
                  : (beats.bn_cta_in != null ? beats.bn_cta_in : (beats.cta_in || 100))) - 3.3)
            );
            var span = Math.max(0.01, windowEnd - windowStart);
            var slice = activeActs.length ? span / activeActs.length : span;
            var activeSet = {};
            activeActs.forEach(function(act) { activeSet[act] = true; });
            var heading4Enabled = __isHeading4Enabled(data);
            windows.forEach(function(window) {
              if (window.act === 4) {
                if (!(heading4Enabled && headings[3])) {
                  window.hidden = true;
                  window.keyframes = [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
                } else {
                  // Match buildHeadlineMotionPlan: pin Act 4 to act4_in (not banner bn_cta_in).
                  var act4Start = Number(
                    beats.act4_in != null ? beats.act4_in
                      : (beats.bn_cta_in != null ? beats.bn_cta_in
                        : (beats.cta_in != null ? beats.cta_in : window.start))
                  );
                  var source = (window.clips && window.clips[0]) || {};
                  var rebuilt = [{
                    preset: source.preset || 'slideInRight',
                    start: act4Start,
                    end: window.end,
                    params: source.params || {}
                  }];
                  window.start = act4Start;
                  window.hidden = false;
                  window.keyframes = __compileHeadlineClips(rebuilt, beats);
                }
                return;
              }
              if (!activeSet[window.act]) {
                window.hidden = true;
                window.keyframes = [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
                return;
              }
              var order = activeActs.indexOf(window.act);
              var start = Number((windowStart + slice * order).toFixed(4));
              var end = Number((windowStart + slice * (order + 1)).toFixed(4));
              var source = (window.clips && window.clips[0]) || {};
              var rebuilt = [{
                preset: source.preset || 'slideInRight',
                start: start,
                end: end,
                params: source.params || {}
              }];
              window.start = start;
              window.end = end;
              window.hidden = false;
              window.keyframes = __compileHeadlineClips(rebuilt, beats);
            });
            return windows;
          }
          for (var skippedAct = 2; skippedAct <= 4; skippedAct += 1) {
            if (skippedAct === 3 && !includeRoundel) continue;
            if (!skipped[skippedAct]) continue;
            var current = windows[skippedAct - 1];
            var previousIndex = skippedAct - 2;
            while (previousIndex >= 0 && windows[previousIndex].hidden) previousIndex -= 1;
            if (previousIndex < 0 || !current) continue;
            var previous = windows[previousIndex];
            previous.keyframes = __mergeSkipHold(
              previous.keyframes,
              current.end,
              current.color ? {
                at: current.start,
                color: current.color,
                fromColor: previous.color || __DEFAULT_HEADLINE_INK,
                fadePct: current.enterDurationPct
              } : null
            );
            previous.end = current.end;
            current.hidden = true;
            current.keyframes = [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
          }
          return windows;
        }

        function applyHeadlineTransitionSkips(data, includeRoundel) {
          var profile = includeRoundel ? 'frames-4' : 'frames-3';
          var plan = __buildHeadlineMotionPlan(data, profile);
          var zeroOffers = __isZeroOffers(data);
          var hasSkips = plan.some(function(item) { return item.hidden; });
          var style = document.getElementById('sse-headline-skip-styles');
          if (!hasSkips && !zeroOffers) {
            if (style) style.textContent = '';
            return;
          }
          if (!style) {
            style = document.createElement('style');
            style.id = 'sse-headline-skip-styles';
            document.head.appendChild(style);
          }
          var css = plan.map(function(item) {
            var name = item.layerId + '-skip-' + profile;
            var block = '@keyframes ' + name + ' {\\n' + __keyframesCss(name, item.keyframes) + '\\n}';
            if (item.hidden) {
              return block + '\\n#' + item.layerId + ' { visibility: hidden !important; animation: none !important; }';
            }
            return block + '\\n#' + item.layerId + ' { animation: ' + __headlineMotionDuration + 's linear 0s ' + __headlineMotionIteration + ' normal forwards running ' + name + ' !important; }';
          }).join('\\n\\n');
          style.textContent = css;
        }`;
};
