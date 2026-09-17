import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  DEFAULT_CAMPAIGN_ID,
  getCampaign,
  isRegisteredCampaignId,
  listCampaigns,
  listStaticPreviewCampaigns,
} from '../campaign-registry';

test('lists registered campaigns including the default SSE DCO', () => {
  const campaigns = listCampaigns();
  assert.ok(campaigns.some((entry) => entry.id === DEFAULT_CAMPAIGN_ID));
  assert.equal(campaigns.length, 5);
  assert.deepEqual(
    campaigns.map((entry) => entry.id).sort(),
    [
      'product-demo',
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

test('non-DCO campaigns carry product clickTags', () => {
  assert.equal(
    getCampaign('sse-hiker-welcome').clickTag,
    'https://sseairtricity.com/uk/home/products/keypad-electricity',
  );
  assert.equal(
    getCampaign('sse-keepyuppy-welcome').clickTag,
    'https://sseairtricity.com/uk/home/products/electricity-welcome-credit',
  );
  assert.equal(
    getCampaign('sse-keepyuppy-discount').clickTag,
    'https://sseairtricity.com/uk/home/products/electricity-top-discount',
  );
  assert.equal(getCampaign('sse-dco').clickTag, undefined);
});

test('editor sync eligibility matches the server export allowlist',()=>{
 assert.deepEqual(listCampaigns().filter(c=>c.staticPreview).map(c=>c.id),listStaticPreviewCampaigns().map(c=>c.id));
 assert.equal(listCampaigns().find(c=>c.id==='product-demo')?.staticPreview,false);
});
