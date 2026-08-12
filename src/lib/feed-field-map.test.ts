import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  FEED_FIELD_MAP,
  remapStudioRowToCanonical,
} from '@/lib/feed-field-map';
import { validateFeedRows } from '@/server/feed-schema';

test('sidecar lists size-overridable fields and starts with identity aliases', () => {
  assert.ok(FEED_FIELD_MAP.sizeOverridableTextFields?.includes('heading1_text'));
  assert.ok(FEED_FIELD_MAP.sizeOverridableTextFields?.includes('tc_units_text'));
  assert.deepEqual(FEED_FIELD_MAP.studioToCanonical, {});
  assert.equal(FEED_FIELD_MAP.studioProfileId, 10964545);
  assert.equal(FEED_FIELD_MAP.studioProfileElement, 'SSE_DCO_ROI_Delivery');
});

test('remapStudioRowToCanonical copies Studio aliases when canonical is missing', () => {
  const remapped = remapStudioRowToCanonical(
    {
      heading1_text: 'Base',
      Heading_1_160x600: 'Studio override',
    },
    { Heading_1_160x600: 'heading1_text_160x600' },
  );
  assert.equal(remapped.heading1_text_160x600, 'Studio override');
  assert.equal(remapped.Heading_1_160x600, 'Studio override');
  assert.equal(remapped.heading1_text, 'Base');
});

test('remap does not clobber an explicit canonical value', () => {
  const remapped = remapStudioRowToCanonical(
    {
      heading1_text_160x600: 'Canonical wins',
      Heading_1_160x600: 'Studio loses',
    },
    { Heading_1_160x600: 'heading1_text_160x600' },
  );
  assert.equal(remapped.heading1_text_160x600, 'Canonical wins');
});

test('validateFeedRows accepts canonical size overrides', () => {
  const [row] = validateFeedRows([{
    heading1_text: 'Base',
    heading1_text_160x600: 'Tall',
    tc_units_text: 'Units',
    tc_units_text_320x50: 'Units compact',
    tc_type_enum: 'tcs_units',
    cta_type_enum: 'roundel',
    include_heading4_enum: true,
    background_image_label: 'diy',
  }]);
  assert.equal(row.heading1_text_160x600, 'Tall');
  assert.equal(row.tc_units_text_320x50, 'Units compact');
  assert.equal(row.heading1_text_300x250, '');
  assert.equal(row.include_heading4_enum, true);
  assert.equal(row.background_image_label, 'diy');
});

test('validateFeedRows normalizes Studio br tags in multiline copy', () => {
  const [row] = validateFeedRows([{
    heading2_text_320x50: 'A different kind <br> of energy',
    tc_type_enum: 'tcs_only',
    cta_type_enum: 'roundel',
  }]);
  assert.equal(row.heading2_text_320x50, 'A different kind \n of energy');
});

test('Studio alias → canonical then validateFeedRows keeps the override', () => {
  const remapped = remapStudioRowToCanonical(
    {
      heading1_text: 'Base',
      Heading_1_300x250: 'From Studio',
      tc_type_enum: 'tcs_only',
      cta_type_enum: 'roundel',
    },
    { Heading_1_300x250: 'heading1_text_300x250' },
  );
  const [row] = validateFeedRows([remapped]);
  assert.equal(row.heading1_text_300x250, 'From Studio');
});
