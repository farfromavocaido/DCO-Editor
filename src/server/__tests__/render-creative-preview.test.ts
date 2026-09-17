import { expect, test } from 'vitest';
import { renderCreativePreviewHtml } from '@/server/render-creative-preview';
import { renderStudioReadyHtml, renderWipHtml } from '@/server/creative-exporter';
import { readCreativeDocument } from '@/server/creative-document';
import { CDN_FONT_URLS } from '@/lib/brand-font';
import { POST } from '@/app/api/creative/[size]/view/route';

test('preview is exactly production output with the supplied active feed row', async () => {
  const document = await readCreativeDocument() as Record<string, any>;
  const row = { ...document.feed.sampleRows[0], heading1_text: 'Production parity sample' };
  const fontUrlMap = document.fonts === undefined
    ? CDN_FONT_URLS
    : Object.fromEntries(document.fonts.map((face) => [face.asset.split('/').at(-1), face.cdnUrl]));
  const expected = renderWipHtml(await renderStudioReadyHtml(document, '300x250', {assetBasePath:'/', fontUrlMap}), row);
  expect(await renderCreativePreviewHtml('300x250', {document, row})).toBe(expected);
});

test('POST rejects a malformed document before attempting a production render', async () => {
  const response = await POST(new Request('http://localhost/api/creative/300x250/view', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ document: [] }),
  }), { params: Promise.resolve({size:'300x250'}) });
  expect(response.status).toBe(400);
});

test('GET view resolves a campaign ID through its registry instead of treating it as a path', async () => {
  const { GET } = await import('@/app/api/creative/[size]/view/route');
  const response = await GET(new Request('http://localhost/api/creative/300x250/view?campaign=sse-hiker-welcome'), { params: Promise.resolve({size:'300x250'}) });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Hiker');
});

test('outline view uses actual SVG export with the selected nondefault row', async () => {
  const document = await readCreativeDocument() as Record<string, any>;
  const row = { ...document.feed.sampleRows[2], Default:false, offer_count_num:3, heading1_text:'Selected outline sample' };
  const response = await POST(new Request('http://localhost/api/creative/300x250/view', {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({document,row,renderMode:'outline'}),
  }), {params:Promise.resolve({size:'300x250'})});
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html.includes('outlined-text')).toBe(true);
  expect(html).toContain('<path');
  expect(html).not.toContain('@font-face');
  expect(html).not.toContain('Museo700-Regular.otf');
  expect(html).toContain('stage page-content offers-3');
  expect(html.includes('window.__SSE_DCO_PREVIEW__ =')).toBe(false);
}, 30000);
