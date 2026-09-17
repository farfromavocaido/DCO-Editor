// Campaign-specific comparisons; run with npm run test:creative.
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
  assert.equal(document.clock.loop, true);
  assert.deepEqual(Object.keys(document.sizes).sort(), [
    '160x600',
    '300x250',
    '300x600',
    '320x50',
    '728x90',
    '970x250',
  ]);
  assert.equal(document.feed.profileName, 'SSE_DCO_Offers');
  assert.equal(document.feed.studioProfileId, 10964545);
  assert.equal(document.feed.studioProfileElement, 'SSE_DCO_ROI_Delivery');
  assert.equal(document.feed.sampleRows[0].background_image_url_300x250.Url, '');
  assert.ok(document.feed.fields.some((field) => field.name === 'background_image_url_728x90' && field.type === 'image'));
  assert.ok(document.presets.some((preset) => preset.id === 'fade'));
});

test('seeds an offers-0 headline scrim gradient on every size', async () => {
  const document = await readCreativeDocument();
  for (const [size, sizeCreative] of Object.entries(document.sizes)) {
    const scrim = sizeCreative.layers.find((layer) => layer.id === 'headline-scrim');
    assert.ok(scrim, `missing scrim on ${size}`);
    assert.equal(scrim.kind, 'gradient');
    assert.equal(scrim.base.visibility, 'hidden');
    assert.ok(sizeCreative.variantRules.some((rule) => rule.id === 'offers-0|headline-scrim|visibility'));
    assert.equal(scrim.gradient.direction, 'to-top');
    assert.ok(Number(scrim.gradient.endPct) > 0);
    assert.ok(Number(scrim.gradient.startOpacity) > 0);
    const blue = sizeCreative.layers.find((layer) => layer.id === 'bluewave');
    assert.ok(blue);
    assert.ok(scrim.zIndex < blue.zIndex);
  }
});

test('uses Museo 300 for every offers-0 terms line', async () => {
  const document = await readCreativeDocument();
  assert.deepEqual(document.fonts, [
    {
      id: 'museo-700-normal',
      family: 'Museo',
      weight: 700,
      style: 'normal',
      asset: 'fonts/Museo700-Regular.otf',
      cdnUrl: 'https://s0.2mdn.net/creatives/assets/5627648/Museo700-Regular.otf',
    },
    {
      id: 'museo-300-normal',
      family: 'Museo',
      weight: 300,
      style: 'normal',
      asset: 'fonts/Museo300-Regular.otf',
      cdnUrl: 'https://s0.2mdn.net/creatives/assets/5627648/Museo300-Regular.otf',
    },
  ]);
  for (const [size, sizeCreative] of Object.entries(document.sizes)) {
    for (const layerId of ['terms-prices', 'terms-solo']) {
      const rule = sizeCreative.variantRules.find((item) => item.id === `offers-0|${layerId}|color`);
      assert.ok(rule, `${size} ${layerId}`);
      assert.equal(rule.props.fontWeight, 300, `${size} ${layerId}`);
    }
  }
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

test('checked-in creative has no offers-2/3 Offer Roundel overrides', async () => {
  const document = await readCreativeDocument();
  for (const [size, sizeCreative] of Object.entries(document.sizes)) {
    for (const rule of sizeCreative.variantRules || []) {
      const scope = String(rule.scope || '');
      if (scope !== 'offers-2' && scope !== 'offers-3') continue;
      const id = String(rule.id || '');
      assert.ok(
        !id.includes('roundel')
          && !String(rule.layerId || '').startsWith('roundel')
          && !String(rule.cssClass || '').startsWith('roundel'),
        `${size} still has linked roundel override ${id}`,
      );
    }
  }
});

test('preserves per-size layer, variant, and timeline data for 970x250', async () => {
  const document = await readCreativeDocument();
  const size = document.sizes['970x250'];

  const logo = size.layers.find((layer) => layer.id === 'logo-act3');
  assert.ok(logo);
  assert.equal(logo.kind, 'image');
  assert.equal(logo.base.left, 796);
  assert.equal(logo.clips[0].preset, 'fade');
  // White logo enters with the blue-wave sweep (full crossfade on swap sizes).
  assert.equal(logo.clips[0].start, 'wave2_in');
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
