import { test } from 'vitest';
import assert from 'node:assert/strict';

import { readCreativeDocument } from '../creative-document';
import {
  buildBasePackageEntries,
  buildClientPreviewPackageEntries,
  createZipBuffer,
  renderClientPreviewPage,
  renderStudioReadyHtml,
  renderWipHtml,
} from '../creative-exporter';

const legacyFieldPattern = (parts: string[]) => new RegExp(parts.join('_'));

const CDN_MUSEO_URL = 'https://s0.2mdn.net/creatives/assets/5627648/Museo700-Regular.otf';
const CDN_MUSEO_SANS_URL = 'https://s0.2mdn.net/creatives/assets/5627648/MuseoSans_700.otf';
const CDN_SVG_URLS = [
  'https://s0.2mdn.net/creatives/assets/5627651/SSELogoBlue.svg',
  'https://s0.2mdn.net/creatives/assets/5627651/SSELogoWhite.svg',
  'https://s0.2mdn.net/creatives/assets/5627651/bluewave-wider.svg',
  'https://s0.2mdn.net/creatives/assets/5627651/bluewave.svg',
  'https://s0.2mdn.net/creatives/assets/5627651/greenwave-wider.svg',
  'https://s0.2mdn.net/creatives/assets/5627651/greenwave.svg',
];

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

test('exports custom Studio-ready HTML without GWD custom elements', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '970x250');

  assert.match(html, /https:\/\/s0\.2mdn\.net\/ads\/studio\/Enabler\.js/);
  assert.match(html, /Enabler\.exit\('Main Exit'/);
  assert.match(html, /function applyRuntimeState/);
  assert.match(html, /@keyframes logo-act3-logo-act3-fade/);
  assert.doesNotMatch(html, /<gwd-/);
  assert.doesNotMatch(html, /groups_runtime/);
});

test('exports click handling without the legacy dynamic URL field', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x600');

  assert.match(html, /Enabler\.exit\('Main Exit'\)/);
  assert.doesNotMatch(html, legacyFieldPattern(['Exit', 'URL']));
  assert.doesNotMatch(html, /exitUrlFromProfile/);
  assert.doesNotMatch(html, /window\.open\(exitUrl/);
});

test('exports production HTML with referenced dynamic fields, not baked feed rows', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x250');

  assert.match(html, /data-dco-field="heading1_text"/);
  assert.match(html, /data-dco-field="offer1_value_text"/);
  assert.match(html, /data-dco-field="tc_terms_text"/);
  assert.match(html, /data-dco-field="roundel_text_text"/);
  assert.match(html, /data-dco-field="roundel_value_text"/);
  assert.match(html, /data-dco-field="background_image_url_300x250"/);
  assert.match(html, /data-dco-state="offer_count_num,tc_type_enum,cta_type_enum,include_roundel_frame_bool,roundel_value_text"/);
  assert.match(html, /\.frames-4 #headline-act4/);
  assert.doesNotMatch(html, /window\.__SSE_DCO_PREVIEW__\s*=/);
  assert.doesNotMatch(html, /single_elec15_solo_roundel/);
});

test('exports ad html that accepts client preview post messages', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '728x90', { assetBasePath: '../' });

  assert.match(html, /window\.addEventListener\('message'/);
  assert.match(html, /SSE_DCO_PREVIEW_STATE/);
  assert.match(html, /applyRuntimeState\(event\.data\.row\)/);
  assert.match(html, /src="\.\.\/assets\/bg_728x90\.jpg"/);
});

test('preview ad html skips empty Enabler bootstrap so iframe postMessage text persists', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '160x600', { assetBasePath: '../' });

  assert.match(html, /function hasBootstrapRow\(row\)/);
  assert.match(html, /if \(!hasBootstrapRow\(row\)\) return;/);
  assert.match(html, /Client preview iframes receive feed rows via postMessage/);
  assert.doesNotMatch(html, /Enabler\.addEventListener\(studio\.events\.StudioEvent\.INIT, bootstrapRuntime\)/);
});

test('preview ad html falls back to packaged background when feed URL is blank', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '160x600', { assetBasePath: '../' });

  assert.match(html, /data-packaged-src="\.\.\/assets\/bg_160x600\.jpg"/);
  assert.match(html, /getAttribute\('data-packaged-src'\)/);
  assert.match(html, /out\.background_image_url = imageFieldValue\(row\.background_image_url\)/);
});

test('client preview page normalizes blank background feed objects to empty strings', async () => {
  const document = await readCreativeDocument();
  const html = renderClientPreviewPage(document, { includeValidator: false });

  assert.match(html, /function previewImageFieldUrl\(value\)/);
  assert.match(html, /previewImageFieldUrl\(backgroundBySize\[size\]\) \|\| ''/);
});

test('studio export still waits for Enabler init before bootstrap', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '160x600', {
    includePreviewBridge: false,
    includeStudioDynamicContent: true,
  });

  assert.match(html, /Enabler\.addEventListener\(studio\.events\.StudioEvent\.INIT, bootstrapRuntime\)/);
  assert.doesNotMatch(html, /function hasBootstrapRow\(row\)/);
});

test('exports WIP HTML with baked preview row and state classes', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x250');
  const row = {
    ...document.feed.sampleRows[0],
    include_roundel_frame_bool: true,
    roundel_text_text: 'Save up to',
    roundel_value_text: '€1,080',
  };
  assert.ok(row);
  const wip = renderWipHtml(html, row);

  assert.match(wip, /window\.__SSE_DCO_PREVIEW__/);
  assert.match(wip, expectedStatePatternForRow(row));
  assert.match(wip, /single_elec15_solo_roundel/);
});

test('builds a client preview package with html variants, assets, and self-contained preview page', async () => {
  const document = await readCreativeDocument();
  const entries = await buildClientPreviewPackageEntries(document, { includeValidator: true });
  const names = entries.map((entry) => entry.path).sort();

  assert.ok(names.includes('preview-page.html'));
  assert.ok(names.includes('ads/html/SSE_DCO_728x90.html'));
  assert.ok(names.includes('ads/html/SSE_DCO_728x90_offers-3_tcs-units_rectangle.html'));
  assert.ok(names.includes('ads/assets/bg_728x90.jpg'));
  assert.ok(names.includes('ads/assets/SVG/SSELogoBlue.svg'));
  assert.ok(names.includes('ads/assets/fonts/Museo700-Regular.otf'));
  assert.ok(!names.includes('ads/assets/fonts/MuseoSans_700.otf'), 'Museo Sans is a different typeface and must never ship');
  assert.ok(names.includes('brand/BGlogo_SVG.svg'));
  assert.ok(names.includes('brand/SSELogoWhite.svg'));
  assert.ok(names.includes('preview-validator.js'));
  assert.ok(!names.includes('mapping.txt'));

  const preview = String(entries.find((entry) => entry.path === 'preview-page.html')?.data || '');
  const validator = String(entries.find((entry) => entry.path === 'preview-validator.js')?.data || '');
  assert.match(preview, /brand\/BGlogo_SVG\.svg/);
  assert.match(preview, /brand\/SSELogoWhite\.svg/);
  assert.match(preview, /DCO Preview/);
  assert.match(preview, /Heading 1/);
  assert.match(preview, /Number/);
  assert.match(preview, /Unit price text/);
  assert.match(preview, /ads\/html\/SSE_DCO_728x90\.html/);
  assert.match(preview, /SSE_DCO_PREVIEW_STATE/);
  assert.match(preview, /data-ad-frame-shell/);
  assert.match(preview, /name="Ad_Size"/);
  assert.match(preview, /zoom-controls/);
  assert.match(preview, /data-zoom-mode="fit"/);
  assert.match(preview, />Fit</);
  assert.match(preview, />1x</);
  assert.match(preview, />2x</);
  assert.match(preview, /data-zoom-step="-1"/);
  assert.match(preview, /data-zoom-step="1"/);
  assert.doesNotMatch(preview, /name="Preview_Scale"/);
  assert.match(preview, /name="background_image_url"/);
  assert.match(preview, /use\.typekit\.net\/grv2rfu\.css/);
  assert.match(preview, /museo-sans/);
  assert.match(preview, /Replay ad/);
  assert.match(preview, /function fitAdFrames/);
  assert.match(preview, /window\.__SSE_DCO_CLIENT_PREVIEW__/);
  assert.match(preview, /<script src="preview-validator\.js"><\/script>/);
  assert.equal((preview.match(/<iframe /g) || []).length, 1);
  assert.doesNotMatch(preview, /class="ad-grid"/);
  assert.doesNotMatch(preview, /SSE_DCO_VALIDATE/);

  assert.match(validator, /Copy_Validation/);
  assert.match(validator, /SSE_DCO_VALIDATE/);
  assert.match(validator, /SSE_DCO_VALIDATION_RESULT/);
  assert.match(validator, /function inspectElement/);
  assert.match(validator, /validation-badge/);
  assert.match(validator, /heading1_text/);
  assert.doesNotMatch(validator, legacyFieldPattern(['Headline', 'Act1']));

  const variant = String(entries.find((entry) => entry.path === 'ads/html/SSE_DCO_728x90_offers-3_tcs-units_rectangle.html')?.data || '');
  assert.match(variant, /offers-3 tc-prices cta-rect/);
  assert.match(variant, /src="\.\.\/assets\/bg_728x90\.jpg"/);
  assert.match(variant, /data-dco-field="background_image_url_728x90"/);
  assert.match(variant, /<script src="\.\.\/\.\.\/preview-validator\.js"><\/script>/);
  assert.match(variant, /@font-face/);
  assert.match(variant, /font-family: "Museo"/);
  assert.doesNotMatch(variant, /font-family: "Museo Sans"/, 'the ad must be hyper-explicit: Museo only, never the Sans');
  assert.match(variant, /local\("☺"\)/);
  assert.match(variant, /url\("\.\.\/assets\/fonts\/Museo700-Regular\.otf"\) format\("opentype"\)/);
  assert.doesNotMatch(variant, /MuseoSans_700\.otf/);
  assert.match(variant, /font-synthesis: none/);
});

test('builds a base agency package with one production html file per size', async () => {
  const document = await readCreativeDocument();
  const entries = await buildBasePackageEntries(document);
  const names = entries.map((entry) => entry.path).sort();
  const htmlNames = names.filter((name) => name.endsWith('/index.html'));

  assert.deepEqual(htmlNames, [
    'ads/160x600/index.html',
    'ads/300x250/index.html',
    'ads/300x600/index.html',
    'ads/320x50/index.html',
    'ads/728x90/index.html',
    'ads/970x250/index.html',
  ]);
  assert.ok(names.includes('mapping.txt'));
  assert.ok(names.includes('ads/assets/SVG/SSELogoBlue.svg'));
  assert.ok(names.includes('ads/assets/fonts/Museo700-Regular.otf'));
  assert.ok(!names.includes('ads/assets/fonts/MuseoSans_700.otf'), 'Museo Sans is a different typeface and must never ship');
  assert.ok(!names.some((name) => /^ads\/assets\/bg_.*\.jpe?g$/i.test(name)));
  assert.ok(!names.includes('preview-page.html'));
  assert.ok(!names.includes('preview-validator.js'));
  assert.ok(!names.some((name) => /offers-\d_/.test(name)));

  const html = String(entries.find((entry) => entry.path === 'ads/728x90/index.html')?.data || '');
  const mapping = String(entries.find((entry) => entry.path === 'mapping.txt')?.data || '');
  assert.match(html, /data-dco-field="heading1_text"/);
  assert.match(html, /data-dco-field="background_image_url_728x90"/);
  assert.match(html, /id="bg-image" src="" data-packaged-src="" data-dco-field="background_image_url_728x90"/);
  assert.match(html, /Enabler\.setProfileId\(10960467\)/);
  assert.match(html, /devDynamicContent\.SSE_ROI_Delivery/);
  assert.match(html, /background_image_url_728x90\.Url/);
  assert.match(html, /728x90_hiker\.jpg/);
  assert.match(html, /Enabler\.setDevDynamicContent\(devDynamicContent\)/);
  assert.doesNotMatch(html, /\.\.\/assets\/bg_728x90\.jpg/);
  assert.doesNotMatch(html, /preview-validator\.js/);
  assert.doesNotMatch(html, /<script id="sse-dco-preview-feed">/);
  assert.doesNotMatch(html, /window\.__SSE_DCO_PREVIEW__/);
  assert.doesNotMatch(html, /SSE_DCO_PREVIEW_STATE/);
  assert.doesNotMatch(html, /triple_elec15_gas30_bill100/);
  assert.match(mapping, /heading1_text\ttext/);
  assert.match(mapping, /offer_count_num\tinteger\t1-3/);
  assert.match(mapping, /tc_type_enum\tenum\ttcs_only \| tcs_units/);
  assert.match(mapping, /cta_type_enum\tenum\troundel \| rectangle/);
  assert.match(mapping, /background_image_url_300x250\timage/);
  assert.match(mapping, /background_image_url_728x90\timage/);
  assert.doesNotMatch(mapping, legacyFieldPattern(['Headline', 'Act1']));
  assert.doesNotMatch(mapping, legacyFieldPattern(['Offer', 'Count']));
  assert.doesNotMatch(mapping, legacyFieldPattern(['TC', 'Mode']));
  assert.doesNotMatch(mapping, legacyFieldPattern(['CTA', 'Shape']));
  assert.doesNotMatch(mapping, legacyFieldPattern(['Exit', 'URL']));
});

test('builds a CDN-linked base agency package without packaged static assets', async () => {
  const document = await readCreativeDocument();
  const entries = await buildBasePackageEntries(document, { assetMode: 'cdn' });
  const names = entries.map((entry) => entry.path).sort();
  const html = entries
    .filter((entry) => entry.path.endsWith('/index.html'))
    .map((entry) => String(entry.data || ''))
    .join('\n');

  assert.ok(names.includes('mapping.txt'));
  assert.ok(names.includes('ads/728x90/index.html'));
  assert.ok(!names.some((name) => name.startsWith('ads/assets/SVG/')));
  assert.ok(!names.some((name) => /^ads\/assets\/bg_.*\.jpe?g$/i.test(name)));
  // Museo is CDN-linked in CDN mode — do not package it, and never point the
  // Museo family at the Museo Sans file that lives in the same Studio folder.
  assert.ok(!names.includes('ads/assets/fonts/Museo700-Regular.otf'));
  assert.ok(!names.includes('ads/assets/fonts/MuseoSans_700.otf'));

  for (const url of CDN_SVG_URLS) {
    assert.ok(html.includes(url), `Expected CDN SVG URL ${url}`);
  }
  assert.ok(html.includes(CDN_MUSEO_URL), 'Expected Museo CDN URL');
  assert.match(html, new RegExp(
    `font-family: "Museo";[\\s\\S]*?url\\("${CDN_MUSEO_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\) format\\("opentype"\\)`,
  ));
  assert.doesNotMatch(html, /font-family: "Museo Sans"/);
  assert.ok(!html.includes(CDN_MUSEO_SANS_URL), 'the Museo Sans CDN file must never back the Museo family');
  assert.doesNotMatch(html, /MuseoSans_700\.otf/);
  assert.doesNotMatch(html, /src="\.\.\/assets\/SVG\//);
  assert.match(html, /id="bg-image" src="" data-packaged-src="" data-dco-field="background_image_url_728x90"/);
  assert.match(html, /Enabler\.setDevDynamicContent\(devDynamicContent\)/);
});

test('builds a client preview package without copy validation when requested', async () => {
  const document = await readCreativeDocument();
  const entries = await buildClientPreviewPackageEntries(document, { includeValidator: false });
  const names = entries.map((entry) => entry.path).sort();

  assert.ok(names.includes('preview-page.html'));
  assert.ok(names.includes('ads/html/SSE_DCO_728x90.html'));
  assert.ok(names.includes('ads/assets/fonts/Museo700-Regular.otf'));
  assert.ok(!names.includes('ads/assets/fonts/MuseoSans_700.otf'), 'Museo Sans is a different typeface and must never ship');
  assert.ok(!names.includes('mapping.txt'));
  assert.ok(!names.includes('preview-validator.js'));

  const preview = String(entries.find((entry) => entry.path === 'preview-page.html')?.data || '');
  const variant = String(entries.find((entry) => entry.path === 'ads/html/SSE_DCO_728x90_offers-3_tcs-units_rectangle.html')?.data || '');

  assert.doesNotMatch(preview, /window\.__SSE_DCO_CLIENT_PREVIEW__/);
  assert.doesNotMatch(preview, /preview-validator\.js/);
  assert.doesNotMatch(variant, /preview-validator\.js/);
  assert.match(variant, /url\("\.\.\/assets\/fonts\/Museo700-Regular\.otf"\) format\("opentype"\)/);
});

test('renders the client preview page as one self-contained document shell', async () => {
  const document = await readCreativeDocument();
  const html = renderClientPreviewPage(document, { includeValidator: true });

  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
  assert.match(html, /Heading 2/);
  assert.match(html, /T&Cs with unit prices/);
  assert.match(html, /function updateAds/);
  assert.match(html, /resize', fitAdFrames/);
  assert.match(html, /function loadActiveAd/);
  assert.match(html, /function replayAd/);
  assert.match(html, /function previewScale/);
  assert.match(html, /window\.__SSE_DCO_CLIENT_PREVIEW__/);
  assert.match(html, /<script src="preview-validator\.js"><\/script>/);
  assert.match(html, /grid-template-columns: minmax\(400px, 460px\)/);
  assert.match(html, /height: calc\(100vh - 76px\)/);
  assert.match(html, /flex: 1/);
  assert.match(html, /background: #fff/);
  assert.match(html, /overflow: auto/);
  assert.match(html, /linear-gradient/);
  assert.match(html, /grid-template-columns: 82px minmax\(0, 1fr\)/);
  assert.match(html, /DCO Preview/);
  assert.match(html, /brand\/BGlogo_SVG\.svg/);
  assert.match(html, /use\.typekit\.net\/grv2rfu\.css/);
  assert.match(html, /font-family: "museo-sans"/);
  assert.match(html, /<link rel="stylesheet" href="https:\/\/use\.typekit\.net\/grv2rfu\.css">/);
  assert.doesNotMatch(html, /SSE_DCO_VALIDATE/);
});

test('creates a zip archive from client package entries', () => {
  const zip = createZipBuffer([
    { path: 'preview-page.html', data: '<!doctype html>' },
    { path: 'ads/html/test.html', data: '<html></html>' },
  ]);

  assert.equal(zip.subarray(0, 4).toString('binary'), 'PK\u0003\u0004');
  assert.ok(zip.includes(Buffer.from('preview-page.html')));
  assert.ok(zip.includes(Buffer.from('ads/html/test.html')));
  assert.ok(zip.includes(Buffer.from('PK\u0005\u0006', 'binary')));
});

test('exports legacy static first-frame state and GWD skeleton text reset', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x600');

  assert.match(html, /p,\s*h1,\s*h2,\s*h3\s*\{\s*margin:\s*0px;/);
  assert.match(html, /#headline-act1\s*\{[\s\S]*?transform:\s*translate3d\(320px, 0px, 0px\);[\s\S]*?opacity:\s*0;/);
  assert.match(html, /\.offer-slot-1\s*\{[\s\S]*?transform:\s*translate3d\(60px, 0px, 0px\);[\s\S]*?opacity:\s*0;/);
  assert.match(html, /\.plus-1\s*\{[\s\S]*?font-size:\s*43px;[\s\S]*?transform:\s*translate3d\(0px, -10px, 0px\);/);
  assert.doesNotMatch(html, /font-size:\s*43pxpx/);
});

test('exports the shared text-fit engine and fits after binding offer texts', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '160x600');

  assert.match(html, /function createTextFitEngine\(/);
  assert.match(html, /textFitEngine\.applyRules\(/);
  assert.match(html, /function wrapOfferValueSymbol\(element\)/);
  assert.match(html, /first === '\\u00A3' \|\| first === '\\u20AC'/);
  assert.match(
    html,
    /bindOfferTexts\(data\);\s+fitBoundText\(\);\s+alignOfferValueSymbols\(\);/,
    'texts must be bound before fitting, symbols aligned after',
  );
  assert.doesNotMatch(html, /OFFER_VALUE_MIN_PX/);
  assert.doesNotMatch(html, /function fitOfferValues/);
  assert.doesNotMatch(html, /function equalizeSublines/);
});

test('the serialized fit engine in exported HTML is executable', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '320x50');

  const source = html.match(/var textFitEngine = (\(function createTextFitEngine[\s\S]*?)\(window\);/)?.[1];
  assert.ok(source, 'serialized engine source not found in exported HTML');
  const factory = new Function(`return ${source};`)();
  const style: Record<string, string> = {};
  const element = {
    className: 'probe',
    textContent: 'copy',
    style,
    parentElement: null,
    clientWidth: 100,
    clientHeight: 20,
    get scrollWidth() {
      return (Number.parseFloat(style.fontSize) || 40) <= 30 ? 100 : 101;
    },
    scrollHeight: 20,
    matches: (selector: string) => selector === '.probe',
  };
  const engine = factory({
    getComputedStyle: () => ({
      fontSize: `${Number.parseFloat(style.fontSize) || 40}px`,
      lineHeight: '44px',
      visibility: 'visible',
      display: 'block',
      alignItems: '',
      whiteSpace: 'nowrap',
      letterSpacing: 'normal',
    }),
  });
  const results = engine.applyRules(
    { className: 'stage', querySelectorAll: () => [element] },
    [{ cssClass: 'probe', minFontSize: 8 }],
  );

  assert.deepEqual(results, [{ cssClass: 'probe', size: 30 }]);
  assert.equal(style.fontSize, '30px');
});

test('local QA exports embed the packaged Museo so they measure what Studio serves', async () => {
  const document = await readCreativeDocument();
  // Exactly the options buildCreativeHtmlFiles passes for output/SSE_DCO_*.html.
  const html = renderStudioReadyHtml(document, '320x50', { fontBasePath: '../campaign/assets/fonts/' });

  assert.match(html, /@font-face/);
  assert.match(html, /font-family: "Museo";[\s\S]*?url\("\.\.\/campaign\/assets\/fonts\/Museo700-Regular\.otf"\) format\("opentype"\)/);
  assert.match(html, /local\("☺"\)/, 'locally installed fonts must never mask the packaged file');
  assert.doesNotMatch(html, /MuseoSans_700\.otf/);
});

test('refits text once fonts finish loading', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '320x50');

  assert.match(html, /document\.fonts\.ready/);
  assert.match(html, /scheduleFontRefit\(\)/);
  assert.match(html, /loadingdone/);
});

test('exports uniform bottom-aligned tracking rules for pricing blocks', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '320x50');

  assert.match(html, /"cssClass":"offer-value","shared":true/);
  assert.match(html, /"tracking":\{"minEm":-0\.02\}/);
  assert.match(html, /"align":"bottom"/);
  assert.match(html, /"minFontSizeRatio":0\.5/);
  assert.match(html, /"cssClass":"offer-subline","shared":true/);
});

test('exports creative text fit rules for dynamic headline binding', async () => {
  const document = await readCreativeDocument();
  document.sizes['300x250'].layers.find((layer) => layer.id === 'headline-act2')!.fit = {
    mode: 'shrink',
    minFontSize: 22,
    maxLines: 2,
  };

  const html = renderStudioReadyHtml(document, '300x250');

  assert.match(html, /var textFitRules = .*"cssClass":"sse-headline"/);
  assert.match(html, /"minFontSize":22/);
  assert.match(html, /"maxLines":2/);
  assert.match(html, /bindOfferTexts\(data\);\s+fitBoundText\(\);/);
});

test('exports text fitting that measures text content height', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '728x90');

  assert.match(html, /function contentHeight\(element\)/);
  assert.match(html, /doc\.createRange\(\)/);
  assert.match(html, /function tooTall\(element, rule, cs, fontSize\)/);
});

test('does not apply text-fit clipping to the CTA shape container', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x600');

  assert.doesNotMatch(html, /"cssClass":"cta"/);
  assert.doesNotMatch(html, /"cssClass":"cta","mode":"shrink"/);
});

test('uses sensible default text-fit minimums based on designed font size', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '300x250');

  const rulesJson = html.match(/var textFitRules = (\[.*\]);/)?.[1];
  assert.ok(rulesJson, 'textFitRules missing from runtime');
  const rules = JSON.parse(rulesJson!);
  const headline = rules.find((rule: Record<string, unknown>) => rule.cssClass === 'sse-headline');
  assert.ok(headline, 'headline rule missing');
  assert.equal(headline.shared, true);
  assert.equal(headline.maxLines, 4);
  assert.ok(Number(headline.minFontSize) >= 12, 'partial fit config must not collapse the floor to 1px');
});
