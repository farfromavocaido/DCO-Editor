import { test } from 'vitest';
import assert from 'node:assert/strict';

import { outlineFittedText, loadMuseoFont } from '../text-outline';
import { readCreativeDocumentForCampaign } from '../creative-document';
import { renderStudioReadyHtml, buildClientPreviewPackageEntries } from '../creative-exporter';

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

test('outline export HTML bakes paths and omits Museo font-face', async () => {
  const document = await readCreativeDocumentForCampaign('sse-hiker-welcome');
  const html = await renderStudioReadyHtml(document, '300x250', { renderMode: 'outline' });
  assert.match(html, /<path /);
  assert.match(html, /outlined-text/);
  assert.match(html, /offers-2 tc-prices/);
  assert.match(html, /hiker_300x250\.jpg/);
  assert.doesNotMatch(html, /@font-face/);
  assert.doesNotMatch(html, /Museo700-Regular\.otf/);
});

test('outline client package omits OTF and uses campaign export slug', async () => {
  const document = await readCreativeDocumentForCampaign('sse-keepyuppy-discount');
  const entries = await buildClientPreviewPackageEntries(document, { renderMode: 'outline' });
  assert.ok(entries.some((entry) => entry.path === 'ads/html/SSE_KeepyUppy_Discount_300x250.html'));
  assert.ok(!entries.some((entry) => String(entry.path).endsWith('.otf')));
  const htmlEntry = entries.find((entry) => entry.path.endsWith('_300x250.html'));
  assert.ok(htmlEntry);
  assert.match(String(htmlEntry.data), /<path /);
  assert.doesNotMatch(String(htmlEntry.data), /@font-face/);
});
