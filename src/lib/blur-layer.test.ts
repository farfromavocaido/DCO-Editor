import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  blurBackdropFilter,
  blurIsActive,
  buildBgBlurClips,
  buildBgBlurLayer,
  validateBlurConfig,
} from './blur-layer';
import { clipsForProfile } from './headline-motion';

test('validates blur knobs', () => {
  assert.throws(() => validateBlurConfig(null, 'bg-blur'), /requires a blur/);
  assert.throws(
    () => validateBlurConfig({ enabled: true, strength: 99 }, 'bg-blur'),
    /strength/,
  );
  assert.deepEqual(
    validateBlurConfig({ enabled: false, strength: 8 }, 'bg-blur'),
    { enabled: false, strength: 8 },
  );
});

test('strength maps to backdrop-filter and respects enabled', () => {
  assert.equal(blurBackdropFilter({ enabled: true, strength: 8 }), 'blur(8px)');
  assert.equal(blurBackdropFilter({ enabled: false, strength: 8 }), 'none');
  assert.equal(blurIsActive({ enabled: true, strength: 0 }), false);
  assert.equal(blurIsActive({ enabled: true, strength: 8 }), true);
});

test('builds profile-specific fade clips for roundel vs CTA entry', () => {
  const clips = buildBgBlurClips('cta_in');
  const frames4 = clipsForProfile(clips, 'frames-4');
  const frames3 = clipsForProfile(clips, 'frames-3');
  assert.equal(frames4.length, 1);
  assert.equal(frames4[0].start, 'roundel_in');
  assert.equal(frames4[0].end, 'end');
  assert.equal(frames3.length, 1);
  assert.equal(frames3[0].start, 'cta_in');
  assert.equal(frames3[0].end, 'end');
});

test('320x50 uses bn_cta_in for the frames-3 blur enter', () => {
  const layer = buildBgBlurLayer({ width: 320, height: 50 }, { ctaStartBeat: 'bn_cta_in' });
  assert.equal(layer.kind, 'blur');
  assert.equal(clipsForProfile(layer.clips, 'frames-3')[0].start, 'bn_cta_in');
});
