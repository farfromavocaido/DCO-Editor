import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  readCreativeDocument,
  validateCreativeDocument,
} from '../creative-document';

test('loads the checked-in SSE DCO creative document', async () => {
  const document = await readCreativeDocument();

  validateCreativeDocument(document);

  assert.equal(document.version, 1);
  assert.equal(document.campaign.id, 'sse-dco');
  assert.deepEqual(Object.keys(document.sizes).sort(), [
    '160x600',
    '300x250',
    '300x600',
    '320x50',
    '728x90',
    '970x250',
  ]);
  assert.equal(document.feed.profileName, 'SSE_DCO_Offers');
  assert.equal(document.feed.studioProfileId, 10960467);
  assert.equal(document.feed.studioProfileElement, 'SSE_ROI_Delivery');
  assert.equal(document.feed.sampleRows[0].background_image_url_300x250.Url, '');
  assert.ok(document.feed.fields.some((field) => field.name === 'background_image_url_728x90' && field.type === 'image'));
  assert.ok(document.presets.some((preset) => preset.id === 'fade'));
});

test('preserves 728x90 banner assets and partial bluewave treatment', async () => {
  const document = await readCreativeDocument();
  const size = document.sizes['728x90'];

  assert.ok(size);
  assert.equal(size.canvas.width, 728);
  assert.equal(size.canvas.height, 90);
  assert.equal(size.assets.background, 'assets/bg_728x90.jpg');
  assert.equal(size.assets.bluewave, 'assets/SVG/bluewave.svg');

  const bluewave = size.layers.find((layer) => layer.id === 'bluewave');
  assert.ok(bluewave);
  assert.equal(bluewave.asset, 'assets/SVG/bluewave-wider.svg');
  assert.ok(bluewave.base.width > size.canvas.width / 2);

  const headline = size.classRules.find((rule) => rule.cssClass === 'sse-headline')?.properties;
  assert.ok(headline);
  assert.ok(headline.width <= 230);
  assert.ok(headline.height >= 48);
});

test('preserves per-size layer, variant, and timeline data for 970x250', async () => {
  const document = await readCreativeDocument();
  const size = document.sizes['970x250'];

  const logo = size.layers.find((layer) => layer.id === 'logo-act3');
  assert.ok(logo);
  assert.equal(logo.kind, 'image');
  assert.equal(logo.base.left, 796);
  assert.equal(logo.clips[0].preset, 'fade');
  assert.equal(logo.clips[0].start, 'wave2_in+7');
  assert.equal(logo.clips[0].end, 'end');

  assert.ok(size.variantRules.some((rule) => (
    rule.when.offer_count_num === 3
    && rule.layerId === 'offer-slot-3'
  )));
  assert.ok(size.variantRules.some((rule) => (
    rule.when.cta_type_enum === 'rectangle'
    && rule.layerId === 'cta'
    && rule.props.width === 220
  )));
});
