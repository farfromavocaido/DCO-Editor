// Campaign-specific comparisons; run with npm run test:creative.
import { test } from 'vitest';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

import { captureProductionPresentation } from '../production-snapshot';
import { outlineFittedText, loadMuseoFont } from '../text-outline';
import { readCreativeDocumentForCampaign } from '../creative-document';
import {
  renderStudioReadyHtml,
  renderWipHtml,
  buildClientPreviewPackageEntries,
  buildHtmlExportZip,
} from '../creative-exporter';

/** List store-only zip local entry names (matches createZipBuffer). */
const listStoredZipPaths = (buf: Buffer) => {
  const paths: string[] = [];
  const entries: Array<{ name: string; data: Buffer }> = [];
  let i = 0;
  while (i + 30 <= buf.length) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const compSize = buf.readUInt32LE(i + 18);
    const name = buf.subarray(i + 30, i + 30 + nameLen).toString();
    const dataStart = i + 30 + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    paths.push(name);
    entries.push({ name, data });
    i = dataStart + compSize;
  }
  return { paths, entries };
};

test('outline export uses brand navy for headlines/offers and keeps CTA white', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const html = await renderStudioReadyHtml(document, '160x600', { renderMode: 'outline' });
  assert.match(html, /id="headline-act1"[^>]*>[\s\S]*?<g fill="rgb\(0, 41, 117\)"/);
  assert.match(html, /offer-value outlined-text">[\s\S]*?<g fill="rgb\(0, 41, 117\)"/);
  assert.match(html, /id="cta"[^>]*>[\s\S]*?<g fill="rgb\(255, 255, 255\)"/);
  assert.match(html, /\.outlined-text svg \{[\s\S]*?height:\s*auto/);
  assert.match(html, /\.cta\.outlined-text \{[\s\S]*?padding:\s*0/);
  // Offer hosts must not hard-clip: SVG line-box can exceed authored height
  // (e.g. 65×0.85=55 inside a 48px box) and font-mode lets that ink paint.
  assert.doesNotMatch(html, /\[data-gwd-group="OfferSlot"\] \.outlined-text \{[\s\S]*?overflow:\s*hidden/);
  const ctaSvg = html.match(/id="cta"[^>]*>[\s\S]*?<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/);
  assert.ok(ctaSvg);
  assert.equal(Number(ctaSvg[1]), 130, 'CTA SVG width matches authored box (no padding shrink)');
  assert.ok(Number(ctaSvg[2]) < 40, `CTA SVG should be content-tight, got height=${ctaSvg[2]}`);
  // Authored lineHeight 1.25 × fontSize 26 × 4 wrapped lines = 130
  // ("Our highest welcome credit"; was 3 lines / 97.5 for the old energy H1).
  const headlineSvg = html.match(/id="headline-act1"[^>]*>[\s\S]*?<svg[^>]*height="([\d.]+)"/);
  assert.ok(headlineSvg);
  assert.ok(
    Math.abs(Number(headlineSvg[1]) - 130) < 0.05,
    `headline SVG height should use lineHeight 1.25, got ${headlineSvg[1]}`,
  );
});
