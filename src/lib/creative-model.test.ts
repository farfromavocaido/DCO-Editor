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
  reorderCreativeLayerZ,
  updateCreativeLayerBase,
  updateCreativeLayerClip,
  updateCreativeLayerFit,
  updateCreativeLayerMetadata,
  replaceCreativeLayer,
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

test('groups creative layers without losing layer order', () => {
  const groups = groupedCreativeLayers(document.sizes['970x250'].layers);

  assert.deepEqual(groups.map((group) => group.label), ['Headlines', 'Logos']);
  assert.deepEqual(groups[1].layers.map((layer) => layer.id), ['logo-act3']);
});

test('updates layer base values immutably', () => {
  const next = updateCreativeLayerBase(document, '970x250', 'logo-act3', 'top', 160);

  assert.equal(next.sizes['970x250'].layers[1].base.top, 160);
  assert.equal(document.sizes['970x250'].layers[1].base.top, 172);
});

test('updates clip timing and params immutably', () => {
  const moved = updateCreativeLayerClip(document, '970x250', 'logo-act3', 'logo-act3-fade', {
    field: 'start',
    value: 'wave2_in+5',
  });
  const faded = updateCreativeLayerClip(moved, '970x250', 'logo-act3', 'logo-act3-fade', {
    field: 'fade_pct',
    value: 6,
    target: 'params',
  });

  assert.equal(faded.sizes['970x250'].layers[1].clips[0].start, 'wave2_in+5');
  assert.equal(faded.sizes['970x250'].layers[1].clips[0].params.fade_pct, 6);
  assert.equal(document.sizes['970x250'].layers[1].clips[0].start, 'wave2_in+7');
});

test('updates custom clip boundary keyframes when timeline edges move', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          {
            id: 'cta',
            clips: [
              {
                id: 'cta-fadeIn',
                preset: 'custom',
                start: 20,
                end: 35,
                keyframes: [
                  { at: 20, opacity: 0 },
                  { at: 35, opacity: 1 },
                ],
              },
            ],
          },
        ],
      },
    },
  };

  const moved = updateCreativeLayerClip(doc, '300x250', 'cta', 'cta-fadeIn', {
    field: 'start',
    value: 24,
  });

  assert.equal(moved.sizes['300x250'].layers[0].clips[0].start, 24);
  assert.deepEqual(moved.sizes['300x250'].layers[0].clips[0].keyframes.map((keyframe) => keyframe.at), [24, 35]);
  assert.deepEqual(doc.sizes['300x250'].layers[0].clips[0].keyframes.map((keyframe) => keyframe.at), [20, 35]);
});

test('updates layer fit settings immutably', () => {
  const next = updateCreativeLayerFit(document, '970x250', 'headline-act1', 'minFontSize', 22);

  assert.equal(next.sizes['970x250'].layers[0].fit.minFontSize, 22);
  assert.equal(document.sizes['970x250'].layers[0].fit, undefined);
});

test('replaces a layer from code while preserving identity', () => {
  const nextLayer = {
    ...document.sizes['970x250'].layers[0],
    label: 'Headline one updated',
    base: { left: 55, top: 85, cssClass: 'headline-act1' },
  };

  const next = replaceCreativeLayer(document, '970x250', 'headline-act1', nextLayer);

  assert.equal(next.sizes['970x250'].layers[0].label, 'Headline one updated');
  assert.equal(next.sizes['970x250'].layers[0].base.left, 55);
  assert.equal(document.sizes['970x250'].layers[0].base.left, 50);
  assert.throws(() => replaceCreativeLayer(document, '970x250', 'headline-act1', { ...nextLayer, id: 'other' }), /must keep the same id/);
});

test('updates layer library metadata immutably', () => {
  const renamed = updateCreativeLayerMetadata(document, '970x250', 'headline-act1', 'label', 'Hero headline');
  const regrouped = updateCreativeLayerMetadata(renamed, '970x250', 'headline-act1', 'group', 'Reusable headlines');

  assert.equal(regrouped.sizes['970x250'].layers[0].label, 'Hero headline');
  assert.equal(regrouped.sizes['970x250'].layers[0].group, 'Reusable headlines');
  assert.equal(document.sizes['970x250'].layers[0].label, undefined);
  assert.throws(() => updateCreativeLayerMetadata(document, '970x250', 'headline-act1', 'id', 'bad'), /Unsupported/);
});

test('duplicates a layer with a unique id and raised z-index', () => {
  const next = duplicateCreativeLayer(document, '970x250', 'headline-act1');
  const layers = next.sizes['970x250'].layers;
  const copy = layers.find((layer) => layer.id === 'headline-act1-copy');

  assert.equal(layers.length, 3);
  assert.equal(copy.label, 'Headline Act1 copy');
  assert.equal(copy.base.left, 62);
  assert.equal(copy.base.top, 97);
  assert.equal(copy.zIndex, 2);
  assert.equal(document.sizes['970x250'].layers.length, 2);
});

test('deletes a layer and clears layer-specific variant rules', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'offer-slot-1', kind: 'group', base: { cssClass: 'offer-slot-1' }, clips: [] },
          { id: 'plus-1', kind: 'text', base: { cssClass: 'plus-1' }, clips: [] },
        ],
        variantRules: [
          { id: 'offers-2|plus-1', layerId: 'plus-1', cssClass: 'plus-1', props: { left: 10 } },
          { id: 'offers-2|offer-value', cssClass: 'offer-value', props: { fontSize: 20 } },
        ],
      },
    },
  };

  const next = deleteCreativeLayer(doc, '300x250', 'plus-1');

  assert.deepEqual(next.sizes['300x250'].layers.map((layer) => layer.id), ['offer-slot-1']);
  assert.deepEqual(next.sizes['300x250'].variantRules.map((rule) => rule.id), ['offers-2|offer-value']);
});

test('adds a named rectangle shape layer', () => {
  const next = addCreativeShapeLayer(document, '970x250', 'rectangle');
  const shape = next.sizes['970x250'].layers.at(-1);

  assert.equal(shape.id, 'rectangle-1');
  assert.equal(shape.label, 'Rectangle 1');
  assert.equal(shape.kind, 'shape');
  assert.equal(shape.base.width, 120);
  assert.equal(shape.base.backgroundColor, 'rgba(0, 229, 165, 0.2)');
});

test('reorders layer z-index values', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'a', zIndex: 0, base: {}, clips: [] },
          { id: 'b', zIndex: 1, base: {}, clips: [] },
          { id: 'c', zIndex: 2, base: {}, clips: [] },
        ],
      },
    },
  };

  const next = reorderCreativeLayerZ(doc, '300x250', 'b', 1);

  assert.deepEqual(next.sizes['300x250'].layers.map((layer) => [layer.id, layer.zIndex]), [
    ['a', 0],
    ['b', 2],
    ['c', 1],
  ]);
});

test('moves a layer to an absolute z-order slot', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          { id: 'a', zIndex: 0, base: {}, clips: [] },
          { id: 'b', zIndex: 1, base: {}, clips: [] },
          { id: 'c', zIndex: 2, base: {}, clips: [] },
          { id: 'd', zIndex: 3, base: {}, clips: [] },
        ],
      },
    },
  };

  const next = moveCreativeLayerToZIndex(doc, '300x250', 'd', 1);

  const sorted = [...next.sizes['300x250'].layers].sort((a, b) => a.zIndex - b.zIndex);
  assert.deepEqual(sorted.map((layer) => layer.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(sorted.map((layer) => layer.zIndex), [0, 1, 2, 3]);
  assert.deepEqual(doc.sizes['300x250'].layers.map((layer) => [layer.id, layer.zIndex]), [
    ['a', 0],
    ['b', 1],
    ['c', 2],
    ['d', 3],
  ]);
});

const nestedDocument = {
  version: 1,
  sizes: {
    '300x600': {
      layers: [
        {
          id: 'offer-slot-1',
          label: 'Offer Slot 1',
          group: 'Offers',
          kind: 'group',
          base: { left: 20, top: 160, width: 260, height: 180, cssClass: 'offer-slot-1' },
          clips: [],
        },
      ],
      classRules: [
        {
          cssClass: 'offer-value',
          properties: { left: 0, top: 0, fontSize: 130 },
        },
        {
          cssClass: 'offer-subline',
          properties: { left: 0, top: 114, fontSize: 26 },
        },
      ],
      variantRules: [
        {
          id: 'offers-3|offer-slot-1',
          scope: 'offers-3',
          layerId: 'offer-slot-1',
          cssClass: 'offer-slot-1',
          props: { left: 26, top: 180, width: 110 },
          editable: true,
        },
        {
          id: 'offers-3|offer-subline',
          scope: 'offers-3',
          layerId: 'offer-subline',
          cssClass: 'offer-subline',
          props: { top: 56, fontSize: 15 },
          editable: true,
        },
      ],
    },
  },
};

test('exposes offer slot internals as nested editable targets', () => {
  const layer = nestedDocument.sizes['300x600'].layers[0];
  const targets = editableTargetsForLayer(layer);

  assert.deepEqual(targets.map((target) => target.id), [
    'offer-slot-1::offer-value',
    'offer-slot-1::offer-subline',
  ]);
  assert.equal(targets[1].coordinateScope, 'group');
});

test('resolves active variant values for nested offer targets', () => {
  const target = findCreativeTarget(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    ['offers-3'],
  );

  assert.equal(target.parentLayerId, 'offer-slot-1');
  assert.equal(target.values.left, 0);
  assert.equal(target.values.top, 56);
  assert.equal(target.values.fontSize, 15);
  assert.equal(target.writeSource.kind, 'variantRule');
  assert.equal(target.coordinateScope, 'group');
});

test('updates nested offer target variants without changing the base class rule', () => {
  const next = updateCreativeTargetValue(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    ['offers-3'],
    'top',
    52,
  );

  assert.equal(next.sizes['300x600'].variantRules[1].props.top, 52);
  assert.equal(next.sizes['300x600'].classRules[1].properties.top, 114);
});

test('updates layer position in the active variant when one is being previewed', () => {
  const next = updateCreativeTargetValue(
    nestedDocument,
    '300x600',
    'offer-slot-1',
    ['offers-3'],
    'top',
    188,
  );

  assert.equal(next.sizes['300x600'].variantRules[0].props.top, 188);
  assert.equal(next.sizes['300x600'].layers[0].base.top, 160);
});

test('resolves and writes non-editable variant rules for canvas editing', () => {
  const doc = {
    version: 1,
    sizes: {
      '160x600': {
        layers: [
          {
            id: 'offer-slot-1',
            kind: 'group',
            base: { left: -4, top: 202, width: 161, height: 207, cssClass: 'offer-slot-1' },
            clips: [],
          },
        ],
        variantRules: [
          {
            id: 'offers-3|offer-slot-1',
            scope: 'offers-3',
            layerId: 'offer-slot-1',
            cssClass: 'offer-slot-1',
            props: { left: 10, top: 330, width: 140 },
            editable: false,
          },
        ],
      },
    },
  };

  const target = findCreativeTarget(doc, '160x600', 'offer-slot-1', ['offers-3']);
  assert.equal(target.values.top, 330);
  assert.equal(target.writeSource.kind, 'variantRule');

  const next = updateCreativeTargetValue(doc, '160x600', 'offer-slot-1', ['offers-3'], 'top', 340);
  assert.equal(next.sizes['160x600'].variantRules[0].props.top, 340);
  assert.equal(next.sizes['160x600'].layers[0].base.top, 202);
});

test('updates nested offer base class when no matching variant is active', () => {
  const next = updateCreativeTargetValue(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    ['offers-1'],
    'top',
    108,
  );

  assert.equal(next.sizes['300x600'].classRules[1].properties.top, 108);
  assert.equal(next.sizes['300x600'].variantRules[1].props.top, 56);
});

test('can write directly to a shared nested class while a variant is active', () => {
  const next = updateCreativeTargetSharedValue(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    'fontSize',
    28,
  );

  assert.equal(next.sizes['300x600'].classRules[1].properties.fontSize, 28);
  assert.equal(next.sizes['300x600'].variantRules[1].props.fontSize, 15);
});

test('clears active target override fields without deleting unrelated override props', () => {
  const next = clearCreativeTargetActiveOverride(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    ['offers-3'],
    ['top'],
  );

  const rule = next.sizes['300x600'].variantRules.find((item) => item.id === 'offers-3|offer-subline');
  assert.equal(rule.props.top, undefined);
  assert.equal(rule.props.fontSize, 15);
});

test('promotes current override values to the shared reusable style', () => {
  const next = promoteCreativeTargetToSharedStyle(
    nestedDocument,
    '300x600',
    'offer-slot-1::offer-subline',
    ['offers-3'],
    ['top', 'fontSize'],
  );

  const classRule = next.sizes['300x600'].classRules.find((rule) => rule.cssClass === 'offer-subline');
  const variantRule = next.sizes['300x600'].variantRules.find((rule) => rule.id === 'offers-3|offer-subline');
  assert.equal(classRule.properties.top, 56);
  assert.equal(classRule.properties.fontSize, 15);
  assert.equal(variantRule, undefined);
});

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

test('merges active variant rules in active scope order and writes to the highest priority rule', () => {
  const doc = {
    version: 1,
    sizes: {
      '300x250': {
        layers: [
          {
            id: 'headline-act3',
            label: 'Headline',
            kind: 'text',
            base: { cssClass: 'sse-headline' },
            clips: [],
          },
        ],
        classRules: [
          {
            cssClass: 'sse-headline',
            properties: { left: 17, top: 26, width: 200, fontSize: 16, height: 30 },
          },
        ],
        variantRules: [
          {
            id: 'offers-2|sse-headline',
            scope: 'offers-2',
            cssClass: 'sse-headline',
            props: { left: 10, width: 280 },
            editable: true,
          },
          {
            id: 'frames-4|sse-headline',
            scope: 'frames-4',
            cssClass: 'sse-headline',
            props: { top: 18, width: 190 },
            editable: true,
          },
        ],
      },
    },
  };

  const target = findCreativeTarget(doc, '300x250', 'headline-act3', ['offers-2', 'frames-4']);

  assert.equal(target.values.left, 10);
  assert.equal(target.values.top, 18);
  assert.equal(target.values.width, 190);
  assert.equal(target.writeSource.ruleId, 'frames-4|sse-headline');

  const next = updateCreativeTargetValue(doc, '300x250', 'headline-act3', ['offers-2', 'frames-4'], 'top', 22);
  assert.equal(next.sizes['300x250'].variantRules[0].props.top, undefined);
  assert.equal(next.sizes['300x250'].variantRules[1].props.top, 22);
});

test('keeps the optional roundel frame as a simple editable circle layer', () => {
  const layer = {
    id: 'roundel-frame',
    kind: 'shape',
    base: { left: 40, top: 70, width: 118, height: 118, cssClass: 'roundel-frame' },
    clips: [],
  };

  const targets = editableTargetsForLayer(layer);

  assert.deepEqual(targets, []);
});

test('places the MPU optional roundel frame above the waves and below the CTA', () => {
  const doc = loadPersistedCreative();
  const layers = doc.sizes['300x250'].layers;
  const byId = Object.fromEntries(layers.map((layer) => [layer.id, layer]));

  assert.ok(byId['roundel-frame'].zIndex > byId.greenwave.zIndex);
  assert.ok(byId['roundel-frame'].zIndex > byId.bluewave.zIndex);
  assert.ok(byId['roundel-frame'].zIndex < byId.cta.zIndex);
});
