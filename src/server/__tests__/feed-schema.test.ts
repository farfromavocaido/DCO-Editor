import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { backgroundImageFieldDefinitions, backgroundImageFieldName, backgroundFieldsFromRow } from '@/lib/feed-background';
import { readCreativeDocument } from '../creative-document';
import {
  FEED_SCHEMA_FIELDS,
  readFeedSchema,
  validateFeedRows,
  writeFeedSchemaRows,
} from '../feed-schema';

const sampleRow = {
  _id: 0,
  Unique_ID: 'single_elec15_solo_roundel',
  Reporting_label: '1offer|15pc_electricity|tc_solo|cta_roundel',
  Active: true,
  Default: true,
  heading1_text: 'A different kind of energy',
  heading2_text: 'Our very best electricity plan',
  heading3_text: 'A different kind of energy',
  offer_count_num: 1,
  offer1_value_text: '15%',
  offer1_sub_text: 'OFF ELECTRICITY*',
  offer2_value_text: '',
  offer2_sub_text: '',
  offer3_value_text: '',
  offer3_sub_text: '',
  tc_type_enum: 'tcs_only',
  tc_terms_text: '*T&Cs apply',
  tc_units_text: 'Electricity unit rate: 32.64 Inc. Vat 31.09 Ex. Vat',
  cta_type_enum: 'roundel',
  cta_text: 'Switch today',
  include_roundel_frame_bool: false,
  roundel_text_text: '',
  roundel_value_text: '',
  ...backgroundFieldsFromRow({ [backgroundImageFieldName('300x250')]: 'https://example.com/bg.jpg' }),
};

const writeTempCreativeDocument = async (rows = [sampleRow]) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sse-feed-schema-'));
  const file = path.join(dir, 'sse-dco-creative.json');
  const base = await readCreativeDocument();
  await fs.writeFile(file, `${JSON.stringify({
    ...base,
    feed: {
      ...base.feed,
      sampleRows: rows,
    },
  }, null, 2)}\n`);
  return file;
};

test('defines metadata for every existing Studio profile field', () => {
  assert.deepEqual(FEED_SCHEMA_FIELDS.map((field) => field.name), [
    '_id',
    'Unique_ID',
    'Reporting_label',
    'Active',
    'Default',
    'heading1_text',
    'heading2_text',
    'heading3_text',
    'heading4_text',
    'offer_count_num',
    'offer1_value_text',
    'offer1_sub_text',
    'offer2_value_text',
    'offer2_sub_text',
    'offer3_value_text',
    'offer3_sub_text',
    'tc_type_enum',
    'tc_terms_text',
    'tc_units_text',
    'cta_type_enum',
    'cta_text',
    'include_roundel_frame_bool',
    'roundel_text_text',
    'roundel_value_text',
    ...backgroundImageFieldDefinitions().map((field) => field.name),
  ]);
  assert.deepEqual(FEED_SCHEMA_FIELDS.find((field) => field.name === 'tc_type_enum').options, ['tcs_only', 'tcs_units']);
  assert.deepEqual(FEED_SCHEMA_FIELDS.find((field) => field.name === 'cta_type_enum').options, ['roundel', 'rectangle']);
});

test('reads profile name, rows, and exposes the background image field', async () => {
  const file = await writeTempCreativeDocument();

  const payload = await readFeedSchema(file);

  assert.equal(payload.profileName, 'SSE_DCO_Offers');
  assert.equal(payload.studioProfileId, 10960467);
  assert.equal(payload.studioProfileElement, 'SSE_ROI_Delivery');
  assert.equal(payload.rows.length, 1);
  assert.equal(payload.rows[0].background_image_url_300x250.Url, 'https://example.com/bg.jpg');
  assert.equal(payload.fields.find((field) => field.name === 'background_image_url_728x90').type, 'image');
});

test('validates enums and coerces offer count into the supported range', () => {
  const rows = validateFeedRows([
    { ...sampleRow, offer_count_num: '9', tc_type_enum: 'tcs_units', cta_type_enum: 'rectangle', include_roundel_frame_bool: 'true' },
  ]);

  assert.equal(rows[0].offer_count_num, 3);
  assert.equal(rows[0].tc_type_enum, 'tcs_units');
  assert.equal(rows[0].cta_type_enum, 'rectangle');
  assert.equal(rows[0].include_roundel_frame_bool, true);
});

test('normalizes legacy solo/prices tc enum values to canonical feed values', () => {
  const rows = validateFeedRows([
    { ...sampleRow, tc_type_enum: 'solo' },
    { ...sampleRow, tc_type_enum: 'prices' },
  ]);

  assert.equal(rows[0].tc_type_enum, 'tcs_only');
  assert.equal(rows[1].tc_type_enum, 'tcs_units');
});

test('readFeedSchema upgrades legacy tc enum options from the creative document', async () => {
  const file = await writeTempCreativeDocument();
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  raw.feed.fields = raw.feed.fields.map((field) => (
    field.name === 'tc_type_enum'
      ? { ...field, options: ['solo', 'prices'] }
      : field
  ));
  await fs.writeFile(file, `${JSON.stringify(raw, null, 2)}\n`);

  const payload = await readFeedSchema(file);

  assert.deepEqual(
    payload.fields.find((field) => field.name === 'tc_type_enum').options,
    ['tcs_only', 'tcs_units'],
  );
});

test('rejects invalid sample row enum values', () => {
  assert.throws(
    () => validateFeedRows([{ ...sampleRow, tc_type_enum: 'legalese' }]),
    /tc_type_enum must be one of tcs_only, tcs_units/,
  );
  assert.throws(
    () => validateFeedRows([{ ...sampleRow, cta_type_enum: 'pill' }]),
    /cta_type_enum must be one of roundel, rectangle/,
  );
});

test('writes edited rows back into the creative document feed section', async () => {
  const file = await writeTempCreativeDocument();

  await writeFeedSchemaRows([
    {
      ...sampleRow,
      heading1_text: 'Fresh headline',
      ...backgroundFieldsFromRow({ [backgroundImageFieldName('300x250')]: 'https://example.com/fresh-bg.jpg' }),
    },
  ], file);
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));

  assert.equal(raw.feed.profileName, 'SSE_DCO_Offers');
  assert.equal(raw.feed.sampleRows[0].heading1_text, 'Fresh headline');
  assert.equal(raw.feed.sampleRows[0].background_image_url_300x250.Url, 'https://example.com/fresh-bg.jpg');
});
