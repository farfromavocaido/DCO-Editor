import fs from 'node:fs/promises';
import path from 'node:path';

import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { buildBasePackageEntries } from '@/server/creative-exporter';
import { appRoot } from '@/server/paths';

export const DEFAULT_QA_WORK_DIR = path.resolve(appRoot, '.qa-work');

export const QA_DCO_CAMPAIGN_ID = 'sse-dco';

const writeEntry = async (root: string, relativePath: string, data: string | Buffer) => {
  const targetPath = path.resolve(root, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, data);
  return targetPath;
};

export type QaShellInfo = {
  workDir: string;
  sizes: string[];
  entryCount: number;
  exportedAt: string;
};

/**
 * Export the SSE DCO canonical-agency package into a gitignored workdir.
 * Does not touch tracked `outputs/`.
 */
export const exportCanonicalAgencyShell = async (
  workDir = DEFAULT_QA_WORK_DIR,
): Promise<QaShellInfo> => {
  const document = await readCreativeDocumentForCampaign(QA_DCO_CAMPAIGN_ID);
  const entries = await buildBasePackageEntries(document, {
    assetMode: 'canonical-agency',
    renderMode: 'font',
  });

  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  for (const entry of entries) {
    await writeEntry(workDir, entry.path, entry.data);
  }

  const sizes = Object.keys(document.sizes || {});
  const exportedAt = new Date().toISOString();
  await fs.writeFile(
    path.resolve(workDir, '.qa-shell.json'),
    `${JSON.stringify({ exportedAt, sizes, entryCount: entries.length }, null, 2)}\n`,
    'utf8',
  );

  return {
    workDir,
    sizes,
    entryCount: entries.length,
    exportedAt,
  };
};

/** Return existing shell metadata if present; otherwise export. */
export const ensureCanonicalAgencyShell = async (
  workDir = DEFAULT_QA_WORK_DIR,
  options: { force?: boolean } = {},
): Promise<QaShellInfo> => {
  if (!options.force) {
    try {
      const markerPath = path.resolve(workDir, '.qa-shell.json');
      const adsDir = path.resolve(workDir, 'ads');
      const raw = await fs.readFile(markerPath, 'utf8');
      await fs.access(adsDir);
      const marker = JSON.parse(raw) as { exportedAt?: string; sizes?: string[]; entryCount?: number };
      if (marker.exportedAt && Array.isArray(marker.sizes) && marker.sizes.length) {
        return {
          workDir,
          sizes: marker.sizes,
          entryCount: Number(marker.entryCount) || 0,
          exportedAt: marker.exportedAt,
        };
      }
    } catch {
      // fall through to export
    }
  }
  return exportCanonicalAgencyShell(workDir);
};
