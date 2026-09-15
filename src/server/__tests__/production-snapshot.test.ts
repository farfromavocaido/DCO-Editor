import { test } from 'vitest';
import assert from 'node:assert/strict';
import { captureProductionPresentation } from '../production-snapshot';

const html = `<!doctype html><html><head><style>
.stage { position:relative; width:300px; height:250px }
.sse-text { position:absolute; width:70px; height:80px; font:20px/1 Arial; white-space:normal }
</style></head><body><main class="stage motion-ready" id="page-content" data-size="300x250">
<div id="terms-prices" class="sse-text">Alpha Beta</div>
</main></body></html>`;

test('standalone snapshot records browser-wrapped lines from the production HTML', async () => {
  const snapshot = await captureProductionPresentation(html, '300x250');
  assert.equal(snapshot.size, '300x250');
  assert.equal(snapshot.texts['terms-prices'].fontSize, 20);
  assert.deepEqual(snapshot.texts['terms-prices'].lines, ['Alpha', 'Beta']);
}, 30000);

test('standalone snapshot fails explicitly when a creative asset is missing', async () => {
  await assert.rejects(captureProductionPresentation(html.replace('</main>', '<img src="/assets/not-a-real-image.png"></main>'), '300x250'), /image failed to load/i);
}, 30000);

test('standalone snapshot captures solo terms without a DOM id', async () => {
  const source = html.replace('<div id="terms-prices" class="sse-text">Alpha Beta</div>', '<div id="TC_Solo"><p class="sse-text terms-solo" data-dco-field="tc_terms_text">Alpha Beta</p></div>');
  const snapshot = await captureProductionPresentation(source, '300x250');
  assert.ok(snapshot.texts['terms-solo'], 'solo terms must never enter approximate metric fallback');
  assert.deepEqual(snapshot.texts['terms-solo'].lines, ['Alpha', 'Beta']);
}, 30000);

test('snapshot reports CSS-hidden text instead of measuring it in the nested second pass', async () => {
  const source = html.replace('</main>', '<div id="offer1" style="display:none"><p class="offer-value">15%</p><p class="offer-subline">Hidden terms</p></div><p id="headline-act2" class="sse-text" style="opacity:0">Alpha Beta</p></main>');
  const snapshot = await captureProductionPresentation(source, '300x250');
  assert.ok(snapshot.hiddenTargets?.includes('offer-slot-1::offer-value'));
  assert.ok(snapshot.hiddenTargets?.includes('offer-slot-1::offer-subline'));
  assert.equal(snapshot.texts['offer-slot-1::offer-value'], undefined);
  assert.ok(snapshot.texts['headline-act2'], 'animation opacity alone must not omit fitted text');
}, 30000);

test('snapshot preserves CSS visibility overrides within hidden ancestors', async () => {
  const source = html.replace('</main>', '<div style="visibility:hidden"><p id="headline-act2" class="sse-text" style="visibility:visible">Alpha Beta</p></div></main>');
  const snapshot = await captureProductionPresentation(source, '300x250');
  assert.ok(snapshot.texts['headline-act2']);
  assert.ok(!snapshot.hiddenTargets?.includes('headline-act2'));
}, 30000);

test('outline export rejects an incomplete supplied snapshot rather than approximating text', async () => {
  const { readCreativeDocument } = await import('../creative-document');
  const { renderStudioReadyHtml } = await import('../creative-exporter');
  const document = await readCreativeDocument();
  await assert.rejects(renderStudioReadyHtml(document, '300x250', {
    renderMode: 'outline', presentationSnapshot: { size: '300x250', texts: {}, positions: {} },
  }), /snapshot is missing text metrics/i);
});

test('outline baking refuses metrics captured for different copy', async () => {
  const { readCreativeDocument } = await import('../creative-document');
  const { bakeOutlinedText } = await import('../outline-bake');
  const document = await readCreativeDocument();
  await assert.rejects(bakeOutlinedText({
    document, size:'300x250', targetId:'terms-prices', text:'Current copy', activeScopes:['offers-1'], requireSnapshot:true,
    snapshot:{size:'300x250',positions:{},texts:{'terms-prices':{key:'terms-prices',text:'Old copy',fontSize:10,letterSpacingEm:0,alignOffsetY:0}}},
  }), /snapshot is stale/i);
});
