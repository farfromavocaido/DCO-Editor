import { test } from 'vitest';
import assert from 'node:assert/strict';

import { outlineFittedText, loadMuseoFont } from '../text-outline';
import { readCreativeDocumentForCampaign } from '../creative-document';
import {
  renderStudioReadyHtml,
  buildClientPreviewPackageEntries,
  buildHtmlExportZip,
} from '../creative-exporter';

test('loads Museo and outlines fitted text as SVG paths', async () => {
  const font = await loadMuseoFont();
  assert.ok(font);
  const outlined = await outlineFittedText({
    text: 'Switch Now',
    fontSize: 18,
    width: 120,
    height: 40,
    color: '#0B1C2C',
  });
  assert.match(outlined.svg, /<path /);
  assert.doesNotMatch(outlined.svg, /<text /);
  assert.ok(outlined.fontSize <= 18);
});

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
  // Authored lineHeight 1.25 × fontSize 26 × 3 wrapped lines = 97.5 (not 1.05 → 81.9).
  const headlineSvg = html.match(/id="headline-act1"[^>]*>[\s\S]*?<svg[^>]*height="([\d.]+)"/);
  assert.ok(headlineSvg);
  assert.ok(
    Math.abs(Number(headlineSvg[1]) - 97.5) < 0.05,
    `headline SVG height should use lineHeight 1.25, got ${headlineSvg[1]}`,
  );
});

test('outline export honors 320x50 endframe headline white override', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const html = await renderStudioReadyHtml(document, '320x50', { renderMode: 'outline' });
  assert.match(
    html,
    /id="headline-act4"[^>]*>[\s\S]*?<g fill="rgb\(255, 255, 255\)"/,
    'act4 must bake white (layer.base.color), not brand navy',
  );
  assert.match(html, /id="headline-act1"[^>]*>[\s\S]*?<g fill="rgb\(0, 41, 117\)"/);
});

test('outlineFittedText respects authored lineHeight', async () => {
  const spaced = await outlineFittedText({
    text: 'A different kind of energy',
    fontSize: 26,
    width: 138,
    lineHeight: 1.25,
    wrap: true,
    maxLines: 3,
    allowShrink: false,
  });
  const height = Number(spaced.svg.match(/height="([\d.]+)"/)?.[1] || 0);
  assert.equal(spaced.lines.length, 3);
  assert.ok(Math.abs(height - 26 * 1.25 * 3) < 0.05, `expected 97.5, got ${height}`);
});

test('outlineFittedText honors hard newlines with the same line box as soft wrap', async () => {
  const hard = await outlineFittedText({
    text: 'A different kind\nof energy',
    fontSize: 26,
    width: 400,
    lineHeight: 1.25,
    wrap: true,
    maxLines: 3,
    allowShrink: false,
  });
  assert.deepEqual(hard.lines, ['A different kind', 'of energy']);
  const height = Number(hard.svg.match(/height="([\d.]+)"/)?.[1] || 0);
  assert.ok(Math.abs(height - 26 * 1.25 * 2) < 0.05, `expected 65, got ${height}`);
});

test('outlineFittedText soft-wraps each hard-break segment and caps maxLines', async () => {
  const mixed = await outlineFittedText({
    text: 'A different kind\nof energy for everyone',
    fontSize: 26,
    width: 138,
    lineHeight: 1.25,
    wrap: true,
    maxLines: 3,
    allowShrink: false,
  });
  assert.equal(mixed.lines.length, 3, 'maxLines caps hard+soft output');
  // First hard segment soft-wraps at this width (same as soft-only "A different kind…").
  assert.equal(mixed.lines[0], 'A different');
  assert.ok(mixed.lines.some((line) => /\bof\b/.test(line)), 'second hard segment still present');
  const height = Number(mixed.svg.match(/height="([\d.]+)"/)?.[1] || 0);
  assert.ok(
    Math.abs(height - 26 * 1.25 * 3) < 0.05,
    `height should be lineBox × 3, got ${height}`,
  );
});

test('outlineFittedText collapses newlines when wrap is disabled', async () => {
  const single = await outlineFittedText({
    text: 'A different kind\nof energy',
    fontSize: 18,
    width: 400,
    wrap: false,
    allowShrink: false,
  });
  assert.deepEqual(single.lines, ['A different kind of energy']);
});

test('outlineFittedText scales offer %/£/€ symbols to 0.6em with ink-bottom align', async () => {
  const font = await loadMuseoFont();
  const fontSize = 60;
  const outlined = await outlineFittedText({
    text: '10%',
    fontSize,
    width: 200,
    height: 60,
    lineHeight: 0.85,
    textAlign: 'left',
    allowShrink: false,
    lockMetrics: true,
    scaleOfferSymbols: true,
  });
  assert.match(outlined.svg, /<path /);
  assert.doesNotMatch(outlined.svg, /NaN/);
  // Symbol at 0.6em: % advance ≈ 0.6 × same glyph at full size.
  const full = font.getAdvanceWidth('%', fontSize);
  const scaled = font.getAdvanceWidth('%', fontSize * 0.6);
  assert.ok(Math.abs(scaled / full - 0.6) < 0.001);
  // Scaled run must be narrower than drawing % at full size beside digits.
  const mixed = font.getAdvanceWidth('10', fontSize) + scaled;
  const unscaled = font.getAdvanceWidth('10%', fontSize);
  assert.ok(mixed < unscaled - 1, `0.6em % should tighten the run (${mixed} vs ${unscaled})`);

  const pound = await outlineFittedText({
    text: '£60',
    fontSize,
    width: 200,
    allowShrink: false,
    lockMetrics: true,
    scaleOfferSymbols: true,
  });
  assert.doesNotMatch(pound.svg, /NaN/);
});

test('outlineFittedText respects locked snapshot letterSpacing without refitting', async () => {
  const locked = await outlineFittedText({
    text: 'WELCOME',
    fontSize: 18,
    width: 40,
    letterSpacingEm: -0.04,
    lockMetrics: true,
    allowShrink: false,
  });
  assert.equal(locked.fontSize, 18);
  assert.equal(locked.letterSpacingEm, -0.04);
});

test('outlineFittedText applies CSS half-leading for tight lineHeight', async () => {
  // Offer values use lineHeight 0.85 — without half-leading, Museo ascender (~63px
  // at 67px) sits below the 57px host and overlaps the subline at top:67.
  const font = await loadMuseoFont();
  const fontSize = 67;
  const lineHeight = 0.85;
  const outlined = await outlineFittedText({
    text: '10%',
    fontSize,
    width: 137,
    height: 57,
    lineHeight,
    textAlign: 'center',
    allowShrink: false,
  });
  const height = Number(outlined.svg.match(/height="([\d.]+)"/)?.[1] || 0);
  assert.ok(Math.abs(height - fontSize * lineHeight) < 0.05, `line box height, got ${height}`);

  const ascender = (font.ascender / font.unitsPerEm) * fontSize;
  const descender = (font.descender / font.unitsPerEm) * fontSize;
  const lineBox = fontSize * lineHeight;
  const halfLeading = (lineBox - (ascender - descender)) / 2;
  const cssBaseline = ascender + halfLeading;
  assert.ok(cssBaseline < 55, `half-leading baseline should be ~51, got ${cssBaseline}`);
  assert.ok(ascender > 60, `raw ascender still ~63 for contrast, got ${ascender}`);

  // Inspect opentype path Ys at the CSS baseline — ink must stay inside the line box.
  const glyph = font.stringToGlyphs('10%')[0];
  const path = glyph.getPath(0, cssBaseline, fontSize);
  let maxY = -Infinity;
  for (const cmd of path.commands) {
    for (const key of ['y', 'y1', 'y2']) {
      if (typeof cmd[key] === 'number') maxY = Math.max(maxY, cmd[key]);
    }
  }
  assert.ok(maxY <= lineBox + 0.5, `digit ink should stay in the ${lineBox}px line box, maxY=${maxY}`);
});

test('outlineFittedText avoids opentype.js NaN path crumbs on Museo glyphs', async () => {
  // These glyphs hit float crumbs (e.g. 9.000000000000002) that make stock
  // opentype toSVG emit "LNaN …" without pre-quantization.
  for (const text of ['WELCOME CREDIT*', 'Save up to', '€1,080', 'WRP0']) {
    const outlined = await outlineFittedText({
      text,
      fontSize: 18,
      width: 400,
      height: 40,
      color: '#FFFFFF',
    });
    assert.doesNotMatch(outlined.svg, /NaN/, `expected no NaN in outlined "${text}"`);
    assert.match(outlined.svg, /<path /);
  }
});

test('outline export HTML bakes paths, inlines SVGs, and omits Museo font-face', async () => {
  const document = await readCreativeDocumentForCampaign('sse-hiker-welcome');
  const html = await renderStudioReadyHtml(document, '300x250', { renderMode: 'outline' });
  assert.match(html, /<path /);
  assert.match(html, /outlined-text/);
  assert.match(html, /offers-2 tc-prices/);
  assert.match(html, /hiker_300x250\.jpg/);
  assert.match(html, /id="logo-act1"[^>]*src="data:image\/svg\+xml/);
  assert.match(html, /id="plus-1"[^>]*src="data:image\/svg\+xml/);
  assert.doesNotMatch(html, /src="(?:\.\.\/)?assets\/SVG\//);
  assert.doesNotMatch(html, /NaN/);
  assert.doesNotMatch(html, /@font-face/);
  assert.doesNotMatch(html, /Museo700-Regular\.otf/);
  // Animations stay paused until .motion-ready — outline runtime must release it.
  assert.match(html, /\.stage:not\(\.motion-ready\)/);
  assert.match(html, /classList\.add\('motion-ready'\)/);
  assert.match(html, /data-offer-plus-layout="manual"/);
});

test('non-DCO outline export ignores snapshotted plus/slot XY (manual pluses)', async () => {
  const document = await readCreativeDocumentForCampaign('sse-hiker-welcome');
  assert.equal(document.campaign?.offerPlusLayout, 'manual');
  const html = await renderStudioReadyHtml(document, '300x250', {
    renderMode: 'outline',
    presentationSnapshot: {
      size: '300x250',
      texts: {},
      positions: {
        'plus-1': { key: 'plus-1', left: 144.578, top: 111.838 },
        offer1: { key: 'offer1', left: 11.875, top: 82 },
      },
    },
  });
  const plusTag = html.match(/id="plus-1"[^>]*>/)?.[0] || '';
  assert.match(plusTag, /id="plus-1"/);
  assert.doesNotMatch(plusTag, /style="/);
  const offerTag = html.match(/id="offer1"[^>]*>/)?.[0] || '';
  assert.doesNotMatch(offerTag, /style="/);
  // Authored offers-2 plus CSS still present for designers to edit.
  assert.match(html, /\.offers-2\s+\.plus-1\s*\{[^}]*left:\s*151px/);
});

test('outline HTML export ZIP includes background assets beside the HTML', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const { zip, result } = await buildHtmlExportZip(document, { renderMode: 'outline' });
  assert.ok(result.sidecarAssets?.includes('assets/keepyuppy/keepyuppy_970x250.jpg'));
  assert.ok(!result.sidecarAssets?.some((assetPath: string) => assetPath.includes('/SVG/')));
  assert.ok(zip.length > 1000);
  const html = await renderStudioReadyHtml(document, '970x250', { renderMode: 'outline' });
  assert.doesNotMatch(html, /NaN/);
  assert.match(html, /assets\/keepyuppy\/keepyuppy_970x250\.jpg/);
});

test('static delivery strips Studio shell, flattens assets, and prunes inactive layers', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-welcome');
  const html = await renderStudioReadyHtml(document, '160x600', {
    renderMode: 'outline',
    delivery: 'static',
  });
  assert.doesNotMatch(html, /Enabler\.js/);
  assert.doesNotMatch(html, /Enabler\.exit/);
  assert.doesNotMatch(html, /name="environment" content="dv360"/);
  assert.doesNotMatch(html, /data-packaged-src/);
  assert.match(html, /classList\.add\('motion-ready'\)/);
  assert.match(html, /<path /);
  assert.match(html, /src="data:image\/svg\+xml/);
  assert.match(html, /src="assets\/keepyuppy_160x600\.jpg"/);
  assert.doesNotMatch(html, /assets\/keepyuppy\//);
  assert.doesNotMatch(html, /id="roundel-frame"/);
  assert.doesNotMatch(html, /id="offer3"/);
  assert.doesNotMatch(html, /id="plus-2"/);
  assert.doesNotMatch(html, /id="TC_Solo"/);

  const { zip, result } = await buildHtmlExportZip(document, {
    renderMode: 'outline',
    delivery: 'static',
  });
  assert.ok(result.sidecarAssets?.includes('assets/keepyuppy_970x250.jpg'));
  assert.ok(!result.sidecarAssets?.some((assetPath: string) => assetPath.includes('assets/keepyuppy/')));
  assert.ok(!result.sidecarAssets?.some((assetPath: string) => assetPath.includes('/SVG/') || assetPath.endsWith('.otf')));
  assert.ok(zip.length > 1000);
});

test('outline client package omits OTF and uses campaign export slug', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-discount');
  const entries = await buildClientPreviewPackageEntries(document, { renderMode: 'outline' });
  assert.ok(entries.some((entry) => entry.path === 'ads/html/SSE_KeepyUppy_Discount_300x250.html'));
  assert.ok(!entries.some((entry) => String(entry.path).endsWith('.otf')));
  assert.ok(
    !entries.some((entry) => String(entry.path).includes('ads/assets/SVG/')),
    'campaign SVGs are inlined into HTML, not packaged under ads/assets/SVG/',
  );
  const htmlEntry = entries.find((entry) => entry.path.endsWith('_300x250.html'));
  assert.ok(htmlEntry);
  const html = String(htmlEntry.data);
  assert.match(html, /<path /);
  assert.match(html, /src="data:image\/svg\+xml/);
  assert.doesNotMatch(html, /@font-face/);
});
