import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  DEFAULT_DCO_MARKET_ID,
  getDcoMarket,
  listDcoMarkets,
  STUDIO_DEV_DYNAMIC_FIELD_ORDER,
} from '@/lib/dco-markets';

test('ROI and NIR share schema and differ by profile binding plus sample copy', () => {
  const [roi, ni] = listDcoMarkets();
  assert.equal(roi.id, 'roi');
  assert.equal(ni.id, 'ni');
  assert.equal(roi.profileId, 10964545);
  assert.equal(roi.profileElement, 'SSE_DCO_ROI_Delivery');
  assert.equal(ni.profileId, 10962603);
  assert.equal(ni.profileElement, 'SSE_DCO_NIR_Delivery');
  assert.equal(getDcoMarket(DEFAULT_DCO_MARKET_ID).id, 'roi');

  assert.deepEqual(
    Object.keys(roi.studioSample).sort(),
    Object.keys(ni.studioSample).sort(),
  );
  assert.equal(roi.studioSample.Unique_ID, 'Adsu_ROI_Prospecting-Main-1_diy');
  assert.equal(ni.studioSample.Unique_ID, 'Adsu_NIR_Prospecting-Main-1_diy');
  assert.deepEqual(roi.studioSample.Region, ['ROI']);
  assert.deepEqual(ni.studioSample.Region, ['NIR']);
  assert.equal(roi.studioSample.heading1_text, 'BIG DEAL energy ');
  assert.equal(ni.studioSample.heading1_text, 'Our very best discount');
  assert.equal(ni.studioSample.offer1_value_text, '15%');
  assert.equal(ni.studioSample.include_roundel_frame_bool, false);
  assert.equal(ni.studioSample.heading4_text_320x50, 'A different kind <br> of energy');
  assert.equal(roi.studioSample._00_Exit_URL.Url, ni.studioSample._00_Exit_URL.Url);
});

test('Studio field order includes enable-snippet metadata and size overrides', () => {
  assert.equal(STUDIO_DEV_DYNAMIC_FIELD_ORDER[0], '_id');
  assert.ok(STUDIO_DEV_DYNAMIC_FIELD_ORDER.includes('_00_Exit_URL'));
  assert.ok(STUDIO_DEV_DYNAMIC_FIELD_ORDER.includes('Region'));
  assert.ok(STUDIO_DEV_DYNAMIC_FIELD_ORDER.includes('heading2_text_320x50'));
  assert.ok(STUDIO_DEV_DYNAMIC_FIELD_ORDER.includes('background_image_url_728x90'));
});
