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
  assert.ok(names.includes('ads/assets/fonts/MuseoSans_700.otf'));
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
  assert.match(variant, /font-family: "Museo Sans"/);
  assert.match(variant, /local\("☺"\)/);
  assert.match(variant, /url\("\.\.\/assets\/fonts\/Museo700-Regular\.otf"\) format\("opentype"\)/);
  assert.match(variant, /url\("\.\.\/assets\/fonts\/MuseoSans_700\.otf"\) format\("opentype"\)/);
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
  assert.ok(names.includes('ads/assets/fonts/MuseoSans_700.otf'));
  assert.ok(!names.some((name) => /^ads\/assets\/bg_.*\.jpe?g$/i.test(name)));
  assert.ok(!names.includes('preview-page.html'));
  assert.ok(!names.includes('preview-validator.js'));
  assert.ok(!names.some((name) => /offers-\d_/.test(name)));

  const html = String(entries.find((entry) => entry.path === 'ads/728x90/index.html')?.data || '');
  const mapping = String(entries.find((entry) => entry.path === 'mapping.txt')?.data || '');
  assert.match(html, /data-dco-field="heading1_text"/);
  assert.match(html, /data-dco-field="background_image_url_728x90"/);
  assert.match(html, /id="bg-image" src="" data-dco-field="background_image_url_728x90"/);
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

test('builds a client preview package without copy validation when requested', async () => {
  const document = await readCreativeDocument();
  const entries = await buildClientPreviewPackageEntries(document, { includeValidator: false });
  const names = entries.map((entry) => entry.path).sort();

  assert.ok(names.includes('preview-page.html'));
  assert.ok(names.includes('ads/html/SSE_DCO_728x90.html'));
  assert.ok(names.includes('ads/assets/fonts/Museo700-Regular.otf'));
  assert.ok(names.includes('ads/assets/fonts/MuseoSans_700.otf'));
  assert.ok(!names.includes('mapping.txt'));
  assert.ok(!names.includes('preview-validator.js'));

  const preview = String(entries.find((entry) => entry.path === 'preview-page.html')?.data || '');
  const variant = String(entries.find((entry) => entry.path === 'ads/html/SSE_DCO_728x90_offers-3_tcs-units_rectangle.html')?.data || '');

  assert.doesNotMatch(preview, /window\.__SSE_DCO_CLIENT_PREVIEW__/);
  assert.doesNotMatch(preview, /preview-validator\.js/);
  assert.doesNotMatch(variant, /preview-validator\.js/);
  assert.match(variant, /url\("\.\.\/assets\/fonts\/MuseoSans_700\.otf"\) format\("opentype"\)/);
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

test('exports runtime value fitting before offer value symbol alignment', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '160x600');

  assert.match(html, /var OFFER_VALUE_MIN_PX = 32;/);
  assert.match(html, /function fitOfferValues\(\)/);
  assert.match(html, /function wrapOfferValueSymbol\(element\)/);
  assert.match(html, /first === '\\u00A3' \|\| first === '\\u20AC'/);
  assert.match(
    html,
    /bindOfferTexts\(data\);\s+fitOfferValues\(\);\s+equalizeSublines\(\);\s+alignOfferValueSymbols\(\);/,
  );
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
  assert.match(html, /fitBoundText\(\);\s+bindOfferTexts\(data\);/);
});

test('exports text fitting that measures text content height', async () => {
  const document = await readCreativeDocument();
  const html = renderStudioReadyHtml(document, '728x90');

  assert.match(html, /function textContentHeight\(element\)/);
  assert.match(html, /document\.createRange\(\)/);
  assert.match(html, /isTextTooTall\(element, rule, size, maxHeight\)/);
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

  assert.match(html, /"cssClass":"sse-headline","mode":"sharedEqualizedFit","maxLines":4/);
});
