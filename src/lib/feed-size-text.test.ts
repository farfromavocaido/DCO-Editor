import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  SIZE_OVERRIDABLE_TEXT_FIELDS,
  applySizeTextOverridesToRow,
  sizeTextFieldDefinitions,
  sizeTextFieldName,
  textFieldForSize,
} from '@/lib/feed-size-text';

test('generates one multiline override field per base × size', () => {
  const defs = sizeTextFieldDefinitions();
  assert.equal(defs.length, SIZE_OVERRIDABLE_TEXT_FIELDS.length * 6);
  assert.ok(defs.every((field) => field.type === 'multiline' && field.group === 'Copy Overrides'));
  assert.equal(sizeTextFieldName('heading1_text', '160x600'), 'heading1_text_160x600');
});

test('textFieldForSize prefers non-empty size override then base', () => {
  const row = {
    heading1_text: 'Base headline',
    heading1_text_160x600: 'Tall override',
    heading1_text_300x250: '',
  };
  assert.equal(textFieldForSize(row, 'heading1_text', '160x600'), 'Tall override');
  assert.equal(textFieldForSize(row, 'heading1_text', '300x250'), 'Base headline');
  assert.equal(textFieldForSize(row, 'heading1_text', '728x90'), 'Base headline');
  assert.equal(textFieldForSize(row, 'heading1_text', ''), 'Base headline');
});

test('textFieldForSize normalizes Studio br tags to newlines', () => {
  assert.equal(
    textFieldForSize({
      heading2_text: 'Base',
      heading2_text_320x50: 'A different kind <br> of energy',
    }, 'heading2_text', '320x50'),
    'A different kind \n of energy',
  );
});

test('applySizeTextOverridesToRow resolves base keys for the active size', () => {
  const resolved = applySizeTextOverridesToRow({
    heading1_text: 'Base',
    heading1_text_320x50: 'Single line',
    tc_units_text: 'Unit base',
    tc_units_text_160x600: 'Unit\noverride',
  }, '160x600');
  assert.equal(resolved.heading1_text, 'Base');
  assert.equal(resolved.tc_units_text, 'Unit\noverride');
  assert.equal(resolved.heading1_text_320x50, 'Single line');
});
