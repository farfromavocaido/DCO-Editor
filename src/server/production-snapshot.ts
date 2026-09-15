import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import ts from 'typescript';
import type { SizePresentationSnapshot } from '@/lib/outline-snapshot';
import { appRoot, projectRoot } from './paths';

const captureOrigin = 'http://sse-creative-capture.local';
// Compile the editor's exact collector with its helper closure. Read the source
// each time so dev-server exports cannot retain a collector from before HMR.
export async function productionSnapshotCollectorScript() {
  const source = await fs.readFile(path.join(appRoot, 'src/lib/outline-snapshot.ts'), 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  return `(function(){var exports={};${result.outputText}\nwindow.__captureProductionPresentation=exports.capturePresentationSnapshot;})()`;
}

/** Measure a fixed-copy rendition with the same browser collector as the editor. */
export async function captureProductionPresentation(html: string, size: string): Promise<SizePresentationSnapshot> {
  const [width, height] = size.split('x').map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error(`Invalid creative size: ${size}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.route(`${captureOrigin}/**`, async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/index.html') {
        await route.fulfill({ contentType: 'text/html', body: html });
        return;
      }
      let pathname: string;
      try { pathname = decodeURIComponent(url.pathname); } catch { await route.fulfill({ status: 400, body: '' }); return; }
      const marker = pathname.indexOf('/assets/');
      const relative = marker >= 0 ? pathname.slice(marker + 1) : pathname.replace(/^\/+/, '');
      const assetPath = path.resolve(projectRoot, relative);
      if (!assetPath.startsWith(`${path.resolve(projectRoot)}${path.sep}`)) {
        await route.fulfill({ status: 403, body: '' });
        return;
      }
      try { await route.fulfill({ path: assetPath }); }
      catch { await route.fulfill({ status: 404, body: '' }); }
    });
    // The local preview adapter supplies the row; Studio's network/click adapter
    // is unnecessary for measurement and may not be available offline.
    await page.route('https://s0.2mdn.net/ads/studio/Enabler.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    await page.goto(`${captureOrigin}/index.html`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => {
      const failed = Array.from(document.images).find(img => img.complete && img.src && img.naturalWidth === 0);
      if (failed) throw new Error(`Creative image failed to load: ${failed.getAttribute('src')}`);
      const fontFailure = document.fonts && Array.from(document.fonts).some(font => font.status === 'error');
      if (fontFailure) throw new Error('Creative font failed to load');
      return document.querySelector('.stage.motion-ready') && (!document.fonts || document.fonts.status === 'loaded') && Array.from(document.images).every(img => img.complete);
    }, undefined, { timeout: 20000 });
    await page.addScriptTag({ content: await productionSnapshotCollectorScript() });
    // Snapshot rest geometry while retaining fit's content alignment transforms.
    // Pausing at t=0 alone leaves enter scales/translations on the elements.
    const result = await page.evaluate((captureSize) => {
      const stage = document.querySelector<HTMLElement>('.stage')!;
      for (const animation of document.getAnimations()) animation.cancel();
      const style = document.createElement('style');
      style.textContent = '.stage *, .stage { animation: none !important; }';
      document.head.appendChild(style);
      return (window as unknown as { __captureProductionPresentation: (stage: HTMLElement, size: string) => SizePresentationSnapshot }).__captureProductionPresentation(stage, captureSize);
    }, size);
    return result;
  } finally {
    await browser.close();
  }
}
