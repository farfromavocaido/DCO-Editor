import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  INK_DEFAULT_SIZE,
  INK_OVERRIDE_SIZES,
  applySizeInkOverrideToRow,
  coerceTriStateBool,
  navyHeadlinesForSize,
  sizeInkFieldDefinitions,
  sizeInkFieldName,
  sizeInkOverrideFieldNameForSize,
} from '@/lib/feed-size-ink';

test('MPU is the default size and override sizes exclude it', () => {
  assert.equal(INK_DEFAULT_SIZE, '300x250');
  assert.ok(!INK_OVERRIDE_SIZES.includes('300x250' as never));
  assert.ok(INK_OVERRIDE_SIZES.includes('160x600'));
  assert.ok(INK_OVERRIDE_SIZES.includes('320x50'));
});

test('size ink field definitions are tri-state and exclude MPU', () => {
  const defs = sizeInkFieldDefinitions();
  assert.equal(defs.length, INK_OVERRIDE_SIZES.length);
  assert.ok(defs.every((field) => field.type === 'tri-state-bool'));
  assert.ok(!defs.some((field) => field.name === 'navy_headlines_bool_300x250'));
  assert.equal(sizeInkFieldName('160x600'), 'navy_headlines_bool_160x600');
});

test('coerceTriStateBool keeps blank distinct from false', () => {
  assert.equal(coerceTriStateBool(''), '');
  assert.equal(coerceTriStateBool(undefined), '');
  assert.equal(coerceTriStateBool(null), '');
  assert.equal(coerceTriStateBool(false), false);
  assert.equal(coerceTriStateBool('false'), false);
  assert.equal(coerceTriStateBool(true), true);
  assert.equal(coerceTriStateBool('navy'), true);
  assert.equal(coerceTriStateBool('white'), false);
});

test('navyHeadlinesForSize inherits MPU when size cell is blank', () => {
  const row = { navy_headlines_bool: true, navy_headlines_bool_160x600: '' };
  assert.equal(navyHeadlinesForSize(row, '300x250'), true);
  assert.equal(navyHeadlinesForSize(row, '160x600'), true);
  assert.equal(navyHeadlinesForSize(row, null), true);
});

test('navyHeadlinesForSize honours explicit false override when MPU is navy', () => {
  const row = { navy_headlines_bool: true, navy_headlines_bool_728x90: false };
  assert.equal(navyHeadlinesForSize(row, '300x250'), true);
  assert.equal(navyHeadlinesForSize(row, '728x90'), false);
  assert.equal(navyHeadlinesForSize(row, '160x600'), true);
});

test('navyHeadlinesForSize honours explicit true override when MPU is white', () => {
  const row = { navy_headlines_bool: false, navy_headlines_bool_320x50: true };
  assert.equal(navyHeadlinesForSize(row, '300x250'), false);
  assert.equal(navyHeadlinesForSize(row, '320x50'), true);
});

test('applySizeInkOverrideToRow resolves navy_headlines_bool for the active size', () => {
  const resolved = applySizeInkOverrideToRow({
    navy_headlines_bool: true,
    navy_headlines_bool_160x600: false,
  }, '160x600');
  assert.equal(resolved.navy_headlines_bool, false);
  assert.equal(resolved.navy_headlines_bool_160x600, false);
});

test('sizeInkOverrideFieldNameForSize is null for MPU', () => {
  assert.equal(sizeInkOverrideFieldNameForSize('300x250'), null);
  assert.equal(sizeInkOverrideFieldNameForSize('160x600'), 'navy_headlines_bool_160x600');
});
