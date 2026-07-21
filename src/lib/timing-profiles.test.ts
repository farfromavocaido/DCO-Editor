import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  activeFrameScope,
  beatsForScopes,
  FOUR_ACT_BEATS,
  frames3Act4In,
} from './timing-profiles';

const document = {
  clock: {
    durationS: 15,
    beats: {
      act2_in: 43,
      swap: 65,
      act4_in: 69,
      tc_exit: 69,
      cta_in: 69,
    },
    profiles: {
      'frames-3': {
        swap: 65,
        cta_in: 69,
        act4_in: 65.1,
        tc_exit: 69,
      },
      'frames-4': {
        act2_in: 33.3,
        swap: 56.7,
        roundel_in: 56.7,
        cta_in: 80,
        act4_in: 80,
        tc_exit: 80,
      },
    },
  },
};

test('resolves frames-3 timing to existing beats by default', () => {
  assert.equal(activeFrameScope(['offers-1', 'frames-3']), 'frames-3');
  assert.deepEqual(beatsForScopes(document, ['offers-1', 'frames-3']), {
    ...document.clock.beats,
    ...document.clock.profiles['frames-3'],
    roundel_in: document.clock.beats.swap,
  });
});

test('resolves frames-4 timing from the profile beats', () => {
  const beats = beatsForScopes(document, ['offers-1', 'frames-4']);

  assert.equal(activeFrameScope(['offers-1', 'frames-4']), 'frames-4');
  assert.equal(beats.act2_in, 33.3);
  assert.equal(beats.swap, 56.7);
  assert.equal(beats.roundel_in, 56.7);
  assert.equal(beats.cta_in, 80);
  assert.equal(beats.act4_in, 80);
});

test('provides the initial four-act beat preset', () => {
  assert.equal(FOUR_ACT_BEATS.act2_in, 33.3);
  assert.equal(FOUR_ACT_BEATS.act3_out, 55);
  assert.equal(FOUR_ACT_BEATS.roundel_in, 56.7);
  assert.equal(FOUR_ACT_BEATS.cta_in, 80);
  assert.equal(FOUR_ACT_BEATS.act4_in, 80);
  assert.equal(FOUR_ACT_BEATS.tc_exit, 80);
  assert.equal(FOUR_ACT_BEATS.end, 100);
});

test('exposes four-act headline beats only in the frames-4 profile', () => {
  assert.equal(beatsForScopes(document, ['offers-1', 'frames-3']).act3_out, undefined);
  assert.equal(beatsForScopes(document, ['offers-1', 'frames-4']).act3_out, FOUR_ACT_BEATS.act3_out);
});

test('maps tc_exit to cta_in in both profiles', () => {
  const frames3 = beatsForScopes(document, ['offers-1', 'frames-3']);
  const frames4 = beatsForScopes(document, ['offers-1', 'frames-4']);
  assert.equal(frames3.tc_exit, frames3.cta_in);
  assert.equal(frames4.tc_exit, frames4.cta_in);
  assert.equal(frames3.tc_exit, 69);
  assert.equal(frames4.tc_exit, 80);
});

test('places frames-3 headline act4 before cta_in for roundel-off handoff', () => {
  const frames3 = beatsForScopes(document, ['offers-1', 'frames-3']);
  const frames4 = beatsForScopes(document, ['offers-1', 'frames-4']);
  assert.equal(frames3.act4_in, frames3Act4In(frames3.swap));
  assert.ok(frames3.act4_in < frames3.cta_in);
  assert.equal(frames4.act4_in, frames4.cta_in);
  assert.equal(frames4.act4_in, frames4.tc_exit);
});

test('keeps offer micro-stagger ordered with pluses landing together', () => {
  assert.ok(FOUR_ACT_BEATS.act1_in < FOUR_ACT_BEATS.offer1_in);
  assert.ok(FOUR_ACT_BEATS.offer1_in < FOUR_ACT_BEATS.offer2_in);
  assert.ok(FOUR_ACT_BEATS.offer2_in < FOUR_ACT_BEATS.offer3_in);
  assert.ok(FOUR_ACT_BEATS.offer3_in < FOUR_ACT_BEATS.plus1_in);
  assert.equal(FOUR_ACT_BEATS.plus1_in, FOUR_ACT_BEATS.plus2_in);
  // Headline (act1_in + ~3%) should settle before offer1 starts.
  assert.ok(FOUR_ACT_BEATS.act1_in + 3 <= FOUR_ACT_BEATS.offer1_in + 0.01);
});

test('campaign clock profiles keep the same offer/plus choreography', async () => {
  const creative = (await import('../../campaign/sse-dco-creative.json')).default;
  for (const profile of ['frames-3', 'frames-4'] as const) {
    const beats = beatsForScopes(creative, ['offers-3', profile]);
    assert.ok(beats.act1_in < beats.offer1_in, `${profile}: headline before offer1`);
    assert.ok(beats.offer1_in < beats.offer2_in, `${profile}: offer1 before offer2`);
    assert.ok(beats.offer2_in < beats.offer3_in, `${profile}: offer2 before offer3`);
    assert.equal(beats.plus1_in, beats.plus2_in, `${profile}: pluses land together`);
    assert.ok(beats.offer3_in < beats.plus1_in, `${profile}: pluses after prices`);
  }
  for (const [sizeName, sizeCreative] of Object.entries(creative.sizes)) {
    for (const layer of sizeCreative.layers || []) {
      if (!/^offer-slot-|^plus-/.test(layer.id)) continue;
      for (const clip of layer.clips || []) {
        assert.equal(typeof clip.start, 'string', `${layer.id} should use named beats`);
        const duration = Number(clip.params?.enter_duration_pct);
        assert.ok(Number.isFinite(duration), `${sizeName}/${layer.id} needs enter_duration_pct`);
        if (layer.id.startsWith('plus-')) {
          assert.ok(duration >= 2.5, `${sizeName}/${layer.id} pluses should ease in a touch slower`);
        } else {
          assert.ok(duration >= 1.8 && duration <= 2.6, `${sizeName}/${layer.id} offer enter duration out of range`);
        }
      }
      if (layer.id === 'offer-slot-1') {
        assert.equal(layer.clips?.[0]?.start, 'offer1_in', `${sizeName}: offer1 uses offer1_in`);
      }
    }
    const headline = (sizeCreative.layers || []).find((layer) => layer.id === 'headline-act1');
    const headlineEnter = Number(headline?.clips?.[0]?.params?.enter_duration_pct);
    assert.ok(headlineEnter > 0 && headlineEnter <= 4, `${sizeName}: headline should settle before offers`);
  }
});
