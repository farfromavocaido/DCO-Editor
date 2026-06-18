import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  addAnimationIntentToLayer,
  animationFamilyForLayer,
  copyClipToAnimationFamily,
  createAnimationIntentClip,
  timelineSpanForClip,
} from './animation-intents';

test('creates a fade-out intent clip ending at the current timeline point', () => {
  const clip = createAnimationIntentClip({
    layerId: 'logo-act3',
    layerLabel: 'Logo Act3',
    intentId: 'fadeOut',
    anchorPct: 50,
    durationS: 15,
  });

  assert.equal(clip.preset, 'custom');
  assert.equal(clip.intentId, 'fadeOut');
  assert.equal(clip.start, 46.667);
  assert.equal(clip.end, 50);
  assert.deepEqual(clip.keyframes, [
    { at: 46.667, opacity: 1, easing: 'ease-out' },
    { at: 50, opacity: 0 },
  ]);
});

test('creates a slide-in intent clip starting at the current timeline point', () => {
  const clip = createAnimationIntentClip({
    layerId: 'headline-act1',
    layerLabel: 'Headline Act1',
    intentId: 'slideInRight',
    anchorPct: 20,
    durationS: 15,
  });

  assert.equal(clip.intentId, 'slideInRight');
  assert.equal(clip.start, 20);
  assert.equal(clip.end, 23.333);
  assert.deepEqual(clip.keyframes, [
    { at: 20, translate: [60, 0], opacity: 0, easing: 'ease-out' },
    { at: 23.333, translate: [0, 0], opacity: 1 },
  ]);
});

test('infers timeline span from custom intent keyframes', () => {
  const clip = createAnimationIntentClip({
    layerId: 'cta',
    layerLabel: 'CTA',
    intentId: 'fadeIn',
    anchorPct: 12,
    durationS: 15,
  });

  const span = timelineSpanForClip(clip, {});

  assert.deepEqual(span, {
    start: 12,
    end: 15.333,
    duration: 3.333,
    intentId: 'fadeIn',
    label: 'Fade in',
    linked: true,
  });
});

test('classifies layers into shared animation families', () => {
  assert.deepEqual(animationFamilyForLayer({ id: 'headline-act2', group: 'Headlines' }), {
    id: 'headlines',
    label: 'Headlines',
  });
  assert.deepEqual(animationFamilyForLayer({ id: 'offer-slot-3', group: 'Offers' }), {
    id: 'offer-slots',
    label: 'Offer slots',
  });
  assert.deepEqual(animationFamilyForLayer({ id: 'logo-act3', group: 'Logos' }), {
    id: 'logos',
    label: 'Logos',
  });
});

const document = {
  version: 1,
  clock: { durationS: 15 },
  sizes: {
    '970x250': {
      layers: [
        { id: 'headline-act1', label: 'Headline Act1', group: 'Headlines', clips: [] },
        { id: 'headline-act2', label: 'Headline Act2', group: 'Headlines', clips: [] },
        { id: 'logo-act3', label: 'Logo Act3', group: 'Logos', clips: [] },
      ],
    },
  },
};

test('adds an intent clip to one layer immutably', () => {
  const { document: next, clip } = addAnimationIntentToLayer(
    document,
    '970x250',
    'logo-act3',
    'fadeIn',
    30,
  );

  assert.equal(clip.intentId, 'fadeIn');
  assert.equal(next.sizes['970x250'].layers[2].clips.length, 1);
  assert.equal(document.sizes['970x250'].layers[2].clips.length, 0);
});

test('copies a selected clip to matching animation-family layers', () => {
  const { document: withClip, clip } = addAnimationIntentToLayer(
    document,
    '970x250',
    'headline-act1',
    'slideInRight',
    12,
  );
  const next = copyClipToAnimationFamily(withClip, '970x250', 'headline-act1', clip.id);

  const headline2Clip = next.sizes['970x250'].layers[1].clips[0];
  assert.equal(headline2Clip.intentId, 'slideInRight');
  assert.equal(headline2Clip.id, 'headline-act2-slideInRight-12-15_333');
  assert.equal(next.sizes['970x250'].layers[2].clips.length, 0);
});
