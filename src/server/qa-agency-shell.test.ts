import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, vi } from 'vitest';

const failures = vi.hoisted(() => ({ export: false }));
vi.mock('./creative-exporter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./creative-exporter')>();
  return { ...actual, buildBasePackageEntries: async (...args: Parameters<typeof actual.buildBasePackageEntries>) => {
    if (failures.export) throw new Error('simulated export failure');
    return actual.buildBasePackageEntries(...args);
  } };
});
import { ensureCanonicalAgencyShell, qaRevisionDirectory } from './qa-agency-shell';
import { projectRoot, creativeDocumentPath } from './paths';

test('QA cache invalidates saved copy and renderer inputs, preserves concurrent readers', async () => {
  const root = path.join(projectRoot, 'qa-cache-test');
  const first = await ensureCanonicalAgencyShell(root);
  const originalHtml = await fs.readFile(path.join(first.workDir, 'ads/300x250/index.html'), 'utf8');
  const cached = await ensureCanonicalAgencyShell(root);
  expect(cached.revision).toBe(first.revision);

  const document = JSON.parse(await fs.readFile(creativeDocumentPath, 'utf8'));
  document.campaign.name = `${document.campaign.name} QA revision test`;
  await fs.writeFile(creativeDocumentPath, JSON.stringify(document));
  const [next, concurrent] = await Promise.all([ensureCanonicalAgencyShell(root), ensureCanonicalAgencyShell(root)]);
  expect(next.documentRevision).not.toBe(first.documentRevision);
  expect(concurrent.revision).toBe(next.revision);
  expect(await fs.readFile(path.join(first.workDir, 'ads/300x250/index.html'), 'utf8')).toBe(originalHtml);
  expect(JSON.parse(await fs.readFile(path.join(root, '.qa-shell.json'), 'utf8')).revision).toBe(next.revision);

  const fieldMap = path.join(projectRoot, 'feed-field-map.json');
  await fs.appendFile(fieldMap, '\n');
  const rendererChanged = await ensureCanonicalAgencyShell(root);
  expect(rendererChanged.rendererRevision).not.toBe(next.rendererRevision);
  expect(rendererChanged.documentRevision).toBe(next.documentRevision);
  expect(rendererChanged.revision).not.toBe(next.revision);
  expect(qaRevisionDirectory(rendererChanged.revision, root)).toBe(rendererChanged.workDir);
  expect(() => qaRevisionDirectory('../escape', root)).toThrow();
  failures.export = true;
  await expect(ensureCanonicalAgencyShell(root, { force: true })).rejects.toThrow('simulated export failure');
  expect(JSON.parse(await fs.readFile(path.join(root, '.qa-shell.json'), 'utf8')).revision).toBe(rendererChanged.revision);
  expect(await fs.readFile(path.join(rendererChanged.workDir, 'ads/300x250/index.html'), 'utf8')).toContain('<html');
  failures.export = false;
  expect((await ensureCanonicalAgencyShell(root)).revision).toBe(rendererChanged.revision);
});
