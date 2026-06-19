// @ts-nocheck

import { compileAnimationClips, type AnimationClip, type CreativeKeyframe } from '@/lib/creative-compiler';

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

export const clipsForProfile = (clips: AnimationClip[] = [], profile = 'frames-3') => (
  (clips || []).filter((clip: Record<string, unknown>) => {
    const profiles = clip.profiles;
    if (!profiles?.length) return true;
    return profiles.includes(profile);
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

const hiddenKeyframes = (): CreativeKeyframe[] => ([
  { at: 0, translate: [0, 0], opacity: 0 },
  { at: 100, translate: [0, 0], opacity: 0 },
]);

const mergeSkipHold = (keyframes: CreativeKeyframe[] = [], holdUntil: number) => {
  if (!keyframes.length) return keyframes;
  const sorted = [...keyframes].sort((a, b) => a.at - b.at);
  const settled = sorted.find((frame) => frame.opacity === 1) || sorted[0];
  const settledAt = settled?.at ?? sorted[0].at;
  const tail = sorted.filter((frame) => frame.at >= holdUntil);
  const exit = tail.length ? tail[tail.length - 1] : sorted[sorted.length - 1];
  const kept = sorted.filter((frame) => frame.at <= settledAt);
  const hold = [
    { ...settled, at: settledAt, opacity: 1 },
    { ...settled, at: holdUntil, opacity: 1 },
  ];
  if (exit.at <= holdUntil) return [...kept, ...hold];
  return [...kept, ...hold, exit];
};

type HeadlineWindow = {
  act: number;
  layerId: string;
  keyframes: CreativeKeyframe[];
  start: number;
  end: number;
  hidden: boolean;
};

export const buildHeadlineMotionPlan = (
  layers: Array<Record<string, unknown>> = [],
  row: Record<string, unknown> = {},
  profile = 'frames-3',
  beats: Record<string, number> = {},
) => {
  const includeRoundelFrame = profile === 'frames-4';
  const headings = headlineTextsFromRow(row);
  const skipped = skippedHeadlineActs(headings, includeRoundelFrame);
  const headlineLayers = HEADLINE_LAYER_IDS
    .map((id) => layers.find((layer) => layer.id === id))
    .filter(Boolean);

  const windows: HeadlineWindow[] = headlineLayers.map((layer, index) => {
    const act = index + 1;
    const clips = clipsForProfile(layer.clips, profile);
    const keyframes = clips.length ? compileAnimationClips(clips, beats) : hiddenKeyframes();
    return {
      act,
      layerId: String(layer.id),
      keyframes,
      start: keyframes[0]?.at ?? 0,
      end: keyframes[keyframes.length - 1]?.at ?? 100,
      hidden: act === 3 && !includeRoundelFrame,
    };
  });

  for (let act = 2; act <= 4; act += 1) {
    if (act === 3 && !includeRoundelFrame) continue;
    if (!skipped.has(act)) continue;
    const current = windows[act - 1];
    let previousIndex = act - 2;
    while (previousIndex >= 0 && windows[previousIndex].hidden) previousIndex -= 1;
    if (previousIndex < 0 || !current) continue;
    const previous = windows[previousIndex];
    previous.keyframes = mergeSkipHold(previous.keyframes, current.end);
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
  const scale = frame.scale ?? 1;
  const parts = [`translate3d(${x}px, ${y}px, 0px)`];
  if (scale !== 1) parts.push(`scale3d(${scale}, ${scale}, 1)`);
  return parts.join(' ');
};

export const keyframesCss = (name: string, keyframes: CreativeKeyframe[] = []) => (
  keyframes.map((frame) => (
    `      ${frame.at}% { transform: ${formatTransform(frame)}; opacity: ${frame.opacity ?? 1}; }`
  )).join('\n')
);

export const headlineSkipOverrideCss = (
  layers: Array<Record<string, unknown>> = [],
  row: Record<string, unknown> = {},
  profile = 'frames-3',
  beats: Record<string, number> = {},
  durationS = 15,
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
    blocks.push(`    #${item.layerId} { animation: ${durationS}s linear 0s 1 normal forwards running ${name} !important; }`);
  }

  return blocks.join('\n\n');
};

export const serializeHeadlineMotionLayers = (layers: Array<Record<string, unknown>> = []) => (
  HEADLINE_LAYER_IDS.map((id) => {
    const layer = layers.find((item) => item.id === id);
    if (!layer) return null;
    return {
      id,
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
) => {
  const headlineLayers = serializeHeadlineMotionLayers(layers);
  return `
        var __headlineMotionLayers = ${JSON.stringify(headlineLayers)};
        var __headlineMotionBeats = ${JSON.stringify(beatsProfiles)};
        var __headlineMotionDuration = ${Number(durationS) || 15};

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

        function __resolveBeat(ref, beats) {
          if (typeof ref === 'number') return ref;
          var match = String(ref).match(/^([a-z0-9_]+)\\s*([+-]\\s*\\d+)?$/i);
          if (!match || beats[match[1]] === undefined) return 0;
          return beats[match[1]] + (match[2] ? parseInt(match[2].replace(/\\s/g, ''), 10) : 0);
        }

        function __compileHeadlineClips(clips, beats) {
          if (!clips || !clips.length) {
            return [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
          }
          return __compileSlideInRight(clips[0], beats);
        }

        function __mergeSkipHold(keyframes, holdUntil) {
          var sorted = keyframes.slice().sort(function(a, b) { return a.at - b.at; });
          var settled = sorted.find(function(frame) { return frame.opacity === 1; }) || sorted[0];
          var settledAt = settled ? settled.at : sorted[0].at;
          var tail = sorted.filter(function(frame) { return frame.at >= holdUntil; });
          var exit = tail.length ? tail[tail.length - 1] : sorted[sorted.length - 1];
          var kept = sorted.filter(function(frame) { return frame.at <= settledAt; });
          var hold = [
            Object.assign({}, settled, { at: settledAt, opacity: 1 }),
            Object.assign({}, settled, { at: holdUntil, opacity: 1 })
          ];
          if (!exit || exit.at <= holdUntil) return kept.concat(hold);
          return kept.concat(hold, exit);
        }

        function __formatTransform(frame) {
          var translate = frame.translate || [0, 0];
          var scale = frame.scale == null ? 1 : frame.scale;
          var parts = ['translate3d(' + translate[0] + 'px, ' + translate[1] + 'px, 0px)'];
          if (scale !== 1) parts.push('scale3d(' + scale + ', ' + scale + ', 1)');
          return parts.join(' ');
        }

        function __keyframesCss(name, keyframes) {
          return keyframes.map(function(frame) {
            return '      ' + frame.at + '% { transform: ' + __formatTransform(frame) + '; opacity: ' + (frame.opacity == null ? 1 : frame.opacity) + '; }';
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

        function __buildHeadlineMotionPlan(data, profile) {
          var beats = __headlineMotionBeats[profile] || {};
          var includeRoundel = profile === 'frames-4';
          var headings = [];
          for (var index = 1; index <= 4; index += 1) {
            headings.push(__normalizeHeadlineText(data['heading' + index + '_text']));
          }
          var skipped = __skippedHeadlineActs(headings, includeRoundel);
          var windows = __headlineMotionLayers.map(function(layer, index) {
            var act = index + 1;
            var clips = (layer.clips[profile] || []);
            var keyframes = __compileHeadlineClips(clips, beats);
            return {
              act: act,
              layerId: layer.id,
              keyframes: keyframes,
              end: keyframes[keyframes.length - 1].at,
              hidden: act === 3 && !includeRoundel
            };
          });
          for (var skippedAct = 2; skippedAct <= 4; skippedAct += 1) {
            if (skippedAct === 3 && !includeRoundel) continue;
            if (!skipped[skippedAct]) continue;
            var current = windows[skippedAct - 1];
            var previousIndex = skippedAct - 2;
            while (previousIndex >= 0 && windows[previousIndex].hidden) previousIndex -= 1;
            if (previousIndex < 0 || !current) continue;
            var previous = windows[previousIndex];
            previous.keyframes = __mergeSkipHold(previous.keyframes, current.end);
            previous.end = current.end;
            current.hidden = true;
            current.keyframes = [{ at: 0, translate: [0, 0], opacity: 0 }, { at: 100, translate: [0, 0], opacity: 0 }];
          }
          return windows;
        }

        function applyHeadlineTransitionSkips(data, includeRoundel) {
          var profile = includeRoundel ? 'frames-4' : 'frames-3';
          var plan = __buildHeadlineMotionPlan(data, profile);
          var hasSkips = plan.some(function(item) { return item.hidden; });
          var style = document.getElementById('sse-headline-skip-styles');
          if (!hasSkips) {
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
            return block + '\\n#' + item.layerId + ' { animation: ' + __headlineMotionDuration + 's linear 0s 1 normal forwards running ' + name + ' !important; }';
          }).join('\\n\\n');
          style.textContent = css;
        }`;
};
