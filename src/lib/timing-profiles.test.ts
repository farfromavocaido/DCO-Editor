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
