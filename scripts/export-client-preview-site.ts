import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCreativeDocument } from '../src/server/creative-document';
import { buildClientPreviewPackageEntries } from '../src/server/creative-exporter';
import { outputsRoot } from '../src/server/paths';
import { wrapPreviewSiteWithPasswordGate } from './preview-site-password-gate';
import { renderStaticsPreviewPage } from './render-statics-preview-page';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, 'site');

const writeEntry = async (relativePath: string, data: string | Buffer) => {
  const targetPath = path.resolve(siteRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, data);
  return targetPath;
};

const copyDirectory = async (sourceDir: string, targetDir: string) => {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.resolve(sourceDir, entry.name);
    const targetPath = path.resolve(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
};

const renderStaticsPlaceholderPage = () => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SSE statics preview</title>
    <link rel="stylesheet" href="https://use.typekit.net/grv2rfu.css">
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0f13;
        color: #edf7f7;
        font-family: "museo-sans", sans-serif;
      }
      main {
        width: min(100%, 420px);
        padding: 28px;
        border: 1px solid #2b3846;
        border-radius: 16px;
        background: #141b23;
      }
      h1 { margin: 0 0 10px; font-size: 24px; font-weight: 650; }
      p { margin: 0; color: #99a8b5; line-height: 1.5; }
      a { color: #16c7b7; }
    </style>
  </head>
  <body>
    <header hidden></header>
    <main>
      <h1>Statics preview</h1>
      <p>No committed package yet. In the editor, run <strong>Export for Preview</strong>, commit <code>outputs/</code>, and push to publish the HTML + ZIP here.</p>
      <p style="margin-top:14px"><a href="../">DCO preview</a></p>
    </main>
  </body>
</html>`;

const exportStaticsPreviewSite = async () => {
  const campaignsDir = path.resolve(outputsRoot, 'campaigns');
  const latestPath = path.resolve(outputsRoot, 'latest.json');
  const staticsRoot = path.resolve(siteRoot, 'statics');
  await fs.rm(staticsRoot, { recursive: true, force: true });
  await fs.mkdir(staticsRoot, { recursive: true });

  let campaignEntries: string[] = [];
  try {
    campaignEntries = await fs.readdir(campaignsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  let latestRaw: {
    generatedAt?: string | null;
    zip?: string | null;
    campaigns?: Array<{ id: string; name: string; exportSlug: string; sizes: string[] }>;
  } | null = null;
  try {
    latestRaw = JSON.parse(await fs.readFile(latestPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const hasPackage = Boolean(campaignEntries.length && latestRaw?.campaigns?.length && latestRaw.zip);
  if (!hasPackage) {
    if (process.env.STRICT_STATICS_EXPORT === '1') {
      throw new Error(
        'outputs/campaigns is empty. Run Export for Preview in the editor, commit outputs/, then re-export the Pages site.',
      );
    }
    console.warn('outputs/ has no statics package yet — writing placeholder /statics/ page');
    const gatedPlaceholder = wrapPreviewSiteWithPasswordGate(renderStaticsPlaceholderPage(), {
      kicker: 'SSE Airtricity',
      title: 'Statics preview',
      copy: 'Enter the preview password to continue.',
    });
    await writeEntry('statics/index.html', gatedPlaceholder);
    return;
  }

  await copyDirectory(campaignsDir, path.resolve(staticsRoot, 'campaigns'));
  const downloadsDir = path.resolve(outputsRoot, 'downloads');
  try {
    await copyDirectory(downloadsDir, path.resolve(staticsRoot, 'downloads'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await fs.copyFile(latestPath, path.resolve(staticsRoot, 'latest.json'));

  const previewHtml = renderStaticsPreviewPage(latestRaw as Parameters<typeof renderStaticsPreviewPage>[0]);
  const gatedIndex = wrapPreviewSiteWithPasswordGate(previewHtml, {
    kicker: 'SSE Airtricity',
    title: 'Statics preview',
    copy: 'Enter the preview password to continue.',
  });
  await writeEntry('statics/index.html', gatedIndex);
};

const main = async () => {
  const document = await readCreativeDocument();
  // CDN assets/fonts match Studio production handoff (base CDN zip).
  const entries = await buildClientPreviewPackageEntries(document, {
    includeValidator: false,
    assetMode: 'cdn',
  });

  await fs.rm(siteRoot, { recursive: true, force: true });
  await fs.mkdir(siteRoot, { recursive: true });

  let totalBytes = 0;
  let previewHtml: string | null = null;

  for (const entry of entries) {
    if (entry.path === 'preview-page.html') {
      previewHtml = String(entry.data);
      continue;
    }
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    totalBytes += data.length;
    await writeEntry(entry.path, data);
  }

  if (!previewHtml) {
    throw new Error('Client preview export did not produce preview-page.html');
  }

  const gatedIndex = wrapPreviewSiteWithPasswordGate(previewHtml);
  totalBytes += Buffer.byteLength(gatedIndex);
  await writeEntry('index.html', gatedIndex);
  await writeEntry('.nojekyll', '');

  await exportStaticsPreviewSite();
  const staticsIndex = await fs.readFile(path.resolve(siteRoot, 'statics/index.html'));
  totalBytes += staticsIndex.length;

  console.log(`Exported DCO + statics preview site (${totalBytes} bytes) to ${siteRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
