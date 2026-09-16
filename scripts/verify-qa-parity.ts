/** Verify the actual /qa iframe bridge against a freshly built saved-document agency package.
 * npx tsx --tsconfig tsconfig.json scripts/verify-qa-parity.ts http://localhost:5186
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { buildBasePackageEntries } from '../src/server/creative-exporter';
import { readQaRevisionDocument } from '../src/server/qa-agency-shell';
import { waitForProductionDocument } from '../src/lib/production-stage';
import { productionSnapshotCollectorScript } from '../src/server/production-snapshot';
import { MUSEO_CDN_URL } from '../src/lib/brand-font';

const origin = process.argv[2] || 'http://localhost:5186';
const packageOrigin = `${origin}/__qa-parity`;
const output = path.resolve('output/playwright/qa-parity');
const measure = `(() => {
  const root = document.querySelector('.stage');
  const bounds = root.getBoundingClientRect();
  return {
    nodes: [...root.querySelectorAll('[id], .offer-value, .offer-subline, .terms-solo')].map(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { id: el.id || el.className, text: el.textContent, font: s.fontFamily, size: s.fontSize,
        lineHeight:s.lineHeight, tracking:s.letterSpacing, opacity:s.opacity, visibility:s.visibility,
        display:s.display, transform:s.transform, left:+(r.left-bounds.left).toFixed(2), top:+(r.top-bounds.top).toFixed(2),
        width:+r.width.toFixed(2), height:+r.height.toFixed(2), scrollWidth:el.scrollWidth, scrollHeight:el.scrollHeight };
    }),
    texts: window.__captureProductionPresentation(root, root.dataset.size).texts
  };
})()`;

async function main() {
  await fs.mkdir(output, {recursive:true});
  const browser = await chromium.launch({headless:true});
  const report: unknown[] = [];
  try {
    const context = await browser.newContext({viewport:{width:1600,height:1100}});
    const font = await fs.readFile('campaign/assets/fonts/Museo700-Regular.otf');
    let fontLoads = 0;
    // Cold, deliberately slow font requests exercise initial render readiness.
    await context.route(MUSEO_CDN_URL, async route => {
      fontLoads++;
      await new Promise(resolve => setTimeout(resolve, 800));
      await route.fulfill({contentType:'font/otf',body:font});
    });
    await context.route('https://s0.2mdn.net/ads/studio/Enabler.js', route => route.fulfill({contentType:'application/javascript',body:`window.Enabler={setProfileId:function(){},setDevDynamicContent:function(row){window.dynamicContent=row},isInitialized:function(){return true},addEventListener:function(){},exit:function(){}};window.studio={events:{StudioEvent:{INIT:'init'}}};`}));
    const page = await context.newPage();
    const errors: string[] = [];
    context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/qa`);
    await page.locator('iframe[data-ready="true"]').first().waitFor({timeout:60000});
    const firstSrc = await page.locator('iframe').first().getAttribute('src');
    const revision = firstSrc!.split('/revisions/')[1].split('/')[0];
    const document = await readQaRevisionDocument(revision);
    const entries = await buildBasePackageEntries(document, {assetMode:'canonical-agency',renderMode:'font'});
    const files = new Map(entries.map(entry => [entry.path,entry.data]));
    await context.route(`${packageOrigin}/**`, route => {
      const name = decodeURIComponent(new URL(route.request().url()).pathname.replace('/__qa-parity/', ''));
      const data = files.get(name);
      return route.fulfill({status:data === undefined ? 404 : 200, body:data ?? '',contentType:name.endsWith('.html')?'text/html':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.otf')?'font/otf':'application/octet-stream'});
    });
    const collector = await productionSnapshotCollectorScript();
    for (const size of Object.keys(document.sizes as Record<string, unknown>)) {
      await page.getByLabel('Ad size',{exact:true}).selectOption(size);
      for (const offers of [0,1,2,3]) {
        await page.getByRole('button',{name:['No offers (brand / awareness)','Single offer','Dual offers','Triple offers'][offers],exact:true}).click();
        await page.waitForFunction(({size,offers}) => {
          const frames = [...window.document.querySelectorAll<HTMLIFrameElement>('iframe')];
          return frames.length > 0 && frames.every(frame => frame.dataset.ready === 'true'
            && frame.contentDocument?.querySelector('.stage')?.getAttribute('data-size') === size
            && frame.contentDocument?.querySelector('.stage')?.classList.contains(`offers-${offers}`));
        }, {size,offers},{timeout:60000});
        const exported = await context.newPage();
        await exported.goto(`${packageOrigin}/ads/${size}/index.html`);
        await exported.waitForFunction('window.__SSE_DCO_READY__ === true');
        await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
        await exported.addScriptTag({content:collector});
        const frames = await page.locator('iframe').elementHandles();
        for (let index=0; index<frames.length; index++) {
          const frame = (await frames[index].contentFrame())!;
          const time = Number(await frames[index].getAttribute('data-hold-ms'));
          const row = await frame.evaluate('window.__SSE_DCO_APPLIED_ROW__');
          assert.ok(row, 'QA must expose the exact applied feed row');
          await exported.evaluate(row => (window as unknown as { applySseDcoRuntimeState: (row: unknown) => void }).applySseDcoRuntimeState(row), row);
          await exported.evaluate(`(${waitForProductionDocument.toString()})(document)`);
          await exported.evaluate(time => { for (const animation of window.document.getAnimations()) { animation.pause(); animation.currentTime=time; } }, time);
          await frame.addScriptTag({content:collector});
          const actual = await frame.evaluate(measure), expected = await exported.evaluate(measure);
          try { assert.deepEqual(actual, expected); }
          catch (error) {
            const file = `${size}-offers-${offers}-hold-${time}`;
            await fs.writeFile(path.join(output,`${file}.json`),JSON.stringify({actual,expected},null,2));
            await page.screenshot({path:path.join(output,`${file}-qa.png`)});
            await exported.screenshot({path:path.join(output,`${file}-package.png`)});
            throw new Error(`QA parity mismatch ${file}: ${String(error).slice(0,700)}`);
          }
        }
        report.push({size,offers,holds:frames.length,result:'pass'});
        console.log(`PASS QA ${size} offers-${offers}: ${frames.length} holds`);
        await exported.close();
      }
    }
    assert.ok(fontLoads > 0, 'delayed cold font path was exercised');
    assert.deepEqual(errors, [], 'no browser runtime errors');
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({revision,fontDelayMs:800,fontLoads,report},null,2));
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
