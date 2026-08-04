import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';

import {
  captureIntervalMs,
  expandMatrixRows,
  frameTimestampsMs,
  loadCopyMatrix,
  matrixFrameTimestamps,
  matrixSpritesheetTimestamps,
  spritesheetIntervalMs,
} from './build-rows';
import {
  archivePreviousQaRuns,
  defaultQaRunOutputDir,
  formatQaRunId,
  pointQaLatestSymlink,
  QA_OUTPUT_ROOT,
} from './qa-paths';
import {
  MAX_SPRITESHEET_LONGEST_EDGE,
  MIN_SPRITESHEET_SCALE,
  planVariantLayout,
} from './spritesheet';

test('qa run id is local YYYYMMDD-HHMMSS under qa-output/', () => {
  const stamp = formatQaRunId(new Date(2026, 6, 31, 17, 1, 22));
  assert.equal(stamp, '20260731-170122');
  assert.equal(defaultQaRunOutputDir(new Date(2026, 6, 31, 17, 1, 22)), path.join(QA_OUTPUT_ROOT, stamp));
});

test('archivePreviousQaRuns moves older stamps; latest symlink points at keep', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-dco-runs-'));
  const oldA = path.join(root, '20260731-170122');
  const oldB = path.join(root, '20260731-180000');
  const keep = '20260731-190000';
  await fs.mkdir(path.join(oldA, 'spritesheets'), { recursive: true });
  await fs.writeFile(path.join(oldA, 'visual-review.md'), '![s](spritesheets/x.png)\n');
  await fs.mkdir(oldB, { recursive: true });

  const moved = await archivePreviousQaRuns({ keepRunId: keep, outputRoot: root });
  assert.deepEqual(moved.sort(), ['20260731-170122', '20260731-180000']);
  assert.equal(await fs.readFile(path.join(root, 'archive', '20260731-170122', 'visual-review.md'), 'utf8'), '![s](spritesheets/x.png)\n');
  await fs.mkdir(path.join(root, keep), { recursive: true });
  await pointQaLatestSymlink({ runId: keep, outputRoot: root });
  assert.equal(await fs.readlink(path.join(root, 'latest')), keep);
});

test('copy matrix expands to 12 feed rows (6 variants × short/long)', () => {
  const matrix = loadCopyMatrix();
  const rows = expandMatrixRows(matrix);
  assert.equal(matrix.variants.length, 6);
  assert.equal(matrix.copySets.length, 2);
  assert.equal(rows.length, 12);
  assert.equal(rows[0]?.sessionId, 'o1_roundel_prices_rect__short');
  assert.equal(rows[0]?.row.offer_count_num, 1);
  assert.equal(rows[0]?.row.include_roundel_frame_bool, true);
  assert.equal(rows[0]?.row.heading1_text, 'Save');
  assert.equal(rows[0]?.row.roundel_value_text, '€1');
});

test('long copy set uses long headlines and offers', () => {
  const matrix = loadCopyMatrix();
  const rows = expandMatrixRows(matrix, {
    variantIds: ['o3_noroundel_solo_circ'],
    copySetIds: ['long'],
  });
  assert.equal(rows.length, 1);
  const row = rows[0]!.row;
  assert.equal(row.offer_count_num, 3);
  assert.equal(row.include_roundel_frame_bool, false);
  assert.equal(row.tc_type_enum, 'tcs_only');
  assert.equal(row.cta_type_enum, 'roundel');
  assert.equal(row.heading1_text, 'A different kind of energy');
  assert.equal(row.heading2_text, "This year's best electricity plan");
  assert.equal(row.offer1_value_text, '11%');
  assert.equal(row.offer1_sub_text, 'OFF ELECTRICITY*');
  assert.equal(row.offer2_value_text, '£8,888');
  assert.equal(row.offer3_sub_text, 'OFF YOUR FIRST BILL*');
  assert.equal(row.roundel_value_text, '£8,888');
  assert.equal(row.roundel_text_text, 'Saving you up to');
  assert.equal(row.cta_text, 'Switch today');
});

test('offers-0 uses brand CTA copy', () => {
  const matrix = loadCopyMatrix();
  const rows = expandMatrixRows(matrix, {
    variantIds: ['o0_roundel_rect'],
    copySetIds: ['short'],
  });
  assert.equal(rows[0]?.row.cta_text, 'Find out more');
  assert.equal(rows[0]?.row.offer_count_num, 0);
});

test('capture is 4fps; spritesheet is 1fps subset', () => {
  const matrix = loadCopyMatrix();
  assert.equal(captureIntervalMs(matrix), 250);
  assert.equal(spritesheetIntervalMs(matrix), 1000);
  const capture = matrixFrameTimestamps(matrix);
  const sheet = matrixSpritesheetTimestamps(matrix);
  assert.equal(capture[0], 0);
  assert.equal(capture[1], 250);
  assert.equal(capture[capture.length - 1], 15000);
  assert.equal(capture.length, 61);
  assert.equal(sheet[0], 0);
  assert.equal(sheet[1], 1000);
  assert.equal(sheet[sheet.length - 1], 15000);
  assert.equal(sheet.length, 16);
  assert.deepEqual(frameTimestampsMs(15, 250), capture);
  assert.ok(sheet.every((t) => capture.includes(t)));
});

test('variant layout keeps full timeline on one sheet at ≥75% scale', () => {
  const frames = 16;
  const tall = planVariantLayout(160, 600, frames);
  const wide = planVariantLayout(728, 90, frames);
  const billboard = planVariantLayout(970, 250, frames);

  for (const layout of [tall, wide, billboard]) {
    assert.ok(layout.scale + 1e-9 >= MIN_SPRITESHEET_SCALE, `scale ${layout.scale}`);
    assert.equal(layout.cols * (layout.rows - 1) + (frames % layout.cols || layout.cols), frames);
    assert.ok(Math.max(layout.sheetWidth, layout.sheetHeight) <= MAX_SPRITESHEET_LONGEST_EDGE + 1);
  }

  // Tall 160x600 × 16 @ ≥75%: may wrap to 2 rows under the 2048 edge cap.
  assert.ok(tall.rows >= 1 && tall.rows <= 2);
  // Billboard cannot be one row at ≥75% under 2048; wrap instead of orphan pages.
  assert.ok(billboard.rows >= 2);
  assert.ok(billboard.cols >= 2);
});
