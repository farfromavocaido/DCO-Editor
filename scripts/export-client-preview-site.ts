import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCreativeDocument } from '../src/server/creative-document';
import { buildClientPreviewPackageEntries } from '../src/server/creative-exporter';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, 'site');

const writeEntry = async (relativePath: string, data: string | Buffer) => {
  const targetPath = path.resolve(siteRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, data);
  return targetPath;
};

const main = async () => {
  const document = await readCreativeDocument();
  const entries = await buildClientPreviewPackageEntries(document, { includeValidator: false });

  await fs.rm(siteRoot, { recursive: true, force: true });
  await fs.mkdir(siteRoot, { recursive: true });

  let totalBytes = 0;
  let previewHtml: string | null = null;

  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    totalBytes += data.length;
    await writeEntry(entry.path, data);
    if (entry.path === 'preview-page.html') {
      previewHtml = String(entry.data);
    }
  }

  if (!previewHtml) {
    throw new Error('Client preview export did not produce preview-page.html');
  }

  await writeEntry('index.html', previewHtml);
  await writeEntry('.nojekyll', '');

  console.log(`Exported ${entries.length + 2} files (${totalBytes} bytes) to ${siteRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
