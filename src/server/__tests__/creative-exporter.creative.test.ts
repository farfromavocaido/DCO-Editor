// Opt-in checks of the current campaign artwork, not renderer contracts.
import {test} from 'vitest';
import assert from 'node:assert/strict';
import {readCreativeDocument} from '../creative-document';
import {renderStudioReadyHtml} from '../creative-exporter';

test('exports offers-0 headline scrim gradient above bg and below waves', async () => {
  const document = await readCreativeDocument();
  const htmlPortrait = await renderStudioReadyHtml(document, '300x250');
  const htmlLandscape = await renderStudioReadyHtml(document, '320x50');

  assert.match(htmlPortrait, /id="headline-scrim"/);
  assert.match(htmlPortrait, /linear-gradient\(to top, rgba\(0, 0, 0,/);
  assert.match(htmlPortrait, /\.offers-0 \.headline-scrim\s*\{[^}]*visibility:\s*visible/);
  assert.match(htmlPortrait, /\.headline-scrim\s*\{[^}]*visibility:\s*hidden/);

  assert.match(htmlLandscape, /linear-gradient\(to top, rgba\(0, 0, 0,/);

  const size = document.sizes['300x250'];
  const byId = Object.fromEntries(size.layers.map((layer) => [layer.id, layer]));
  assert.equal(byId['headline-scrim'].kind, 'gradient');
  assert.ok(byId['headline-scrim'].zIndex > byId['bg-image'].zIndex);
  assert.ok(byId.bluewave.zIndex > byId['headline-scrim'].zIndex);
});

test('exports offers-0 background blur layer but keeps it hidden', async () => {
  const document = await readCreativeDocument();
  const html = await renderStudioReadyHtml(document, '300x250');
  const htmlBanner = await renderStudioReadyHtml(document, '320x50');

  assert.match(html, /id="bg-blur"/);
  assert.match(html, /backdrop-filter:\s*blur\(3px\)/);
  assert.match(html, /-webkit-backdrop-filter:\s*blur\(3px\)/);
  assert.match(html, /\.offers-0 \.bg-blur\s*\{[^}]*visibility:\s*hidden/);

  assert.match(htmlBanner, /id="bg-blur"/);

  const size = document.sizes['300x250'];
  const byId = Object.fromEntries(size.layers.map((layer) => [layer.id, layer]));
  assert.equal(byId['bg-blur'].kind, 'blur');
  assert.ok(byId['bg-blur'].zIndex > byId['bg-image'].zIndex);
  assert.ok(byId['headline-scrim'].zIndex > byId['bg-blur'].zIndex);
  assert.ok(byId.bluewave.zIndex > byId['bg-blur'].zIndex);
});

test('exports uniform bottom-aligned tracking rules for pricing blocks', async () => {
  const document = await readCreativeDocument();
  const html = await renderStudioReadyHtml(document, '320x50');

  assert.match(html, /"cssClass":"offer-value","shared":true/);
  assert.match(html, /"tracking":\{"minEm":-0\.05\}/);
  assert.match(html, /"align":"bottom"/);
  assert.match(html, /"minFontSizeRatio":0\.5/);
  assert.match(html, /"cssClass":"offer-subline","shared":true/);
});
