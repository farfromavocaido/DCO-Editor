import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCreativeDocument } from '../src/server/creative-document';
import {
  buildClientPreviewPackageEntries,
  type ExportPreviewLatest,
} from '../src/server/creative-exporter';
import { outputsRoot } from '../src/server/paths';
import { wrapPreviewSiteWithPasswordGate } from './preview-site-password-gate';
import { renderStaticsPreviewPage } from './render-statics-preview-page';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, 'site');
const DCO_CAMPAIGN_ID = 'sse-dco';

/** Stable-enough stamp for iframe `?v=` — prefers CI/git SHA, else export time. */
const resolveDeployCacheBust = () => {
  const fromEnv = String(process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  if (fromEnv) return fromEnv.slice(0, 12);
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return new Date().toISOString();
  }
};

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

const readLatest = async (): Promise<ExportPreviewLatest | null> => {
  try {
    return JSON.parse(await fs.readFile(path.resolve(outputsRoot, 'latest.json'), 'utf8')) as ExportPreviewLatest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return null;
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
      <p>No committed package yet. In the editor, run <strong>Sync Zips</strong>, commit <code>outputs/</code>, and push to publish the HTML + ZIP here.</p>
      <p style="margin-top:14px"><a href="../">DCO preview</a></p>
    </main>
  </body>
</html>`;

const exportStaticsPreviewSite = async (latest: ExportPreviewLatest | null) => {
  const campaignsDir = path.resolve(outputsRoot, 'campaigns');
  const latestPath = path.resolve(outputsRoot, 'latest.json');
  const staticsRoot = path.resolve(siteRoot, 'statics');
  await fs.rm(staticsRoot, { recursive: true, force: true });
  await fs.mkdir(staticsRoot, { recursive: true });

  let campaignEntries: string[] = [];
  try {
    campaignEntries = (await fs.readdir(campaignsDir)).filter((name) => name !== DCO_CAMPAIGN_ID);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const hasPackage = Boolean(campaignEntries.length && latest?.campaigns?.length && latest.zip);
  if (!hasPackage || !latest) {
    if (process.env.STRICT_STATICS_EXPORT === '1') {
      throw new Error(
        'outputs/campaigns is empty. Run Sync Zips in the editor, commit outputs/, then re-export the Pages site.',
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

  for (const campaignId of campaignEntries) {
    await copyDirectory(
      path.resolve(campaignsDir, campaignId),
      path.resolve(staticsRoot, 'campaigns', campaignId),
    );
  }

  if (latest.zip) {
    const zipSource = path.resolve(outputsRoot, latest.zip);
    const zipTarget = path.resolve(staticsRoot, latest.zip);
    await fs.mkdir(path.dirname(zipTarget), { recursive: true });
    await fs.copyFile(zipSource, zipTarget);
  }
  await fs.copyFile(latestPath, path.resolve(staticsRoot, 'latest.json'));

  const previewHtml = renderStaticsPreviewPage(latest);
  const gatedIndex = wrapPreviewSiteWithPasswordGate(previewHtml, {
    kicker: 'SSE Airtricity',
    title: 'Statics preview',
    copy: 'Enter the preview password to continue.',
  });
  await writeEntry('statics/index.html', gatedIndex);
};

const main = async () => {
  const document = await readCreativeDocument();
  const latest = await readLatest();
  let agencyZipHref: string | undefined;
  if (latest?.dcoZip) {
    agencyZipHref = latest.dcoZip;
  } else if (process.env.STRICT_STATICS_EXPORT === '1') {
    throw new Error(
      'outputs/latest.json is missing dcoZip. Run Sync Zips in the editor, commit outputs/, then re-export the Pages site.',
    );
  } else {
    console.warn('outputs/ has no DCO agency zip yet — DCO preview download button omitted');
  }

  // Museo from Studio CDN; SVGs inlined like Canonical Agency Zip; deploy stamp busts iframe cache.
  const cacheBust = resolveDeployCacheBust();
  const entries = await buildClientPreviewPackageEntries(document, {
    includeValidator: false,
    assetMode: 'cdn',
    inlineSvgs: true,
    cacheBust,
    ...(agencyZipHref ? { agencyZipHref } : {}),
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

  if (agencyZipHref && latest?.dcoZip) {
    const zipSource = path.resolve(outputsRoot, latest.dcoZip);
    const zipTarget = path.resolve(siteRoot, latest.dcoZip);
    await fs.mkdir(path.dirname(zipTarget), { recursive: true });
    await fs.copyFile(zipSource, zipTarget);
    totalBytes += (await fs.stat(zipTarget)).size;
  }

  const gatedIndex = wrapPreviewSiteWithPasswordGate(previewHtml);
  totalBytes += Buffer.byteLength(gatedIndex);
  await writeEntry('index.html', gatedIndex);
  await writeEntry('.nojekyll', '');

  await exportStaticsPreviewSite(latest);
  const staticsIndex = await fs.readFile(path.resolve(siteRoot, 'statics/index.html'));
  totalBytes += staticsIndex.length;

  console.log(`Exported DCO + statics preview site (${totalBytes} bytes) to ${siteRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
