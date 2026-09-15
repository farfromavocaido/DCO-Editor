// @ts-nocheck

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'vitest';

import { compileAnimationClips, frameAtPercent, resolveTimeRef } from '@/lib/creative-compiler';
import { clipsForProfile } from '@/lib/headline-motion';
import { beatsForScopes } from '@/lib/timing-profiles';
import { selectorForVariantRule } from '@/lib/creative-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const creative = JSON.parse(
  readFileSync(path.join(root, 'campaign/sse-dco-creative.json'), 'utf8'),
);

const MULTI = ['offers-1', 'offers-2', 'offers-3'];
const NAVY = 'rgb(0, 41, 117)';

/** Exact offers-0 bluewave stage2 from last committed settle (box + translate). */
const BLUE_STAGE2_EXACT = {
  '320x50': { left: -80, top: -20, width: 584, height: 90, tx: 0, ty: 0 },
  '728x90': { left: 455, top: -99, width: 1000, height: 296, tx: 0, ty: 0 },
  '300x250': { left: -1, top: 0, width: 214, height: 253, tx: 88, ty: 0 },
  '160x600': { left: -49, top: 316, width: 240, height: 284, tx: 0, ty: 0 },
  '300x600': { left: -38, top: 232, width: 340, height: 400, tx: 0, ty: 0 },
  '970x250': { left: 662, top: -119, width: 330, height: 391, tx: 0, ty: 0 },
};

/** Sizes that keep stage1 for the whole ad (no stage2 move). */
const BLUE_STAGE1_ONLY = new Set(['320x50', '160x600']);

test('white/navy/offers-0 headline scopes exclude Act 4 by default', () => {
  assert.equal(
    selectorForVariantRule({ scope: 'white-headlines', cssClass: 'sse-headline' }),
    '.white-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'navy-headlines', cssClass: 'sse-headline' }),
    '.navy-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', cssClass: 'sse-headline' }),
    '.offers-0 .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', layerId: 'headline-act4', props: { color: NAVY } }),
    '.offers-0 #headline-act4',
  );
});
