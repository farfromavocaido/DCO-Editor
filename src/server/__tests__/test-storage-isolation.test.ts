import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { appRoot, projectRoot } from '../paths';
import { readCreativeDocument, writeCreativeDocument } from '../creative-document';

test('saving a creative in server tests cannot overwrite the working campaign', async () => {
  // Guard before any write: a broken fixture setup fails safely.
  assert.notEqual(projectRoot, path.join(appRoot, 'campaign'));
  const originalPath = path.join(appRoot, 'campaign/sse-dco-creative.json');
  const original = await fs.readFile(originalPath, 'utf8');
  const document = await readCreativeDocument();
  document.campaign.name = 'Isolated test campaign';
  await writeCreativeDocument(document);
  assert.equal((await readCreativeDocument()).campaign.name, 'Isolated test campaign');
  assert.equal(await fs.readFile(originalPath, 'utf8'), original);
});
