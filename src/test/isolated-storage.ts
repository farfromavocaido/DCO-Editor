import { afterAll, vi } from 'vitest';
import fs from 'node:fs/promises';

const storage = vi.hoisted(() => ({ root: '' }));

// Redirect the filesystem boundary, not the production read/write/export code.
// Each test file gets its own copy; failures cannot damage a user's campaign or
// outputs and concurrent suites never restore over one another's packages.
vi.mock('@/server/paths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/paths')>();
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');
  storage.root = await fs.mkdtemp(path.join(os.tmpdir(), 'sse-editor-test-'));
  const projectRoot = path.join(storage.root, 'campaign');
  const fixtureRoot = process.env.DCO_TEST_LIVE_CAMPAIGN === '1' ? actual.projectRoot : path.join(actual.appRoot, 'src/test/fixtures/campaign');
  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  // Binary renderer resources are copied, never edited in place. Campaign JSON
  // comes from fixed compatibility fixtures unless the creative lane is requested.
  if (fixtureRoot !== actual.projectRoot) await fs.cp(path.join(actual.projectRoot, 'assets'), path.join(projectRoot, 'assets'), { recursive: true });
  const creativeDocumentPathFor = (campaignId?: string | null) => (
    path.join(projectRoot, path.basename(actual.creativeDocumentPathFor(campaignId)))
  );
  return {
    ...actual,
    projectRoot,
    outputRoot: path.join(storage.root, 'output'),
    outputsRoot: path.join(storage.root, 'outputs'),
    creativeDocumentPathFor,
    creativeDocumentPath: creativeDocumentPathFor(),
  };
});

afterAll(async () => {
  if (storage.root) await fs.rm(storage.root, { recursive: true, force: true });
});
