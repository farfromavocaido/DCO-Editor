import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  CDN_FONT_URLS,
  MUSEO_CDN_URL,
  MUSEO_FONT_FILENAME,
  museoFontFaceCss,
} from '@/lib/brand-font';

test('CDN map points Museo family file at the Studio slab OTF only', () => {
  assert.equal(CDN_FONT_URLS[MUSEO_FONT_FILENAME], MUSEO_CDN_URL);
  assert.match(MUSEO_CDN_URL, /Museo700-Regular\.otf$/);
  assert.doesNotMatch(MUSEO_CDN_URL, /MuseoSans/i);
});

test('font-face CSS blocks local installs and covers the weight range', () => {
  const css = museoFontFaceCss();
  assert.match(css, /font-family: "Museo"/);
  assert.match(css, /local\("☺"\)/);
  assert.match(css, new RegExp(MUSEO_CDN_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(css, /font-weight: 100 900/);
  assert.doesNotMatch(css, /MuseoSans/i);
});
