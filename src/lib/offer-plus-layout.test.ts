import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveOfferPlusLayout } from './offer-plus-layout';

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
