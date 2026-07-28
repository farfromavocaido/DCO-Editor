import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  authoredLetterSpacingToEm,
  captureDisplayedLines,
  letterSpacingToEm,
  normalizeCapturedText,
} from '@/lib/outline-snapshot';
import { parseOfferValueParts } from '@/lib/offer-value-symbols';

test('normalizeCapturedText keeps newlines and collapses horizontal space', () => {
  assert.equal(
    normalizeCapturedText('A different kind\nof energy'),
    'A different kind\nof energy',
  );
  assert.equal(
    normalizeCapturedText('A  different\r\nkind\n  of  energy'),
    'A different\nkind\nof energy',
  );
  assert.equal(normalizeCapturedText('  hello  world  '), 'hello world');
});

test('captureDisplayedLines falls back to hard newlines without a live layout', () => {
  assert.deepEqual(
    captureDisplayedLines({ textContent: 'OFF\nELECTRICITY*' } as HTMLElement),
    ['OFF', 'ELECTRICITY*'],
  );
  assert.deepEqual(
    captureDisplayedLines({ textContent: 'OFF ELECTRICITY*' } as HTMLElement),
    ['OFF ELECTRICITY*'],
  );
});

test('letterSpacingToEm reads em and px from computed styles', () => {
  assert.equal(letterSpacingToEm('normal', 40), 0);
  assert.equal(letterSpacingToEm('-0.05em', 40), -0.05);
  assert.equal(letterSpacingToEm('-2px', 40), -0.05);
});

test('authoredLetterSpacingToEm treats unitless creative JSON as px', () => {
  assert.ok(Math.abs(authoredLetterSpacingToEm(-0.5, 40) - (-0.5 / 40)) < 1e-9);
  assert.equal(authoredLetterSpacingToEm('-0.05em', 40), -0.05);
  assert.equal(authoredLetterSpacingToEm('normal', 40), 0);
});

test('parseOfferValueParts splits % / £ / € for outline bake', () => {
  assert.deepEqual(parseOfferValueParts('10%'), { prefix: '', body: '10', suffix: '%' });
  assert.deepEqual(parseOfferValueParts('£60'), { prefix: '£', body: '60', suffix: '' });
  assert.deepEqual(parseOfferValueParts('€1,080'), { prefix: '€', body: '1,080', suffix: '' });
  assert.deepEqual(parseOfferValueParts('SAVE'), { prefix: '', body: 'SAVE', suffix: '' });
});
