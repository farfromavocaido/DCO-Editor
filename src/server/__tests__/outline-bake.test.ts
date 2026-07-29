import assert from 'node:assert/strict';
import { test } from 'vitest';

import { readCreativeDocumentForCampaign } from '../creative-document';
import { bakeOutlinedOfferSlotSvgs, bakeOutlinedText, placeSvgInContentBox } from '../outline-bake';
import { activeScopesFromControls, controlsFromFeedRow } from '@/lib/feed-model';

test('placeSvgInContentBox reapplies fit bottom-align translateY', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="26"></svg>';
  const placed = placeSvgInContentBox(
    svg,
    {
      size: '320x50',
      texts: {
        'offer-slot-1::offer-value': {
          key: 'offer-slot-1::offer-value',
          text: '10.5%',
          fontSize: 30.5,
          letterSpacingEm: -0.05,
          alignOffsetY: 2.975,
          scaleOfferSymbols: true,
        },
      },
      positions: {
        'offer-slot-1::offer-value': {
          key: 'offer-slot-1::offer-value',
          left: 4,
          top: 1,
          width: 67,
          height: 21,
          contentLeft: -0.36,
          contentTop: -4.92,
          contentWidth: 67.72,
          contentHeight: 25.92,
        },
      },
    },
    'offer-slot-1::offer-value',
  );
  // contentTop (-4.92) + alignOffsetY (2.975) → -1.94 (2dp)
  assert.match(placed, /top:-1\.94px/);
  assert.match(placed, /left:-0\.36px/);
});


test('bakeOutlinedText scales offer-value symbols without a snapshot', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const size = '160x600';
  const row = document.feed.sampleRows[0];
  const activeScopes = activeScopesFromControls(controlsFromFeedRow(row));
  const outlined = await bakeOutlinedText({
    document,
    size,
    targetId: 'offer-slot-1::offer-value',
    text: '10%',
    activeScopes,
    fallbackFit: { mode: 'shrink', tracking: { minEm: -0.05 }, align: 'bottom' },
  });
  assert.match(outlined.svg, /<path /);
  assert.doesNotMatch(outlined.svg, /NaN/);
});

test('bakeOutlinedOfferSlotSvgs locks snapshot fontSize and letterSpacing', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const size = '160x600';
  const row = document.feed.sampleRows.find((sample) => Number(sample.offer_count_num) === 2)
    || document.feed.sampleRows[0];
  const activeScopes = activeScopesFromControls(controlsFromFeedRow(row));
  const snapshot = {
    size,
    texts: {
      'offer-slot-1::offer-value': {
        key: 'offer-slot-1::offer-value',
        text: String(row.offer1_value_text || '10%'),
        fontSize: 55.5,
        letterSpacingEm: -0.02,
        alignOffsetY: 4.25,
        scaleOfferSymbols: true,
      },
      'offer-slot-1::offer-subline': {
        key: 'offer-slot-1::offer-subline',
        text: String(row.offer1_sub_text || 'OFF'),
        fontSize: 9,
        letterSpacingEm: 0,
        alignOffsetY: 0,
      },
    },
    positions: {
      'plus-1': { key: 'plus-1', left: 70, top: 40 },
    },
  };
  const baked = await bakeOutlinedOfferSlotSvgs({
    document,
    size,
    row,
    activeScopes,
    snapshot,
  });
  assert.match(baked['offer-slot-1'].valueSvg, /translate\(0 4\.25\)/);
  assert.match(baked['offer-slot-1'].valueSvg, /<path /);
});
