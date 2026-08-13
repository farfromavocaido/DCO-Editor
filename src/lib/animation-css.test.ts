import { test } from 'vitest';
import assert from 'node:assert/strict';

import { clockLoops, layerAnimationShorthand } from './animation-css';

test('clockLoops is true only for an explicit boolean true', () => {
  assert.equal(clockLoops({ loop: true }), true);
  assert.equal(clockLoops({ loop: false }), false);
  assert.equal(clockLoops({}), false);
  assert.equal(clockLoops(null), false);
  assert.equal(clockLoops({ loop: 'true' }), false);
});

test('layerAnimationShorthand plays once by default and loops when asked', () => {
  assert.equal(
    layerAnimationShorthand(15, 'cta-cta-popPulse'),
    '15s linear 0s 1 normal forwards running cta-cta-popPulse',
  );
  assert.equal(
    layerAnimationShorthand(15, 'cta-cta-popPulse', { loop: true }),
    '15s linear 0s infinite normal forwards running cta-cta-popPulse',
  );
  assert.equal(
    layerAnimationShorthand(15, 'h1-skip', { loop: true, important: true }),
    '15s linear 0s infinite normal forwards running h1-skip !important',
  );
});
