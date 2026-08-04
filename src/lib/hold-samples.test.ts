import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import assert from 'node:assert/strict';
import { test } from 'vitest';

import { compileAnimationClips, frameAtPercent } from './creative-compiler';
import { clipsForProfile } from './headline-motion';
import {
  frameNameForMs,
  holdSamplesForSize,
  qaHoldLayerIdsForScopes,
  scopesFromFeedRow,
  snapToIntervalMs,
} from './hold-samples';
import { activeFrameScope, beatsForScopes } from './timing-profiles';

const here = path.dirname(fileURLToPath(import.meta.url));
const creativePath = path.resolve(here, '../../campaign/sse-dco-creative.json');
const document = JSON.parse(fs.readFileSync(creativePath, 'utf8')) as Record<string, unknown>;

const longRow = (overrides: Record<string, unknown> = {}) => ({
  offer_count_num: 2,
  include_roundel_frame_bool: true,
  tc_type_enum: 'tcs_units',
  cta_type_enum: 'rectangle',
  heading1_text: 'A different kind of energy',
  heading2_text: "This year's best electricity plan",
  heading3_text: 'A different kind of energy',
  heading4_text: 'A different kind of energy',
  offer1_value_text: '11%',
  offer1_sub_text: 'OFF ELECTRICITY*',
  offer2_value_text: '£8,888',
  offer2_sub_text: 'OFF ELECTRICITY*',
  roundel_text_text: 'Saving you up to',
  roundel_value_text: '£8,888',
  tc_terms_text: '*T&Cs apply. See sseairtricity.com for full terms.',
  ...overrides,
});

test('snapToIntervalMs rounds to capture grid', () => {
  assert.equal(snapToIntervalMs(5120, 250), 5000);
  assert.equal(snapToIntervalMs(5250, 250), 5250);
  assert.equal(frameNameForMs(250), 't0250.png');
  assert.equal(frameNameForMs(10000), 't10000.png');
});

test('scopesFromFeedRow maps matrix variant flags', () => {
  assert.deepEqual(scopesFromFeedRow(longRow()), [
    'offers-2',
    'tc-prices',
    'cta-rect',
    'frames-4',
    'roundel-frame-on',
    'roundel-split',
  ]);
  assert.ok(scopesFromFeedRow(longRow({
    offer_count_num: 3,
    include_roundel_frame_bool: false,
    tc_type_enum: 'tcs_only',
    cta_type_enum: 'roundel',
    roundel_value_text: '',
  })).includes('frames-3'));
});

test('qaHoldLayerIdsForScopes gates offers, legal, and roundel', () => {
  const o1 = qaHoldLayerIdsForScopes(['offers-1', 'tc-prices', 'frames-4', 'roundel-frame-on']);
  assert.ok(o1.includes('offer-slot-1'));
  assert.ok(!o1.includes('offer-slot-2'));
  assert.ok(o1.includes('roundel-copy'));
  assert.ok(o1.includes('terms-prices'));
  assert.ok(!o1.includes('terms-solo'));

  const o3solo = qaHoldLayerIdsForScopes(['offers-3', 'tc-solo', 'frames-3', 'roundel-frame-off']);
  assert.ok(o3solo.includes('offer-slot-3'));
  assert.ok(o3solo.includes('terms-solo'));
  assert.ok(!o3solo.includes('roundel-copy'));
});

test('frames-4 yield a roundel hold that frames-3 do not', () => {
  const size = '300x600';
  const row = longRow();
  const withRoundel = holdSamplesForSize(
    document,
    size,
    scopesFromFeedRow(row),
    { row, intervalMs: 250 },
  );
  const withoutRoundel = holdSamplesForSize(
    document,
    size,
    scopesFromFeedRow(longRow({
      include_roundel_frame_bool: false,
      cta_type_enum: 'roundel',
      roundel_value_text: '',
    })),
    {
      row: longRow({
        include_roundel_frame_bool: false,
        cta_type_enum: 'roundel',
        roundel_value_text: '',
      }),
      intervalMs: 250,
    },
  );

  const roundelMs = withRoundel.samples
    .filter((sample) => sample.labels.includes('roundel'))
    .map((sample) => sample.tMs);
  assert.ok(roundelMs.length >= 1, 'frames-4 should sample a roundel hold');

  const noRoundelLabels = new Set(withoutRoundel.samples.flatMap((sample) => sample.labels));
  assert.ok(!noRoundelLabels.has('roundel'), 'frames-3 must not sample roundel holds');
  assert.ok(withRoundel.holdsMs.length >= 4, 'expected multiple holds for frames-4');
  assert.notDeepEqual(withRoundel.holdsMs, withoutRoundel.holdsMs);
});

test('offers-0 beat overlay changes hold samples vs offers-1', () => {
  const size = '300x250';
  const offers1 = holdSamplesForSize(
    document,
    size,
    scopesFromFeedRow(longRow({ offer_count_num: 1 })),
    { row: longRow({ offer_count_num: 1 }), intervalMs: 250 },
  );
  const offers0 = holdSamplesForSize(
    document,
    size,
    scopesFromFeedRow(longRow({
      offer_count_num: 0,
      tc_type_enum: 'tcs_only',
    })),
    {
      row: longRow({ offer_count_num: 0, tc_type_enum: 'tcs_only' }),
      intervalMs: 250,
    },
  );

  assert.notDeepEqual(offers0.holdsMs, offers1.holdsMs);
  assert.ok(!offers0.samples.some((sample) => sample.labels.includes('offer')));
  assert.ok(!offers0.samples.some((sample) => sample.labels.includes('legal')));
});

test('hold midpoints land inside settled opacity plateaus (not fade edges)', () => {
  const size = '300x600';
  const row = longRow({ offer_count_num: 1 });
  const scopes = scopesFromFeedRow(row);
  const samples = holdSamplesForSize(document, size, scopes, { row, intervalMs: 250 });

  const sizeCreative = (document.sizes as Record<string, { layers: Array<Record<string, unknown>> }>)[size];
  const beats = beatsForScopes(document, scopes);
  const profile = activeFrameScope(scopes);

  const legalLayers = sizeCreative.layers.filter((layer) => (
    layer.id === 'terms-prices' || layer.id === 'unit-rate-prices'
  ));
  assert.equal(legalLayers.length, 2);

  const legalKeyframes = legalLayers.map((layer) => compileAnimationClips(
    clipsForProfile((layer.clips || []) as never[], profile),
    beats,
  ));

  const legalSamples = samples.samples.filter((sample) => sample.labels.includes('legal'));
  assert.ok(legalSamples.length >= 1, 'expected a legal hold sample');
  for (const sample of legalSamples) {
    const anySettled = legalKeyframes.some((keyframes) => (
      frameAtPercent(keyframes, sample.pct).opacity >= 0.985
    ));
    assert.ok(anySettled, `legal sample at ${sample.tMs}ms not settled on terms or unit-rate`);
  }
});
