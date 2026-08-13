import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  readCreativeDocument,
  validateCreativeDocument,
} from '../creative-document';

test('rejects unregistered campaign ids', () => {
  assert.throws(
    () => validateCreativeDocument({
      version: 1,
      campaign: { id: 'not-a-campaign', name: 'Nope' },
      clock: { durationS: 15, beats: {} },
      feed: { profileName: 'x', sampleRows: [] },
      sizes: {
        '300x250': {
          canvas: { width: 300, height: 250 },
          layers: [{ id: 'a', kind: 'text', base: {}, clips: [] }],
        },
      },
    }),
    /registered campaign/,
  );
});

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
    if (['300x250', '160x600', '300x600'].includes(size)) {
      assert.equal(scrim.gradient.direction, 'to-bottom');
    } else {
      assert.equal(scrim.gradient.direction, 'to-right');
    }
    assert.ok(Number(scrim.gradient.endPct) > 0);
    assert.ok(Number(scrim.gradient.startOpacity) > 0);
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

test('strips offers-2/3 roundel overrides so Offer Roundel stays linked to 1-offer', async () => {
  const document = validateCreativeDocument({
    version: 1,
    campaign: { id: 'sse-dco', name: 'SSE DCO' },
    clock: { durationS: 15, beats: { start: 0, end: 100 } },
    feed: { profileName: 'SSE_DCO_Offers', sampleRows: [{}] },
    sizes: {
      '728x90': {
        canvas: { width: 728, height: 90 },
        layers: [
          {
            id: 'roundel-frame',
            kind: 'shape',
            base: { left: 300, top: -16, width: 130, height: 130, cssClass: 'roundel-frame' },
            clips: [],
          },
          {
            id: 'bg-image',
            kind: 'image',
            base: { left: 0, top: 0, width: 728, height: 90, cssClass: 'bg-image' },
            clips: [],
          },
        ],
        variantRules: [
          {
            id: 'roundel-split|roundel-copy',
            scope: 'roundel-split',
            layerId: 'roundel-copy',
            cssClass: 'roundel-copy',
            props: { left: 310, top: 9 },
            editable: true,
          },
          {
            id: 'offers-2|roundel-frame',
            scope: 'offers-2',
            layerId: 'roundel-frame',
            cssClass: 'roundel-frame',
            when: { offer_count_num: 2 },
            props: { left: 312, top: -4, width: 101, height: 100 },
            editable: true,
          },
          {
            id: 'offers-3|roundel-copy',
            scope: 'offers-3',
            layerId: 'roundel-copy',
            cssClass: 'roundel-copy',
            when: { offer_count_num: 3 },
            props: { left: 326, top: 24 },
            editable: true,
          },
          {
            id: 'offers-2|offer-slot-1',
            scope: 'offers-2',
            layerId: 'offer-slot-1',
            when: { offer_count_num: 2 },
            props: { left: 10 },
            editable: true,
          },
          {
            id: 'offers-0|roundel-frame',
            scope: 'offers-0',
            layerId: 'roundel-frame',
            cssClass: 'roundel-frame',
            when: { offer_count_num: 0 },
            props: { backgroundColor: 'rgb(0, 229, 165)' },
            editable: true,
          },
        ],
      },
    },
  });

  const ids = document.sizes['728x90'].variantRules.map((rule) => rule.id);
  assert.deepEqual(ids, [
    'roundel-split|roundel-copy',
    'offers-2|offer-slot-1',
    'offers-0|roundel-frame',
  ]);
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
