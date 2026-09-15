// Approved-creative checks: run separately with npm run test:creative.
import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  activeFrameScope,
  beatsForScopes,
  FOUR_ACT_BEATS,
  frames3Act4In,
  OFFERS_0_BEAT_OVERLAY,
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
          // 320x50 banners use a longer soft-stagger (6 / 5 / 4); other sizes stay snappier.
          const maxOfferEnter = sizeName === '320x50' ? 6 : 3;
          assert.ok(
            duration >= 1.8 && duration <= maxOfferEnter,
            `${sizeName}/${layer.id} offer enter duration out of range`,
          );
        }
      }
      if (layer.id === 'offer-slot-1') {
        assert.equal(layer.clips?.[0]?.start, 'offer1_in', `${sizeName}: offer1 uses offer1_in`);
      }
    }
    const headline = (sizeCreative.layers || []).find((layer) => layer.id === 'headline-act1');
    const headlineEnter = Number(headline?.clips?.[0]?.params?.enter_duration_pct);
    assert.equal(headlineEnter, 4, `${sizeName}: headline enter_duration_pct should be 4`);
    const headlineEnters = (sizeCreative.layers || [])
      .filter((layer) => String(layer.id || '').startsWith('headline-act'))
      .flatMap((layer) => (layer.clips || [])
        .filter((clip) => clip.preset === 'slideInRight')
        .map((clip) => Number(clip.params?.enter_duration_pct)));
    assert.ok(headlineEnters.length > 0, `${sizeName}: expected headline slide clips`);
    assert.ok(
      headlineEnters.every((value) => value === headlineEnter),
      `${sizeName}: headline enter durations must match across acts (got ${headlineEnters.join(', ')})`,
    );
  }

  const frames4 = beatsForScopes(creative, ['offers-3', 'frames-4']);
  // Headline starts once greenwave is mostly on (~75%+ of a 6–7% sweep from start+7).
  assert.ok(frames4.act1_in >= 12, 'frames-4: act1_in after greenwave mid-sweep');
  assert.ok(frames4.act1_in + 4 <= frames4.offer1_in + 0.01, 'frames-4: enter=4 settles before offer1');
});
