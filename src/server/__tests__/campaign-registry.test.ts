import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  DEFAULT_CAMPAIGN_ID,
  getCampaign,
  isRegisteredCampaignId,
  listCampaigns,
} from '../campaign-registry';

test('lists registered campaigns including the default SSE DCO', () => {
  const campaigns = listCampaigns();
  assert.ok(campaigns.some((entry) => entry.id === DEFAULT_CAMPAIGN_ID));
  assert.equal(campaigns.length, 4);
  assert.deepEqual(
    campaigns.map((entry) => entry.id).sort(),
    [
      'sse-dco',
      'sse-hiker-welcome',
      'sse-keepyuppy-discount',
      'sse-keepyuppy-welcome',
    ],
  );
});

test('resolves campaign entries and rejects unknown ids', () => {
  assert.equal(getCampaign(undefined).id, DEFAULT_CAMPAIGN_ID);
  assert.equal(getCampaign('sse-hiker-welcome').exportSlug, 'SSE_Hiker_Welcome');
  assert.equal(isRegisteredCampaignId('sse-keepyuppy-welcome'), true);
  assert.equal(isRegisteredCampaignId('nope'), false);
  assert.throws(() => getCampaign('nope'), /Unknown campaign id/);
});
