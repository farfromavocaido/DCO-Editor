// Campaign-specific comparisons; run with npm run test:creative.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  addCreativeShapeLayer,
  clearCreativeTargetActiveOverride,
  copyCreativeHeadlineOfferLayout,
  deleteCreativeLayer,
  duplicateCreativeLayer,
  editableTargetsForLayer,
  findCreativeTarget,
  groupedCreativeLayers,
  promoteCreativeTargetToSharedStyle,
  resetCreativeHeadlineOfferLayout,
  resolveHeadlineLayoutValues,
  headlineOfferLayoutStatus,
  moveCreativeLayerToZIndex,
  normalizeOffers0CtaRules,
  normalizeOffers0RoundelRules,
  reorderCreativeLayerZ,
  updateCreativeLayerBase,
  updateCreativeLayerClip,
  updateCreativeLayerFit,
  updateCreativeLayerMetadata,
  replaceCreativeLayer,
  updateCreativeTargetFit,
  updateCreativeTargetSharedValue,
  updateCreativeTargetValue,
} from './creative-model';

const loadPersistedCreative = () => JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), 'campaign/sse-dco-creative.json'),
  'utf8',
));

const document = {
  version: 1,
  sizes: {
    '970x250': {
      layers: [
        {
          id: 'headline-act1',
          group: 'Headlines',
          base: { left: 50, top: 85, cssClass: 'headline-act1' },
          clips: [],
        },
        {
          id: 'logo-act3',
          group: 'Logos',
          base: { left: 796, top: 172, cssClass: 'logo-act3' },
          clips: [
            {
              id: 'logo-act3-fade',
              preset: 'fade',
              start: 'wave2_in+7',
              end: 'end',
              params: { fade_pct: 4 },
            },
          ],
        },
      ],
    },
  },
};

test('resolves and writes 300x250 headline offer-count variants', () => {
  const doc = loadPersistedCreative();
  const target = findCreativeTarget(
    doc,
    '300x250',
    'headline-act1',
    ['offers-2', 'tc-solo', 'cta-round'],
  );

  assert.equal(target.values.left, 10);
  assert.equal(target.values.width, 280);
  assert.equal(target.writeSource.kind, 'variantRule');
  assert.equal(target.writeSource.ruleId, 'offers-2|sse-headline');

  const next = updateCreativeTargetValue(
    doc,
    '300x250',
    'headline-act1',
    ['offers-2', 'tc-solo', 'cta-round'],
    'left',
    42,
  );
  const variant = next.sizes['300x250'].variantRules.find((rule) => rule.id === 'offers-2|sse-headline');
  const shared = next.sizes['300x250'].classRules.find((rule) => rule.cssClass === 'sse-headline');

  assert.equal(variant.props.left, 42);
  assert.equal(shared.properties.left, 17);
});

test('banner offers-0 Act 3 geometry writes separately from shared H1/H2', () => {
  const doc = loadPersistedCreative();
  const scopes = ['offers-0', 'white-headlines', 'frames-4', 'tc-solo', 'cta-rect'];

  const act1 = findCreativeTarget(doc, '320x50', 'headline-act1', scopes);
  const act3 = findCreativeTarget(doc, '320x50', 'headline-act3', scopes);
  // Ink scopes are colour-only — geometry writes go to offers-0 hosts.
  assert.equal(act1.writeSource.ruleId, 'offers-0|sse-headline');
  assert.equal(act3.writeSource.ruleId, 'offers-0|headline-act3');

  const afterH1 = updateCreativeTargetValue(doc, '320x50', 'headline-act1', scopes, 'width', 111);
  assert.equal(
    afterH1.sizes['320x50'].variantRules.find((rule) => rule.id === 'offers-0|sse-headline').props.width,
    111,
  );
  assert.notEqual(
    afterH1.sizes['320x50'].variantRules.find((rule) => rule.id === 'offers-0|headline-act3').props.width,
    111,
  );
  assert.deepEqual(
    afterH1.sizes['320x50'].variantRules.find((rule) => rule.id === 'white-headlines|sse-headline').props,
    { color: 'rgb(0, 41, 117)' },
  );

  const afterH3 = updateCreativeTargetValue(doc, '320x50', 'headline-act3', scopes, 'width', 77);
  assert.equal(
    afterH3.sizes['320x50'].variantRules.find((rule) => rule.id === 'offers-0|headline-act3').props.width,
    77,
  );
  assert.notEqual(
    afterH3.sizes['320x50'].variantRules.find((rule) => rule.id === 'offers-0|sse-headline').props.width,
    77,
  );
});

test('offers-0 ink scopes are colour-only; white/navy share offers-0 geometry', () => {
  const doc = loadPersistedCreative();
  for (const [size, sizeCreative] of Object.entries(doc.sizes)) {
    for (const id of [
      'white-headlines|sse-headline',
      'navy-headlines|sse-headline',
      'white-headlines|headline-act3',
      'navy-headlines|headline-act3',
    ]) {
      const rule = sizeCreative.variantRules?.find((item) => item.id === id);
      if (!rule) continue;
      assert.deepEqual(
        Object.keys(rule.props || {}).sort(),
        ['color'],
        `${size} ${id} must be colour-only`,
      );
    }
    const white = findCreativeTarget(doc, size, 'headline-act1', ['offers-0', 'white-headlines']);
    const navy = findCreativeTarget(doc, size, 'headline-act1', ['offers-0', 'navy-headlines']);
    assert.ok(white && navy, size);
    for (const key of ['left', 'top', 'width', 'height', 'fontSize']) {
      if (white.values[key] === undefined && navy.values[key] === undefined) continue;
      assert.equal(white.values[key], navy.values[key], `${size} ${key} must match across ink`);
    }
    assert.equal(
      white.values.color,
      size === '320x50' ? 'rgb(0, 41, 117)' : 'rgb(255, 255, 255)',
      `${size} ${size === '320x50' ? 'offers-0 ink is navy on green' : 'white ink'}`,
    );
    assert.equal(navy.values.color, 'rgb(0, 41, 117)', `${size} navy ink`);
  }
});

test('every size exposes offers-2 and offers-3 headline variant rules', () => {
  const doc = loadPersistedCreative();

  for (const [size, sizeCreative] of Object.entries(doc.sizes)) {
    const headlines = (sizeCreative.layers || []).filter((layer) => String(layer.id || '').startsWith('headline-act'));
    if (!headlines.length) continue;

    for (const scope of ['offers-2', 'offers-3']) {
      const rule = (sizeCreative.variantRules || []).find((item) => item.id === `${scope}|sse-headline`);
      assert.ok(rule, `${size} missing ${scope}|sse-headline`);
      assert.equal(rule.cssClass, 'sse-headline');
      assert.ok(rule.props?.width, `${size} ${scope} headline variant missing width`);
    }

    const single = findCreativeTarget(doc, size, 'headline-act1', ['offers-1']);
    const dual = findCreativeTarget(doc, size, 'headline-act1', ['offers-2']);
    const triple = findCreativeTarget(doc, size, 'headline-act1', ['offers-3']);
    assert.equal(single.writeSource.kind, 'classRule');
    assert.equal(dual.writeSource.kind, 'variantRule');
    assert.equal(triple.writeSource.kind, 'variantRule');
  }
});

test('copies headline layout between offer counts and can reset to baseline', () => {
  const doc = loadPersistedCreative();
  const copied = copyCreativeHeadlineOfferLayout(doc, '300x250', 2, 3);
  const triple = resolveHeadlineLayoutValues(copied, '300x250', 3);
  const dual = resolveHeadlineLayoutValues(copied, '300x250', 2);

  assert.deepEqual(triple, dual);
  assert.equal(
    headlineOfferLayoutStatus(copied, '300x250').find((item) => item.offerCount === 3)?.tone,
    'linked',
  );

  const reset = resetCreativeHeadlineOfferLayout(copied, '300x250', 3);
  assert.deepEqual(
    resolveHeadlineLayoutValues(reset, '300x250', 3),
    resolveHeadlineLayoutValues(reset, '300x250', 1),
  );
});

test('offers-0 roundel writes stay off the shared offers 1–3 rules', () => {
  const doc = loadPersistedCreative();
  normalizeOffers0RoundelRules(doc);

  for (const size of Object.keys(doc.sizes)) {
    const splitScopes = ['offers-0', 'roundel-split', 'roundel-frame-on'];
    const copyTarget = findCreativeTarget(doc, size, 'roundel-copy', splitScopes);
    const frameTarget = findCreativeTarget(doc, size, 'roundel-frame', splitScopes);
    assert.equal(copyTarget.writeSource.ruleId, 'offers-0.roundel-split|roundel-copy', `${size} copy write`);
    assert.equal(frameTarget.writeSource.ruleId, 'offers-0|roundel-frame', `${size} frame write`);
  }

  const splitScopes = ['offers-0', 'roundel-split'];
  const sharedLeft = doc.sizes['300x250'].variantRules.find((rule) => rule.id === 'roundel-split|roundel-copy').props.left;
  const ownedLeft = doc.sizes['300x250'].variantRules.find((rule) => rule.id === 'offers-0.roundel-split|roundel-copy').props.left;
  const moved = updateCreativeTargetValue(doc, '300x250', 'roundel-copy', splitScopes, 'left', 999);
  assert.equal(
    moved.sizes['300x250'].variantRules.find((rule) => rule.id === 'roundel-split|roundel-copy').props.left,
    sharedLeft,
  );
  assert.equal(
    moved.sizes['300x250'].variantRules.find((rule) => rule.id === 'offers-0.roundel-split|roundel-copy').props.left,
    999,
  );

  const multi = updateCreativeTargetValue(doc, '300x250', 'roundel-copy', ['offers-1', 'roundel-split'], 'left', 1);
  assert.equal(
    multi.sizes['300x250'].variantRules.find((rule) => rule.id === 'offers-0.roundel-split|roundel-copy').props.left,
    ownedLeft,
  );
  assert.equal(
    multi.sizes['300x250'].variantRules.find((rule) => rule.id === 'roundel-split|roundel-copy').props.left,
    1,
  );
});

test('places the MPU optional roundel frame above the waves and below the CTA', () => {
  const doc = loadPersistedCreative();
  const layers = doc.sizes['300x250'].layers;
  const byId = Object.fromEntries(layers.map((layer) => [layer.id, layer]));

  assert.ok(byId['roundel-frame'].zIndex > byId.greenwave.zIndex);
  assert.ok(byId['roundel-frame'].zIndex > byId.bluewave.zIndex);
  assert.ok(byId['roundel-frame'].zIndex < byId.cta.zIndex);
});

test('background layer reads and writes the shared bg-image classRule', () => {
  const doc = loadPersistedCreative();
  const target = findCreativeTarget(doc, '320x50', 'bg-image', []);
  assert.equal(target.cssClass, 'bg-image');
  assert.equal(target.writeSource.kind, 'classRule');
  assert.ok(Number(target.values.width) > 0);

  const next = updateCreativeTargetValue(doc, '320x50', 'bg-image', [], 'top', -12);
  const rule = next.sizes['320x50'].classRules.find((item) => item.cssClass === 'bg-image');
  assert.equal(rule.properties.top, -12);

  assert.throws(() => deleteCreativeLayer(doc, '320x50', 'bg-image'), /cannot be deleted/);
});
