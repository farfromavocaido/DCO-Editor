/** Run against an isolated editor: npx tsx --tsconfig tsconfig.json scripts/verify-editor-parity.ts http://localhost:5184 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { productionSnapshotCollectorScript } from '../src/server/production-snapshot';
import { chromium, type Frame } from 'playwright';
import { MUSEO_CDN_URL } from '../src/lib/brand-font';
import { buildBasePackageEntries } from '../src/server/creative-exporter';

const origin = process.argv[2] || 'http://localhost:5184';
const packageOrigin = `${origin}/__parity-package`;
const delivery = process.argv[3] === 'agency' ? 'canonical-agency' : 'embed';
const output = path.resolve('output/playwright/parity', delivery);
const sizes = ['160x600','300x250','300x600','320x50','728x90','970x250'];
const cases = sizes.flatMap(size => [0,1,2,3].map(offers => ({size,offers})));
const times = [0, 14.5, 19, 37.5, 60, 83, 99];
const MEASURE = `(() => {
  const root = document.querySelector('.stage');
  const origin = root.getBoundingClientRect();
  const nodes = [...root.querySelectorAll('[id], .offer-value, .offer-subline, .terms-solo')];
  const measured = nodes.filter(el => el.id !== 'clickbox').map((el, index) => {
    const cs = getComputedStyle(el), box = el.getBoundingClientRect();
    return { key: el.id || (el.closest('[id]')?.id + '::' + el.className + ':' + index),
      text: el.textContent, font: cs.fontFamily, size: cs.fontSize, lineHeight: cs.lineHeight,
      tracking: cs.letterSpacing, color: cs.color, background: cs.backgroundColor,
      visibility: cs.visibility, display: cs.display, opacity: cs.opacity, transform: cs.transform,
      left: Number((box.left-origin.left).toFixed(2)), top: Number((box.top-origin.top).toFixed(2)),
      width: Number(box.width.toFixed(2)), height: Number(box.height.toFixed(2)) };
  });
  return {nodes: measured, texts: window.__captureProductionPresentation(root, root.dataset.size).texts, images: [...document.images].map(img => ({id:img.id,complete:img.complete,width:img.naturalWidth,height:img.naturalHeight}))};
})()`;

async function main() {
  await fs.mkdir(output, { recursive: true });
  const localFont = await fs.readFile(path.resolve('campaign/assets/fonts/Museo700-Regular.otf'));
  const fontResponse = await fetch(MUSEO_CDN_URL);
  assert.ok(fontResponse.ok, 'Studio font must be available for parity verification');
  const cdnFont = Buffer.from(await fontResponse.arrayBuffer());
  assert.deepEqual(localFont, cdnFont, 'local and Studio font bytes must match');
  const fontSha256 = createHash('sha256').update(localFont).digest('hex');
  const browser = await chromium.launch({ headless: true });
  const report: unknown[] = [];
  try {
    const editor = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    editor.on('pageerror', error => errors.push(error.message));
    let payload: {document: any; row: any} | undefined;
    await editor.route(url => /\/api\/creative\/[^/]+\/view/.test(url.pathname), async route => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      const body = route.request().postDataJSON();
      if (delivery === 'canonical-agency') {
        const size = new URL(route.request().url()).pathname.split('/')[3];
        const field = `background_image_url_${size}`;
        // Agency delivery is feed-only. Supply the same explicit image to both
        // surfaces rather than compare different fallback behaviours.
        if (!body.row[field]?.Url) body.row[field] = {Url:`${origin}/${body.document.sizes[size].assets.background}`};
      }
      payload = body;
      await route.continue({postData:JSON.stringify(body)});
    });
    await editor.goto(origin);
    await editor.locator('[data-production-frame]').waitFor();
    for (const scenario of cases) {
      await editor.getByLabel('Ad size', {exact: true}).selectOption(scenario.size);
      await editor.getByRole('button', { name: ['No offers (brand / awareness)', 'Single offer', 'Dual offers', 'Triple offers'][scenario.offers], exact: true }).click();
      await editor.waitForFunction(({size, offers}) => {
        const frame = document.querySelector<HTMLIFrameElement>('[data-production-frame]');
        const stage = frame?.contentDocument?.querySelector<HTMLElement>('.stage');
        return frame?.dataset.ready === 'true' && stage?.dataset.size === size && stage.classList.contains(`offers-${offers}`);
      }, scenario, {timeout:30000});
      assert.ok(payload, 'editor must render its document through the production endpoint');
      const current = structuredClone(payload);
      const doc = { ...current.document, sizes: { [scenario.size]: current.document.sizes[scenario.size] } };
      // Embed delivery intentionally uses the same authored packaged-background
      // fallback as the local editor. Agency feed-only backgrounds require an
      // explicit matching feed URL and are a separate delivery contract.
      const entries = await buildBasePackageEntries(doc, {assetMode:delivery});
      const files = new Map(entries.map(entry => [entry.path, entry.data]));
      const exported = await browser.newPage({viewport:doc.sizes[scenario.size].canvas, deviceScaleFactor:1});
      exported.on('pageerror', error => errors.push(error.message));
      await exported.route(`${packageOrigin}/**`, async route => {
        const name = decodeURIComponent(new URL(route.request().url()).pathname.replace('/__parity-package/', ''));
        const data = files.get(name);
        const contentType = name.endsWith('.html') ? 'text/html' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.otf') ? 'font/otf' : 'application/octet-stream';
        await route.fulfill({status:data === undefined ? 404 : 200, body:data ?? '', contentType});
      });
      await exported.route('https://s0.2mdn.net/ads/studio/Enabler.js', route => route.fulfill({contentType:'application/javascript',body:`window.Enabler={setProfileId:function(){},setDevDynamicContent:function(row){window.dynamicContent=row},isInitialized:function(){return true},addEventListener:function(){},exit:function(){}};window.studio={events:{StudioEvent:{INIT:'init'}}};`}));
      await exported.goto(`${packageOrigin}/${delivery === 'embed' ? `${scenario.size}.html` : `ads/${scenario.size}/index.html`}`);
      await exported.waitForFunction('typeof window.applySseDcoRuntimeState === "function"');
      await exported.evaluate(row => (window as any).applySseDcoRuntimeState(row), current.row);
      await exported.waitForFunction('document.querySelector(".stage.motion-ready") && document.fonts.status === "loaded" && [...document.images].every(img => img.complete && (!img.getAttribute("src") || img.naturalWidth > 0))').catch(async error => { console.error(await exported.evaluate('({stage:document.querySelector(".stage")?.className,fonts:document.fonts.status,images:Array.from(document.images).map(img=>({src:img.src.slice(0,160),width:img.naturalWidth,complete:img.complete}))})'), errors); throw error; });
      const frame = await editor.locator('[data-production-frame]').elementHandle().then(handle => handle!.contentFrame()) as Frame;
      const collector = await productionSnapshotCollectorScript();
      await frame.addScriptTag({content:collector});
      await exported.addScriptTag({content:collector});
      const imageSources = (surface: any) => surface.evaluate('Array.from(document.images).map(img => img.currentSrc || img.src)');
      const hashImage = async (src: string) => {
        let bytes: Buffer;
        if (src.startsWith('data:')) {
          const comma = src.indexOf(',');
          bytes = src.slice(0,comma).includes(';base64') ? Buffer.from(src.slice(comma+1),'base64') : Buffer.from(decodeURIComponent(src.slice(comma+1)));
        } else if (src.startsWith(`${packageOrigin}/`)) {
          const data = files.get(decodeURIComponent(new URL(src).pathname.replace('/__parity-package/', '')));
          assert.notEqual(data,undefined,`packaged image must exist: ${src}`);
          bytes = Buffer.from(data!);
        } else {
          const response = await editor.request.get(src);
          assert.ok(response.ok(),`image must load: ${src}`);
          bytes = await response.body();
        }
        return createHash('sha256').update(bytes).digest('hex');
      };
      const editorImages = await Promise.all((await imageSources(frame)).map(hashImage));
      const packageImages = await Promise.all((await imageSources(exported)).map(hashImage));
      assert.deepEqual(editorImages,packageImages,'image bytes must match across delivery paths');
      for (const percent of times) {
        await editor.getByLabel('Timeline scrubber').evaluate((input, value) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value));
          input.dispatchEvent(new Event('input', {bubbles:true}));
          input.dispatchEvent(new Event('change', {bubbles:true}));
        }, percent);
        const ms = percent * Number(doc.clock.durationS) * 10;
        await frame.waitForFunction(time => document.getAnimations().length > 0 && document.getAnimations().every(animation => Math.abs(Number(animation.currentTime) - time) < 0.02), ms);
        await exported.evaluate(time => { for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = time; } }, ms);
        const actual = await frame.evaluate(MEASURE);
        const expected = await exported.evaluate(MEASURE);
        try { assert.deepEqual(actual, expected); }
        catch (error) {
          const file = `${scenario.size}-offers-${scenario.offers}-${percent}`;
          await fs.writeFile(path.join(output, `${file}.json`), JSON.stringify({actual, expected}, null, 2));
          await editor.screenshot({path:path.join(output, `${file}-editor.png`)});
          await exported.screenshot({path:path.join(output, `${file}-export.png`)});
          throw new Error(`Parity mismatch ${file}: ${String(error).slice(0,700)}`);
        }
      }
      report.push({...scenario, documentSha256:createHash('sha256').update(JSON.stringify(current.document)).digest('hex'), times, targets:(await frame.evaluate(MEASURE) as {nodes:unknown[]}).nodes.length, result:'pass'});
      await exported.close();
      console.log(`PASS ${scenario.size} offers-${scenario.offers}: ${times.length} timeline positions`);
    }
    assert.deepEqual(errors, [], 'no browser runtime exceptions');
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({delivery, browser:browser.version(), fontSha256, report, errors},null,2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
