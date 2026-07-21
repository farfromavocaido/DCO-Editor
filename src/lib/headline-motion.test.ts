// @ts-nocheck

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { compileAnimationClips } from '@/lib/creative-compiler';
import {
  buildHeadlineMotionPlan,
  clipsForProfile,
  headlineAct4DisplayText,
  skippedHeadlineActs,
} from '@/lib/headline-motion';

const beats = {
  act1_in: 8,
  act1_out: 34.3,
  act2_in: 33.3,
  act2_out: 45,
  offers_exit: 57.7,
  roundel_in: 56.7,
  act4_in: 80,
  cta_in: 80,
  act3_exit: 96,
};

const beatsFrames3 = {
  act1_in: 12,
  act1_out: 44,
  act2_in: 43,
  offers_exit: 66,
  act4_in: 65.1,
  cta_in: 69,
  act3_exit: 96,
};

const headlineLayers = [
  {
    id: 'headline-act1',
    clips: [{ id: 'h1', preset: 'slideInRight', start: 'act1_in', end: 'act1_out', profiles: ['frames-4'] }],
  },
  {
    id: 'headline-act2',
    clips: [
      { id: 'h2f3', preset: 'slideInRight', start: 'act2_in', end: 'offers_exit', profiles: ['frames-3'] },
      { id: 'h2f4', preset: 'slideInRight', start: 'act2_in', end: 'offers_exit', profiles: ['frames-4'] },
    ],
  },
  {
    id: 'headline-act3',
    clips: [{ id: 'h3', preset: 'slideInRight', start: 'roundel_in', end: 'act4_in', profiles: ['frames-4'] }],
  },
  {
    id: 'headline-act4',
    clips: [
      { id: 'h4f3', preset: 'slideInRight', start: 'act4_in', end: 'act3_exit-1', profiles: ['frames-3'] },
      { id: 'h4f4', preset: 'slideInRight', start: 'act4_in', end: 'act3_exit-1', profiles: ['frames-4'] },
    ],
  },
];

test('filters headline clips by active profile', () => {
  const layer = {
    clips: [
      { id: 'a', preset: 'slideInRight', start: 'act1_in', end: 'act1_out', profiles: ['frames-3'] },
      { id: 'b', preset: 'slideInRight', start: 'act2_in', end: 'act2_out', profiles: ['frames-4'] },
      { id: 'c', preset: 'slideInRight', start: 'act1_in', end: 'act1_out' },
    ],
  };
  assert.equal(clipsForProfile(layer.clips, 'frames-3').length, 2);
  assert.equal(clipsForProfile(layer.clips, 'frames-4').length, 2);
});

test('does not skip when identical headlines are not consecutive', () => {
  assert.deepEqual(
    [...skippedHeadlineActs(['Same', 'Different', 'Same', 'Other'], true)],
    [],
  );
});

test('shows headline act1 in frames-4 when clip is unscoped', () => {
  const layers = [
    {
      id: 'headline-act1',
      clips: [{ id: 'h1', preset: 'slideInRight', start: 'act1_in', end: 'act1_out' }],
    },
    {
      id: 'headline-act2',
      clips: [{ id: 'h2', preset: 'slideInRight', start: 'act2_in', end: 'act2_out', profiles: ['frames-4'] }],
    },
    {
      id: 'headline-act3',
      clips: [{ id: 'h3', preset: 'slideInRight', start: 'roundel_in', end: 'act4_in', profiles: ['frames-4'] }],
    },
    {
      id: 'headline-act4',
      clips: [{ id: 'h4', preset: 'slideInRight', start: 'act4_in', end: 'act3_exit-1', profiles: ['frames-4'] }],
    },
  ];
  const plan = buildHeadlineMotionPlan(
    layers,
    {
      heading1_text: 'Same line',
      heading2_text: 'Different',
      heading3_text: 'Same line',
      heading4_text: 'Final',
    },
    'frames-4',
    beats,
  );
  const act1 = plan.find((item) => item.layerId === 'headline-act1');
  assert.ok(act1);
  assert.equal(act1.hidden, false);
  assert.ok(act1.keyframes.some((frame) => frame.opacity === 1));
});

test('detects consecutive identical headline acts to skip', () => {
  assert.deepEqual(
    [...skippedHeadlineActs(['One', 'One', 'Two', 'Two'], true)],
    [2, 4],
  );
});

test('hands headline act4 off act2 without a roundel gap', () => {
  const layers = [
    headlineLayers[0],
    headlineLayers[1],
    headlineLayers[3],
  ];
  const h2Frames = compileAnimationClips(
    clipsForProfile(layers[1].clips, 'frames-3'),
    beatsFrames3,
  );
  const h4Frames = compileAnimationClips(
    clipsForProfile(layers[2].clips, 'frames-3'),
    beatsFrames3,
  );

  const h2End = h2Frames[h2Frames.length - 1].at;
  const h4Start = h4Frames.find((frame) => frame.at === beatsFrames3.act4_in)?.at;
  assert.equal(h4Start, beatsFrames3.act4_in);
  assert.ok(h4Start <= h2End, `expected H4 at ${h4Start}% to overlap H2 exit at ${h2End}%`);
});

test('uses headline act3 between offers and CTA when roundel is on', () => {
  const h2Frames = compileAnimationClips(
    clipsForProfile(headlineLayers[1].clips, 'frames-4'),
    beats,
  );
  const h3Frames = compileAnimationClips(
    clipsForProfile(headlineLayers[2].clips, 'frames-4'),
    beats,
  );
  const h4Frames = compileAnimationClips(
    clipsForProfile(headlineLayers[3].clips, 'frames-4'),
    beats,
  );

  const h2End = h2Frames[h2Frames.length - 1].at;
  const h3Start = h3Frames.find((frame) => frame.at === beats.roundel_in)?.at ?? h3Frames[0].at;
  const h3End = h3Frames[h3Frames.length - 1].at;
  const h4Start = h4Frames.find((frame) => frame.at === beats.act4_in)?.at;

  assert.ok(h3Start <= h2End + 1);
  assert.ok(h3End >= beats.offers_exit);
  assert.equal(h4Start, beats.act4_in);
});

test('extends the previous headline window when consecutive copy matches', () => {
  const plan = buildHeadlineMotionPlan(
    headlineLayers,
    {
      heading1_text: 'Same line',
      heading2_text: 'Same line',
      heading3_text: 'Different',
      heading4_text: 'Different',
    },
    'frames-4',
    beats,
  );

  const act1 = plan.find((item) => item.layerId === 'headline-act1');
  const act2 = plan.find((item) => item.layerId === 'headline-act2');
  const act3 = plan.find((item) => item.layerId === 'headline-act3');

  assert.ok(act1 && act2 && act3);
  assert.equal(act2.hidden, true);
  assert.equal(act2.keyframes[0].opacity, 0);
  assert.ok(act1.end >= 57.7);
  assert.equal(act3.hidden, false);
});

test('skip-hold still fades the last visible headline out at the skipped act exit', () => {
  const plan = buildHeadlineMotionPlan(
    headlineLayers,
    {
      heading1_text: 'A different kind of energy',
      heading2_text: 'Our very best electricity plan',
      heading3_text: 'A different kind of energy',
      heading4_text: 'A different kind of energy',
    },
    'frames-4',
    beats,
  );

  const act3 = plan.find((item) => item.layerId === 'headline-act3');
  const act4 = plan.find((item) => item.layerId === 'headline-act4');
  assert.equal(act4?.hidden, true);
  assert.equal(act3?.hidden, false);
  assert.equal(act3?.end, 95);

  const opacities = (act3?.keyframes || []).map((frame) => ({ at: frame.at, opacity: frame.opacity }));
  assert.ok(opacities.some((frame) => frame.opacity === 1), 'must hold visible during the extended window');
  const exit = [...opacities].reverse().find((frame) => frame.opacity === 0 && frame.at <= 95);
  assert.ok(exit, 'must fade to 0 at the skipped act exit');
  assert.equal(exit.at, 95);
  assert.equal(opacities[opacities.length - 1].opacity, 0);
  assert.equal(opacities[opacities.length - 1].at, 100);
});

test('skip-hold crossfades skipped act ink over the enter duration', () => {
  const layers = headlineLayers.map((layer) => {
    if (layer.id !== 'headline-act4') return layer;
    return {
      ...layer,
      base: { color: 'rgb(255, 255, 255)' },
      clips: layer.clips.map((clip) => (
        clip.profiles?.includes('frames-4')
          ? { ...clip, params: { ...clip.params, enter_duration_pct: 2 } }
          : clip
      )),
    };
  });
  const plan = buildHeadlineMotionPlan(
    layers,
    {
      heading1_text: 'One',
      heading2_text: 'Two',
      heading3_text: 'Same end',
      heading4_text: 'Same end',
    },
    'frames-4',
    beats,
  );

  const act3 = plan.find((item) => item.layerId === 'headline-act3');
  assert.equal(act3?.hidden, false);
  const before = (act3?.keyframes || []).filter((frame) => frame.at <= 80);
  const afterFade = (act3?.keyframes || []).filter((frame) => frame.at >= 82);
  assert.ok(before.length > 0);
  assert.ok(before.every((frame) => frame.color === 'rgb(0, 41, 117)'), 'green-wave window stays navy');
  assert.ok(afterFade.length > 0);
  assert.ok(afterFade.every((frame) => frame.color === 'rgb(255, 255, 255)'));
  assert.ok(
    (act3?.keyframes || []).some((frame) => frame.at === 80 && frame.color === 'rgb(0, 41, 117)'),
    'handoff start stays navy',
  );
  assert.ok(
    (act3?.keyframes || []).some((frame) => frame.at === 82 && frame.color === 'rgb(255, 255, 255)'),
    'handoff end reaches white (~300ms at 2%/15s)',
  );
});

test('hides act 3 and keeps act 4 visible when roundel is off', () => {
  const plan = buildHeadlineMotionPlan(
    headlineLayers,
    {
      heading1_text: 'One',
      heading2_text: 'Two',
      heading3_text: 'Same end',
      heading4_text: 'Same end',
    },
    'frames-3',
    beatsFrames3,
  );

  const act3 = plan.find((item) => item.layerId === 'headline-act3');
  const act4 = plan.find((item) => item.layerId === 'headline-act4');
  assert.equal(act3?.hidden, true);
  assert.equal(act4?.hidden, false);
  assert.deepEqual([...skippedHeadlineActs(['One', 'Two', 'Same end', 'Same end'], false)], []);
});

test('skips act 4 when roundel is off and heading2 matches heading4', () => {
  const plan = buildHeadlineMotionPlan(
    headlineLayers,
    {
      heading1_text: 'One',
      heading2_text: 'Same end',
      heading3_text: 'Ignored',
      heading4_text: 'Same end',
    },
    'frames-3',
    beatsFrames3,
  );

  const act2 = plan.find((item) => item.layerId === 'headline-act2');
  const act4 = plan.find((item) => item.layerId === 'headline-act4');
  assert.equal(act2?.hidden, false);
  assert.equal(act4?.hidden, true);
  assert.ok((act2?.end ?? 0) >= 95);
});

test('falls back to heading3 for act4 display when roundel is off', () => {
  assert.equal(
    headlineAct4DisplayText({ heading3_text: 'Legacy endframe', heading4_text: '' }, false),
    'Legacy endframe',
  );
  assert.equal(
    headlineAct4DisplayText({ heading3_text: 'Legacy', heading4_text: 'Preferred' }, false),
    'Preferred',
  );
});
