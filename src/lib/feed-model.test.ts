import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  activeScopesFromControls,
  controlsFromFeedRow,
  createFeedDraft,
  fieldInputValue,
  selectFeedDraftVariant,
  updateFeedDraftField,
} from './feed-model';

const fields = [
  { name: 'heading1_text', type: 'string' },
  { name: 'offer_count_num', type: 'integer', min: 1, max: 3 },
  { name: 'tc_type_enum', type: 'enum', options: ['tcs_only', 'tcs_units'] },
  { name: 'cta_type_enum', type: 'enum', options: ['roundel', 'rectangle'] },
  { name: 'include_roundel_frame_bool', type: 'boolean' },
  { name: 'roundel_text_text', type: 'string' },
  { name: 'roundel_value_text', type: 'string' },
  { name: 'Active', type: 'boolean' },
  { name: 'background_image_url', type: 'image' },
];

const rows = [
  {
    Unique_ID: 'single',
    offer_count_num: 1,
    tc_type_enum: 'tcs_only',
    cta_type_enum: 'roundel',
    include_roundel_frame_bool: false,
    roundel_text_text: '',
    roundel_value_text: '',
    heading1_text: 'A different kind of energy',
    Active: true,
    background_image_url: 'https://example.com/bg.jpg',
  },
  {
    Unique_ID: 'triple',
    offer_count_num: 3,
    tc_type_enum: 'tcs_units',
    cta_type_enum: 'rectangle',
    include_roundel_frame_bool: true,
    roundel_text_text: 'Save up to',
    roundel_value_text: '€1,080',
    heading1_text: 'Triple headline',
    Active: true,
    background_image_url: 'https://example.com/triple-bg.jpg',
  },
];

test('updates a draft row field without mutating the original rows', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const next = updateFeedDraftField(draft, fields, 'heading1_text', 'Fresh headline');

  assert.equal(next.rows[0].heading1_text, 'Fresh headline');
  assert.equal(rows[0].heading1_text, 'A different kind of energy');
  assert.equal(next.dirty, true);
  assert.equal(draft.dirty, false);
});

test('derives layout controls from the selected sample row', () => {
  assert.deepEqual(controlsFromFeedRow(rows[1]), {
    offerCount: 3,
    tcMode: 'tcs_units',
    ctaShape: 'rectangle',
    includeRoundelFrame: true,
    frameCount: 4,
    roundelMode: 'split',
  });
});

test('derives frame and roundel active scopes from feed controls', () => {
  assert.deepEqual(activeScopesFromControls(controlsFromFeedRow(rows[0])), [
    'offers-1',
    'tc-solo',
    'cta-roundel',
    'frames-3',
    'roundel-frame-off',
    'roundel-copy-only',
  ]);

  assert.deepEqual(activeScopesFromControls(controlsFromFeedRow(rows[1])), [
    'offers-3',
    'tc-prices',
    'cta-rect',
    'frames-4',
    'roundel-frame-on',
    'roundel-split',
  ]);
});

test('coerces sample field input values for preview state', () => {
  let draft = createFeedDraft(rows, { selectedIndex: 0 });
  draft = updateFeedDraftField(draft, fields, 'offer_count_num', '9');
  draft = updateFeedDraftField(draft, fields, 'Active', false);
  draft = updateFeedDraftField(draft, fields, 'include_roundel_frame_bool', 'true');
  draft = updateFeedDraftField(draft, fields, 'background_image_url', 'https://example.com/fresh-bg.jpg');

  assert.equal(draft.rows[0].offer_count_num, 3);
  assert.equal(draft.rows[0].Active, false);
  assert.equal(draft.rows[0].include_roundel_frame_bool, true);
  assert.equal(draft.rows[0].background_image_url, 'https://example.com/fresh-bg.jpg');
  assert.equal(fieldInputValue(draft.rows[0], fields.find((field) => field.name === 'background_image_url')), 'https://example.com/fresh-bg.jpg');
});

test('rejects invalid enum input before it reaches the preview', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  assert.throws(
    () => updateFeedDraftField(draft, fields, 'cta_type_enum', 'pill'),
    /cta_type_enum must be one of roundel, rectangle/,
  );
});

test('tracks feed dirtiness independently from layout dirtiness', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0, layoutDirty: true });
  const next = updateFeedDraftField(draft, fields, 'tc_type_enum', 'tcs_units');

  assert.equal(next.dirty, true);
  assert.equal(next.layoutDirty, true);
});

test('selects an existing populated sample row for topbar variant changes', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const next = selectFeedDraftVariant(draft, fields, 'offer_count_num', '3');

  assert.equal(next.selectedIndex, 1);
  assert.equal(next.rows[1].Unique_ID, 'triple');
  assert.equal(next.dirty, false);
  assert.equal(next.rows, draft.rows);
});

test('falls back to editing the selected sample row when no variant row matches', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const edited = selectFeedDraftVariant(draft, fields, 'offer_count_num', '2');

  assert.equal(edited.selectedIndex, 0);
  assert.equal(edited.rows[0].offer_count_num, 2);
  assert.equal(edited.dirty, true);
});

test('roundel frame variant control edits the current row when no matching frame row exists', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const edited = selectFeedDraftVariant(draft, fields, 'include_roundel_frame_bool', 'true');

  assert.equal(edited.selectedIndex, 0);
  assert.equal(edited.rows[0].include_roundel_frame_bool, true);
  assert.equal(edited.dirty, true);
});

test('roundel frame variant defaults the CTA to rectangular', () => {
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const edited = selectFeedDraftVariant(draft, fields, 'include_roundel_frame_bool', 'true');

  assert.equal(edited.rows[0].include_roundel_frame_bool, true);
  assert.equal(edited.rows[0].cta_type_enum, 'rectangle');
  assert.equal(controlsFromFeedRow(edited.rows[0]).ctaShape, 'rectangle');
});

test('accepts legacy rect CTA enum fields when the topbar selects rectangle', () => {
  const legacyFields = fields.map((field) => (
    field.name === 'cta_type_enum'
      ? { ...field, options: ['roundel', 'rect'] }
      : field
  ));
  const draft = createFeedDraft(rows, { selectedIndex: 0 });

  const edited = updateFeedDraftField(draft, legacyFields, 'cta_type_enum', 'rectangle');

  assert.equal(edited.rows[0].cta_type_enum, 'rect');
  assert.equal(controlsFromFeedRow(edited.rows[0]).ctaShape, 'rectangle');
});

test('accepts topbar tc controls when feed schema still lists legacy solo/prices options', () => {
  const legacyFields = fields.map((field) => (
    field.name === 'tc_type_enum'
      ? { ...field, options: ['solo', 'prices'] }
      : field
  ));
  const draft = createFeedDraft([rows[0]], { selectedIndex: 0 });

  const edited = selectFeedDraftVariant(draft, legacyFields, 'tc_type_enum', 'tcs_units');

  assert.equal(edited.rows[0].tc_type_enum, 'tcs_units');
  assert.equal(controlsFromFeedRow(edited.rows[0]).tcMode, 'tcs_units');
});

test('normalizes legacy solo/prices row values into canonical tc controls', () => {
  assert.equal(controlsFromFeedRow({ tc_type_enum: 'solo' }).tcMode, 'tcs_only');
  assert.equal(controlsFromFeedRow({ tc_type_enum: 'prices' }).tcMode, 'tcs_units');
});
