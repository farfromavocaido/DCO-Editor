import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildHeadlineScrimLayer,
  gradientBackgroundImage,
  gradientMidStopPct,
  headlineScrimDefaultsForSize,
  validateGradientConfig,
} from './gradient-layer';

test('mid-stop percent is endPct × midpoint', () => {
  assert.equal(gradientMidStopPct(25, 0.5), 12.5);
  assert.equal(gradientMidStopPct(30, 0.1), 3);
  assert.equal(gradientMidStopPct(100, 0.1), 10);
});

test('default directions split portrait-ish vs landscape sizes', () => {
  assert.equal(headlineScrimDefaultsForSize('300x250').direction, 'to-bottom');
  assert.equal(headlineScrimDefaultsForSize('160x600').endPct, 25);
  assert.equal(headlineScrimDefaultsForSize('320x50').direction, 'to-right');
  assert.equal(headlineScrimDefaultsForSize('970x250').endPct, 30);
});

test('compiles a three-stop black gradient with derived mid opacity', () => {
  const css = gradientBackgroundImage({
    direction: 'to-bottom',
    endPct: 25,
    startOpacity: 0.15,
    midpoint: 0.5,
  });
  assert.equal(
    css,
    'linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.075) 12.5%, rgba(0, 0, 0, 0) 25%)',
  );

  const left = gradientBackgroundImage({
    direction: 'to-right',
    endPct: 30,
    startOpacity: 0.4,
    midpoint: 0.1,
  });
  assert.equal(
    left,
    'linear-gradient(to right, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 3%, rgba(0, 0, 0, 0) 30%)',
  );
});

test('validates gradient knobs', () => {
  assert.throws(() => validateGradientConfig(null, 'headline-scrim'), /requires a gradient/);
  assert.throws(
    () => validateGradientConfig({ direction: 'to-left', endPct: 25, startOpacity: 0.15, midpoint: 0.5 }, 'x'),
    /invalid direction/,
  );
  assert.throws(
    () => validateGradientConfig({ direction: 'to-bottom', endPct: 120, startOpacity: 0.15, midpoint: 0.5 }, 'x'),
    /endPct/,
  );
  assert.deepEqual(
    validateGradientConfig({ direction: 'to-right', endPct: 30, startOpacity: 0.15, midpoint: 0.5 }, 'x'),
    { direction: 'to-right', endPct: 30, startOpacity: 0.15, midpoint: 0.5 },
  );
});

test('builds a full-bleed scrim layer for a size', () => {
  const layer = buildHeadlineScrimLayer('300x250', { width: 300, height: 250 });
  assert.equal(layer.kind, 'gradient');
  assert.equal(layer.zIndex, 1);
  assert.equal(layer.base.visibility, 'hidden');
  assert.equal(layer.base.width, 300);
  assert.equal(layer.gradient.direction, 'to-bottom');
});
