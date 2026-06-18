import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  compileAnimationClips,
  frameAtPercent,
  resolveTimeRef,
} from './creative-compiler';

test('resolves beat references with numeric offsets', () => {
  assert.equal(resolveTimeRef('wave2_in+7', { wave2_in: 61 }), 68);
  assert.equal(resolveTimeRef('act3_exit-1', { act3_exit: 96 }), 95);
  assert.equal(resolveTimeRef(44, {}), 44);
});

test('compiles a fade clip into visible fade-in and fade-out keyframes', () => {
  const keyframes = compileAnimationClips([
    {
      id: 'logo-act3-fade',
      preset: 'fade',
      start: 'wave2_in+7',
      end: 'end',
      params: { enter_duration_pct: 5, fade_pct: 4 },
    },
  ], { wave2_in: 61, end: 100 });

  assert.deepEqual(keyframes.map((keyframe) => ({
    at: keyframe.at,
    opacity: keyframe.opacity,
  })), [
    { at: 0, opacity: 0 },
    { at: 68, opacity: 0 },
    { at: 73, opacity: 1 },
    { at: 96, opacity: 1 },
    { at: 100, opacity: 0 },
  ]);

  assert.equal(frameAtPercent(keyframes, 68).opacity, 0);
  assert.equal(frameAtPercent(keyframes, 73).opacity, 1);
  assert.equal(frameAtPercent(keyframes, 98).opacity, 0.5);
});

test('compiles slide and pop presets with transform values for preview/export parity', () => {
  const slide = compileAnimationClips([
    {
      id: 'headline-slide',
      preset: 'slideInRight',
      start: 'act1_in',
      end: 'act1_out',
      params: { enter_distance_px: 150, enter_duration_pct: 5, exit_dy: 20, fade_pct: 2 },
    },
  ], { act1_in: 12, act1_out: 44 });

  assert.deepEqual(slide.find((keyframe) => keyframe.at === 12)?.translate, [150, 0]);
  assert.deepEqual(slide.find((keyframe) => keyframe.at === 17)?.translate, [0, 0]);
  assert.deepEqual(slide.find((keyframe) => keyframe.at === 44)?.translate, [0, 20]);

  const pop = compileAnimationClips([
    {
      id: 'cta-pop',
      preset: 'popPulse',
      start: 'cta_in',
      end: 'act3_exit',
      params: {
        start_scale: 0.297,
        pulse_scale: 1.08,
        anchor_y: 0,
        enter_duration_pct: 3,
        fade_pct: 2,
        pulse_start: 'cta_pulse_start',
        pulse_peak: 'cta_pulse_peak',
        pulse_end: 'cta_pulse_end',
      },
    },
  ], {
    cta_in: 69,
    cta_pulse_start: 80,
    cta_pulse_peak: 82,
    cta_pulse_end: 83,
    act3_exit: 96,
  });

  assert.equal(pop.find((keyframe) => keyframe.at === 69)?.scale, 0.297);
  assert.equal(pop.find((keyframe) => keyframe.at === 82)?.scale, 1.08);
});

test('matches legacy gwd-tl pattern defaults for timing and easing', () => {
  const beats = {
    act1_in: 12,
    act1_out: 44,
    cta_in: 69,
    cta_pulse_start: 80,
    cta_pulse_peak: 82,
    cta_pulse_end: 83,
    act3_exit: 96,
  };

  const slide = compileAnimationClips([
    { id: 'headline-slide', preset: 'slideInRight', start: 'act1_in', end: 'act1_out' },
  ], beats);
  assert.deepEqual(slide.map((keyframe) => keyframe.at), [0, 12, 19, 42, 44, 100]);
  assert.deepEqual(slide[1].translate, [320, 0]);
  assert.equal(slide[1].easing, 'ease-out');

  const fadeUp = compileAnimationClips([
    { id: 'terms-fade', preset: 'fadeUp', start: 'act1_in', end: 'act1_out' },
  ], beats);
  assert.deepEqual(fadeUp.map((keyframe) => keyframe.at), [0, 12, 14, 42, 44, 100]);
  assert.equal(fadeUp[1].easing, 'ease-out');

  const pop = compileAnimationClips([
    {
      id: 'cta-pop',
      preset: 'popPulse',
      start: 'cta_in',
      end: 'act3_exit',
      params: {
        pulse_start: 'cta_pulse_start',
        pulse_peak: 'cta_pulse_peak',
        pulse_end: 'cta_pulse_end',
      },
    },
  ], beats);
  assert.deepEqual(pop.map((keyframe) => keyframe.at), [0, 69, 72, 80, 82, 83, 94, 96, 100]);
  assert.equal(pop[1].easing, 'ease-out');
  assert.equal(pop[3].easing, 'ease-in-out');
  assert.equal(pop[4].scale, 1.15);
});
