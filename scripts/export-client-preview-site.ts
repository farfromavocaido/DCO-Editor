import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExportPreviewLatest } from '../src/server/creative-exporter';
import { outputsRoot } from '../src/server/paths';
import { wrapPreviewSiteWithPasswordGate } from './preview-site-password-gate';
import { renderDcoAgencyPreviewPage } from './render-dco-agency-preview-page';
import { renderStaticsPreviewPage } from './render-statics-preview-page';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.resolve(appRoot, 'site');
const DCO_CAMPAIGN_ID = 'sse-dco';

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

const copyBrandAssets = async () => {
  await writeEntry(
    'brand/BGlogo_SVG.svg',
    await fs.readFile(path.resolve(appRoot, 'public/BGlogo_SVG.svg')),
  );
  await writeEntry(
    'brand/SSELogoWhite.svg',
    await fs.readFile(path.resolve(appRoot, 'public/SSELogoWhite.svg')),
  );
};

const readLatest = async (): Promise<ExportPreviewLatest | null> => {
  try {
    return JSON.parse(await fs.readFile(path.resolve(outputsRoot, 'latest.json'), 'utf8')) as ExportPreviewLatest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return null;
  }
};

const renderDcoPlaceholderPage = () => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SSE DCO preview</title>
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
    <main>
      <h1>DCO preview</h1>
      <p>No committed Canonical Agency package yet. In the editor, run <strong>Export for Preview</strong>, commit <code>outputs/</code>, and push to publish the agency HTML + ZIP here.</p>
      <p style="margin-top:14px"><a href="statics/">Statics preview</a></p>
    </main>
  </body>
</html>`;

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

const exportDcoAgencyPreviewSite = async (latest: ExportPreviewLatest | null) => {
  const dcoDir = path.resolve(outputsRoot, 'campaigns', DCO_CAMPAIGN_ID);
  const hasDcoPackage = Boolean(
    latest?.dco?.sizes?.length
    && latest.dcoZip
    && await fs.access(dcoDir).then(() => true).catch(() => false),
  );

  if (!hasDcoPackage || !latest) {
    if (process.env.STRICT_STATICS_EXPORT === '1') {
      throw new Error(
        'outputs/campaigns/sse-dco is missing. Run Export for Preview in the editor, commit outputs/, then re-export the Pages site.',
      );
    }
    console.warn('outputs/ has no DCO agency package yet — writing placeholder root page');
    const gatedPlaceholder = wrapPreviewSiteWithPasswordGate(renderDcoPlaceholderPage(), {
      kicker: 'SSE Airtricity',
      title: 'DCO preview',
      copy: 'Enter the preview password to continue.',
    });
    await writeEntry('index.html', gatedPlaceholder);
    await writeEntry('.nojekyll', '');
    await copyBrandAssets();
    return;
  }

  await copyDirectory(dcoDir, siteRoot);
  await copyBrandAssets();
  await fs.copyFile(
    path.resolve(outputsRoot, 'latest.json'),
    path.resolve(siteRoot, 'latest.json'),
  );

  if (latest.dcoZip) {
    const zipSource = path.resolve(outputsRoot, latest.dcoZip);
    const zipTarget = path.resolve(siteRoot, latest.dcoZip);
    await fs.mkdir(path.dirname(zipTarget), { recursive: true });
    await fs.copyFile(zipSource, zipTarget);
  }

  const previewHtml = renderDcoAgencyPreviewPage(latest);
  const gatedIndex = wrapPreviewSiteWithPasswordGate(previewHtml, {
    kicker: 'SSE Airtricity',
    title: 'DCO preview',
    copy: 'Enter the preview password to continue.',
  });
  await writeEntry('index.html', gatedIndex);
  await writeEntry('.nojekyll', '');
};

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
  await fs.rm(siteRoot, { recursive: true, force: true });
  await fs.mkdir(siteRoot, { recursive: true });

  const latest = await readLatest();
  await exportDcoAgencyPreviewSite(latest);
  await exportStaticsPreviewSite(latest);

  let totalBytes = 0;
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.resolve(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else totalBytes += (await fs.stat(full)).size;
    }
  };
  await walk(siteRoot);

  console.log(`Exported DCO agency + statics preview site (${totalBytes} bytes) to ${siteRoot}`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
