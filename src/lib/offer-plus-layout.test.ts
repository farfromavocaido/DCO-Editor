import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  presentationSnapshotsForOfferPlusLayout,
  resolveOfferPlusLayout,
  stripAutoOfferPositions,
} from './offer-plus-layout';

test('resolveOfferPlusLayout defaults non-DCO to manual and DCO to auto', () => {
  assert.equal(resolveOfferPlusLayout({ campaign: { id: 'sse-dco' } }), 'auto');
  assert.equal(resolveOfferPlusLayout({ campaign: { id: 'sse-hiker-welcome' } }), 'manual');
  assert.equal(resolveOfferPlusLayout({ campaign: { id: 'sse-keepyuppy-welcome' } }), 'manual');
  assert.equal(
    resolveOfferPlusLayout({ campaign: { id: 'sse-dco', offerPlusLayout: 'manual' } }),
    'manual',
  );
  assert.equal(
    resolveOfferPlusLayout({ campaign: { id: 'sse-hiker-welcome', offerPlusLayout: 'auto' } }),
    'auto',
  );
});

test('stripAutoOfferPositions keeps text metrics but drops slot/plus XY', () => {
  const stripped = stripAutoOfferPositions({
    size: '300x250',
    texts: {
      'offer-slot-1::offer-value': {
        key: 'offer-slot-1::offer-value',
        text: '10%',
        fontSize: 50,
        letterSpacingEm: 0,
        alignOffsetY: 0,
      },
    },
    positions: {
      'plus-1': { key: 'plus-1', left: 144, top: 111 },
      'offer1': { key: 'offer1', left: 12, top: 82 },
      'offer-slot-1': { key: 'offer-slot-1', left: 12, top: 82 },
      'cta': { key: 'cta', left: 10, top: 200 },
    },
  });
  assert.ok(stripped);
  assert.equal(stripped.texts['offer-slot-1::offer-value']?.fontSize, 50);
  assert.equal(stripped.positions['plus-1'], undefined);
  assert.equal(stripped.positions.offer1, undefined);
  assert.equal(stripped.positions['offer-slot-1'], undefined);
  assert.deepEqual(stripped.positions.cta, { key: 'cta', left: 10, top: 200 });
});

test('presentationSnapshotsForOfferPlusLayout only strips when manual', () => {
  const snapshots = {
    '300x250': {
      size: '300x250',
      texts: {},
      positions: { 'plus-1': { key: 'plus-1', left: 1, top: 2 } },
    },
  };
  const auto = presentationSnapshotsForOfferPlusLayout(
    { campaign: { id: 'sse-dco' } },
    snapshots,
  );
  assert.equal(auto?.['300x250']?.positions['plus-1']?.left, 1);

  const manual = presentationSnapshotsForOfferPlusLayout(
    { campaign: { id: 'sse-hiker-welcome' } },
    snapshots,
  );
  assert.equal(manual?.['300x250']?.positions['plus-1'], undefined);
});
