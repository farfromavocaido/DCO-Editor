import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  applyFitBudgetToBox,
  fitBudgetHeight,
  propsWithFitBudget,
  verticalAlignFromValues,
} from './fit-box';

test('fitBudgetHeight multiplies line box by maxLines', () => {
  assert.equal(
    fitBudgetHeight({ fontSize: 20, lineHeight: 1.1 }, { maxLines: 2 }),
    44,
  );
  assert.equal(
    fitBudgetHeight({ fontSize: 20, lineHeight: 1.1 }, { maxLines: 1 }),
    22,
  );
  assert.equal(fitBudgetHeight({ fontSize: 20 }, {}), null);
});

test('top alignment grows the box downward when height is unset', () => {
  const next = applyFitBudgetToBox({
    top: 100,
    height: 22, // seed = one line box; values.height unset
    localTop: 11,
    values: { fontSize: 20, lineHeight: 1.1, alignItems: 'flex-start' },
    fit: { maxLines: 2 },
  });
  assert.equal(next.height, 44);
  assert.equal(next.top, 100);
  assert.equal(next.localTop, 11);
  assert.equal(next.anchor, 'top');
});

test('bottom alignment grows the box upward when height is unset', () => {
  const next = applyFitBudgetToBox({
    top: 100,
    height: 22,
    localTop: 11,
    values: { fontSize: 20, lineHeight: 1.1, alignItems: 'flex-end' },
    fit: { maxLines: 2 },
  });
  assert.equal(next.height, 44);
  assert.equal(next.top, 100 - (44 - 22));
  assert.equal(next.localTop, 11 - (44 - 22));
  assert.equal(next.anchor, 'bottom');
});

test('center alignment grows the box both ways when height is unset', () => {
  const next = applyFitBudgetToBox({
    top: 100,
    height: 20,
    values: { fontSize: 20, lineHeight: 1, alignItems: 'center' },
    fit: { maxLines: 2 },
  });
  assert.equal(next.height, 40);
  assert.equal(next.top, 100 - 10);
  assert.equal(next.anchor, 'center');
});

test('explicit authored height wins over maxLines budget', () => {
  // Tight offer-subline boxes (728x90 offers-3) author height: 11 with
  // maxLines: 2. Expanding chrome to the line budget fought canvas drags.
  const next = applyFitBudgetToBox({
    top: 40,
    height: 11,
    localTop: 40,
    values: {
      top: 40,
      height: 11,
      fontSize: 11,
      lineHeight: 1.1,
      alignItems: 'flex-start',
    },
    fit: { mode: 'shrink', maxLines: 2 },
  });
  assert.equal(next.budgetApplied, false);
  assert.equal(next.height, 11);
  assert.equal(next.top, 40);
  assert.equal(next.localTop, 40);
});

test('propsWithFitBudget rewrites height and top when height is unset', () => {
  const props = propsWithFitBudget(
    {
      top: 50,
      height: '',
      fontSize: 16,
      lineHeight: 1.25,
      alignItems: 'flex-end',
    },
    { mode: 'shrink', maxLines: 2 },
  );
  assert.equal(props.height, 40);
  assert.equal(props.top, 50 - (40 - 20));
  assert.equal(verticalAlignFromValues(props), 'bottom');
});

test('propsWithFitBudget keeps an explicit authored height', () => {
  const props = propsWithFitBudget(
    {
      top: 40,
      height: 11,
      fontSize: 11,
      lineHeight: 1.1,
      alignItems: 'flex-start',
    },
    { mode: 'shrink', maxLines: 2 },
  );
  assert.equal(props.height, 11);
  assert.equal(props.top, 40);
});

test('propsWithFitBudget treats empty height as unset (not zero)', () => {
  // Regression: Number("") === 0 made flex-end grow from a zero box and
  // yank top up by the full maxLines budget (320x50 offer-subline).
  const props = propsWithFitBudget(
    {
      top: 30,
      height: '',
      fontSize: 9,
      lineHeight: 1.1,
      alignItems: 'flex-end',
    },
    { mode: 'shrink', maxLines: 2 },
  );
  const lineBox = 9 * 1.1;
  const budget = lineBox * 2;
  assert.equal(props.height, budget);
  // Seed height = one line box, not 0 → top only moves by one extra line.
  assert.equal(props.top, 30 - (budget - lineBox));
  assert.notEqual(props.top, 30 - budget);
});
