import { test } from 'vitest';
import assert from 'node:assert/strict';

import { GET as feedGet } from '@/app/api/feed-schema/route';
import { GET as creativeGet } from '@/app/api/creative/route';
import { POST as creativeExportAllPost } from '@/app/api/creative/export/route';
import { POST as clientPackagePost } from '@/app/api/creative/client-package/route';
import { POST as basePackagePost } from '@/app/api/creative/base-package/route';
import { POST as creativeExportPost } from '@/app/api/creative/[size]/export/route';
import * as creativeViewRoute from '@/app/api/creative/[size]/view/route';
import * as creativeSourceRoute from '@/app/api/creative/[size]/source/route';
import { readCreativeDocument } from '@/server/creative-document';

const CDN_FONT_URL = 'https://s0.2mdn.net/creatives/assets/5627648/MuseoSans_700.otf';
const CDN_LOGO_URL = 'https://s0.2mdn.net/creatives/assets/5627651/SSELogoBlue.svg';

const truthyFeedBool = (value: unknown) => value === true
  || ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

const expectedStatePatternForRow = (row: Record<string, unknown>) => {
  const offerCount = Number(row.offer_count_num) || 1;
  const tcScope = row.tc_type_enum === 'tcs_units' ? 'tc-prices' : 'tc-solo';
  const includeRoundel = truthyFeedBool(row.include_roundel_frame_bool);
  const ctaScope = includeRoundel || ['rectangle', 'rect'].includes(String(row.cta_type_enum || ''))
    ? 'cta-rect'
    : 'cta-roundel';
  const frameScope = includeRoundel ? 'frames-4 roundel-frame-on' : 'frames-3 roundel-frame-off';
  const roundelCopyScope = includeRoundel && String(row.roundel_value_text || '').trim()
    ? 'roundel-split'
    : 'roundel-copy-only';
  return new RegExp(`offers-${offerCount} ${tcScope} ${ctaScope} ${frameScope} ${roundelCopyScope}`);
};

test('GET /api/feed-schema returns profile rows', async () => {
  const response = await feedGet();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.profileName);
  assert.ok(Array.isArray(payload.rows));
  assert.ok(Array.isArray(payload.fields));
});

test('GET /api/creative returns creative document', async () => {
  const response = await creativeGet();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.version, 1);
  assert.ok(payload.sizes['970x250']);
  assert.ok(payload.sizes['970x250'].layers.some((layer) => layer.id === 'logo-act3'));
});

test('POST /api/creative/[size]/export builds with replacement exporter', async () => {
  const response = await creativeExportPost(new Request('http://localhost/api/creative/970x250/export', {
    method: 'POST',
  }), {
    params: Promise.resolve({ size: '970x250' }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.code, 0);
  assert.match(payload.stdout, /replacement exporter/);
  assert.ok(Object.keys(payload.wip).length > 0);
});

test('GET /api/creative/[size]/view returns Studio-ready HTML preview', async () => {
  const response = await creativeViewRoute.GET(new Request('http://localhost/api/creative/970x250/view'), {
    params: Promise.resolve({ size: '970x250' }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  const html = await response.text();
  assert.match(html, /<title>SSE DCO 970x250<\/title>/);
  assert.match(html, /window\.applySseDcoRuntimeState/);
  assert.match(html, /id="sse-dco-preview-feed"/);
  assert.match(html, /single_elec15_solo_roundel/);
  const document = await readCreativeDocument();
  const sample = document.feed.sampleRows[0] || {};
  assert.match(html, expectedStatePatternForRow(sample));
  assert.match(html, /src="\/assets\//);
  assert.doesNotMatch(html, /src="assets\//);
  assert.doesNotMatch(html, /__next/);
});

test('GET /api/creative/[size]/source returns formatted highlighted HTML source', async () => {
  const response = await creativeSourceRoute.GET(new Request('http://localhost/api/creative/970x250/source'), {
    params: Promise.resolve({ size: '970x250' }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.size, '970x250');
  assert.ok(payload.lineCount > 100);
  assert.ok(payload.byteLength > 1000);
  assert.match(payload.html, /<title>SSE DCO 970x250<\/title>/);
  assert.match(payload.html, /data-dco-field="heading1_text"/);
  assert.match(payload.html, /data-dco-field="background_image_url_970x250"/);
  assert.doesNotMatch(payload.html, /window\.__SSE_DCO_PREVIEW__\s*=/);
  assert.doesNotMatch(payload.html, /id="sse-dco-preview-feed"/);
  assert.match(payload.html, /\n  <head>\n/);
  assert.match(payload.highlightedHtml, /class="shiki github-dark"/);
  assert.match(payload.highlightedHtml, /SSE DCO 970x250/);
});

test('POST /api/creative/[size]/view bakes current editor row into standalone HTML preview', async () => {
  const document = await readCreativeDocument();
  const row = {
    ...document.feed.sampleRows.find((sample) => Number(sample.offer_count_num) === 2),
    offer_count_num: 2,
    offer1_value_text: '99%',
    offer1_sub_text: 'OFF TEST POWER*',
    tc_type_enum: 'tcs_units',
    cta_type_enum: 'rectangle',
  };

  const response = await (creativeViewRoute as any).POST(new Request('http://localhost/api/creative/300x600/view', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ document, row }),
  }), {
    params: Promise.resolve({ size: '300x600' }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  const html = await response.text();
  assert.match(html, /window\.__SSE_DCO_PREVIEW__/);
  assert.match(html, /99%/);
  assert.match(html, /OFF TEST POWER\*/);
  assert.match(html, /offers-2 tc-prices cta-rect/);
  assert.match(html, /src="\/assets\//);
  assert.doesNotMatch(html, /__next/);
});

test('POST /api/creative/export builds all replacement creative sizes', async () => {
  const response = await creativeExportAllPost(new Request('http://localhost/api/creative/export', {
    method: 'POST',
  }));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.code, 0);
  assert.equal(Object.keys(payload.outputs).length, 6);
  assert.ok(Object.keys(payload.outputs['320x50'].wip).length > 0);
  assert.ok(Object.keys(payload.outputs['728x90'].wip).length > 0);
  assert.ok(Object.keys(payload.outputs['970x250'].wip).length > 0);
  assert.match(payload.stdout, /Built 6 sizes with replacement exporter/);
});

test('POST /api/creative/client-package returns a downloadable zip', async () => {
  const response = await clientPackagePost(new Request('http://localhost/api/creative/client-package', {
    method: 'POST',
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/zip/);
  assert.match(response.headers.get('content-disposition') || '', /SSE_DCO_client_preview_package_validated\.zip/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString('binary'), 'PK\u0003\u0004');
  assert.ok(bytes.includes(Buffer.from('preview-page.html')));
  assert.ok(bytes.includes(Buffer.from('ads/html/SSE_DCO_728x90.html')));
  assert.ok(!bytes.includes(Buffer.from('mapping.txt')));
});

test('POST /api/creative/client-package can omit the copy validator', async () => {
  const response = await clientPackagePost(new Request('http://localhost/api/creative/client-package', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ includeValidator: false }),
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', /SSE_DCO_client_preview_package\.zip/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.includes(Buffer.from('preview-page.html')));
  assert.ok(bytes.includes(Buffer.from('ads/html/SSE_DCO_728x90.html')));
  assert.ok(!bytes.includes(Buffer.from('preview-validator.js')));
  assert.ok(!bytes.includes(Buffer.from('__SSE_DCO_CLIENT_PREVIEW__')));
});

test('POST /api/creative/base-package returns the agency upload zip', async () => {
  const response = await basePackagePost(new Request('http://localhost/api/creative/base-package', {
    method: 'POST',
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/zip/);
  assert.match(response.headers.get('content-disposition') || '', /SSE_DCO_base_zip\.zip/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 4).toString('binary'), 'PK\u0003\u0004');
  assert.ok(bytes.includes(Buffer.from('mapping.txt')));
  assert.ok(bytes.includes(Buffer.from('background_image_url_728x90')));
  assert.ok(bytes.includes(Buffer.from('ads/728x90/index.html')));
  assert.ok(bytes.includes(Buffer.from('Enabler.setProfileId(10960467)')));
  assert.ok(bytes.includes(Buffer.from('devDynamicContent.SSE_ROI_Delivery')));
  assert.ok(!bytes.includes(Buffer.from('ads/assets/bg_728x90.jpg')));
  assert.ok(!bytes.includes(Buffer.from('preview-page.html')));
  assert.ok(!bytes.includes(Buffer.from('preview-validator.js')));
  assert.ok(!bytes.includes(Buffer.from('SSE_DCO_PREVIEW_STATE')));
  assert.ok(!bytes.includes(Buffer.from('__SSE_DCO_PREVIEW__')));
  assert.ok(!bytes.includes(Buffer.from('offers-3_tcs-units_rectangle')));
});

test('POST /api/creative/base-package can return a CDN-linked agency zip', async () => {
  const response = await basePackagePost(new Request('http://localhost/api/creative/base-package', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ assetMode: 'cdn' }),
  }));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /application\/zip/);
  assert.match(response.headers.get('content-disposition') || '', /SSE_DCO_base_cdn_zip\.zip/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.includes(Buffer.from('mapping.txt')));
  assert.ok(bytes.includes(Buffer.from('ads/728x90/index.html')));
  assert.ok(bytes.includes(Buffer.from(CDN_LOGO_URL)));
  assert.ok(!bytes.includes(Buffer.from('ads/assets/SVG/SSELogoBlue.svg')));
  assert.ok(!bytes.includes(Buffer.from('../assets/SVG/SSELogoBlue.svg')));
  // The real Museo has no Studio CDN asset, so it stays packaged in CDN mode;
  // the Museo Sans CDN file must never appear (it is a different typeface).
  assert.ok(bytes.includes(Buffer.from('ads/assets/fonts/Museo700-Regular.otf')));
  assert.ok(!bytes.includes(Buffer.from(CDN_FONT_URL)));
  assert.ok(!bytes.includes(Buffer.from('MuseoSans_700.otf')));
});
