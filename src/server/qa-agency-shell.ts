import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildBasePackageEntries } from '@/server/creative-exporter';
import { appRoot, projectRoot } from '@/server/paths';

export const DEFAULT_QA_WORK_DIR = path.resolve(appRoot, '.qa-work');
export const QA_DCO_CAMPAIGN_ID = 'sse-dco';
export const qaDocumentRevision = (document: object) => createHash('sha256').update(JSON.stringify(document)).digest('hex');

export type QaShellInfo = {
  workDir: string;
  sizes: string[];
  entryCount: number;
  exportedAt: string;
  revision: string;
  documentRevision: string;
  rendererRevision: string;
};

// Include shared renderer dependencies, so changes to fitting/motion also invalidate QA.
export async function qaRendererRevision() {
  const hash = createHash('sha256');
  for (const directory of ['src/lib', 'src/server']) {
    const root = path.join(appRoot, directory);
    const files = (await fs.readdir(root, { recursive: true })).filter(name => /\.(ts|js|json)$/.test(name) && !name.includes('.test.')).sort();
    for (const file of files) hash.update(file).update(await fs.readFile(path.join(root, file)));
  }
  hash.update(await fs.readFile(path.join(projectRoot, 'feed-field-map.json')));
  return hash.digest('hex');
}

const queues = new Map<string, Promise<QaShellInfo>>();

/** Build into a private immutable directory, then atomically publish the pointer.
 * Existing readers retain their revision; no serving directory is removed.
 */
export const ensureCanonicalAgencyShell = (
  workDir = DEFAULT_QA_WORK_DIR,
  options: { force?: boolean } = {},
): Promise<QaShellInfo> => {
  const root = path.resolve(workDir);
  const previous = queues.get(root);
  const pending = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(async () => {
    const document = await readCreativeDocumentForCampaign(QA_DCO_CAMPAIGN_ID);
    const documentRevision = qaDocumentRevision(document);
    const rendererRevision = await qaRendererRevision();
    const markerPath = path.join(root, '.qa-shell.json');
    if (!options.force) {
      try {
        const marker = JSON.parse(await fs.readFile(markerPath, 'utf8')) as QaShellInfo;
        if (marker.documentRevision === documentRevision && marker.rendererRevision === rendererRevision) {
          await fs.access(path.join(marker.workDir, 'ads'));
          return marker;
        }
      } catch { /* Missing or legacy cache: rebuild. */ }
    }
    const entries = await buildBasePackageEntries(document, { assetMode: 'canonical-agency', renderMode: 'font' });
    const revision = `${documentRevision.slice(0, 12)}-${rendererRevision.slice(0, 12)}-${randomUUID()}`;
    const revisionDir = path.join(root, 'revisions', revision);
    await fs.mkdir(revisionDir, { recursive: true });
    for (const entry of entries) {
      const target = path.join(revisionDir, entry.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.data);
    }
    await fs.writeFile(path.join(revisionDir, '.qa-document.json'), JSON.stringify(document));
    const info: QaShellInfo = { workDir: revisionDir, sizes: Object.keys(document.sizes || {}), entryCount: entries.length,
      exportedAt: new Date().toISOString(), revision, documentRevision, rendererRevision };
    await fs.writeFile(path.join(revisionDir, '.qa-shell.json'), JSON.stringify(info));
    const pointer = path.join(root, `.qa-shell-${randomUUID()}.json`);
    await fs.writeFile(pointer, JSON.stringify(info));
    await fs.rename(pointer, markerPath);
    return info;
  });
  queues.set(root, pending);
  void pending.finally(() => { if (queues.get(root) === pending) queues.delete(root); }).catch(() => {});
  return pending;
};

export const exportCanonicalAgencyShell = (workDir = DEFAULT_QA_WORK_DIR) => ensureCanonicalAgencyShell(workDir, { force: true });

export function qaRevisionDirectory(revision: string, workDir = DEFAULT_QA_WORK_DIR) {
  if (!/^[a-f0-9]{12}-[a-f0-9]{12}-[a-f0-9-]{36}$/.test(revision)) throw new Error('Invalid QA revision');
  return path.join(workDir, 'revisions', revision);
}

export async function readQaRevisionDocument(revision: string) {
  return JSON.parse(await fs.readFile(path.join(qaRevisionDirectory(revision), '.qa-document.json'), 'utf8')) as Awaited<ReturnType<typeof readCreativeDocumentForCampaign>>;
}
