import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  activeFrameScope,
  beatsForScopes,
  FOUR_ACT_BEATS,
} from './timing-profiles';

const document = {
  clock: {
    durationS: 15,
    beats: {
      act2_in: 43,
      swap: 65,
      cta_in: 69,
    },
    profiles: {
      'frames-4': {
        act2_in: 33.3,
        swap: 56.7,
        roundel_in: 56.7,
        cta_in: 80,
      },
    },
  },
};

test('resolves frames-3 timing to existing beats by default', () => {
  assert.equal(activeFrameScope(['offers-1', 'frames-3']), 'frames-3');
  assert.deepEqual(beatsForScopes(document, ['offers-1', 'frames-3']), {
    ...document.clock.beats,
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
});

test('provides the initial four-act beat preset', () => {
  assert.equal(FOUR_ACT_BEATS.act2_in, 33.3);
  assert.equal(FOUR_ACT_BEATS.roundel_in, 56.7);
  assert.equal(FOUR_ACT_BEATS.cta_in, 80);
  assert.equal(FOUR_ACT_BEATS.end, 100);
});
