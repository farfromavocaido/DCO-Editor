import { test, expect } from 'vitest';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { readCreativeDocument } from '../creative-document';
import { renderStudioReadyHtml, renderWipHtml } from '../creative-exporter';
import { captureProductionPresentation } from '../production-snapshot';
import { projectRoot } from '../paths';

const origin = 'http://outline-motion.local';
const size = '300x250';
const percentages = [0,7,17,24,35,50,64,65,66,75,82,90,99];

async function load(page: Page, html: string) {
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/index.html') return route.fulfill({contentType:'text/html',body:html});
    const marker = url.pathname.indexOf('/assets/');
    const asset = marker >= 0 ? url.pathname.slice(marker + 1) : url.pathname.replace(/^\/+/, '');
    try { await route.fulfill({path:path.resolve(projectRoot,asset)}); }
    catch { await route.fulfill({status:404,body:''}); }
  });
  await page.route('https://s0.2mdn.net/ads/studio/Enabler.js',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.goto(`${origin}/index.html`);
  await page.waitForFunction(()=>document.querySelector('.stage.motion-ready') && document.fonts.status === 'loaded' && [...document.images].every(image=>image.complete));
}
async function readMotion(page: Page, percent: number, durationS: number) {
  return page.evaluate(async ({percent,durationS})=>{
    for (const animation of document.getAnimations()) { animation.pause(); animation.currentTime = percent / 100 * durationS * 1000; }
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    return [1,2,3,4].map(act=>{
      const element = document.getElementById(`headline-act${act}`);
      if (!element) return {visible:false};
      const style = getComputedStyle(element);
      const opacity = Number(style.opacity);
      if (style.visibility === 'hidden' || style.display === 'none' || opacity < 0.001) return {visible:false};
      const glyph = element.querySelector('svg g');
      return {visible:true,opacity,transform:style.transform,color:style.color,ink:glyph?getComputedStyle(glyph).fill:style.color};
    });
  },{percent,durationS});
}

for (const scenario of ['duplicate-sized-copy','zero-offer-early-acts'] as const) {
 for (const includeRoundelFrame of [true,false]) {
  test(`font and fixed outline headline motion match in Chromium: ${scenario}, frames-${includeRoundelFrame?4:3}`,async()=>{
    const document = await readCreativeDocument() as Record<string,any>;
    const initial = document.feed.sampleRows.find((row:Record<string,any>)=>row.Default) || document.feed.sampleRows[0];
    const row = {...initial,Default:true,offer_count_num:scenario==='zero-offer-early-acts'?0:1,include_roundel_frame_bool:includeRoundelFrame,heading4_enabled_bool:true};
    for (let act=1;act<=4;act++) {row[`heading${act}_text`]=`Base ${act}`;row[`heading${act}_text_${size}`]='';}
    if (scenario==='duplicate-sized-copy') {
      row.heading1_text_300x250='Keep the same headline';
      row.heading2_text_300x250='Keep the same headline';
      row.heading3_text_300x250='Different next headline';
      row.heading4_text_300x250='Different next headline';
      document.sizes[size].layers.find((layer:Record<string,any>)=>layer.id==='headline-act1').base.color='rgb(220, 0, 0)';
      document.sizes[size].layers.find((layer:Record<string,any>)=>layer.id==='headline-act2').base.color='rgb(0, 80, 220)';
    } else {
      row.heading1_text='Only one early headline';
      row.heading2_text='';row.heading3_text='';row.heading4_text='A different final headline';
    }
    document.feed.sampleRows=[{...initial,Default:false},row];
    const fontHtml = renderWipHtml(await renderStudioReadyHtml(document,size,{renderMode:'font',fontBasePath:'assets/fonts/',includePreviewBridge:true}),row);
    const snapshot = await captureProductionPresentation(fontHtml,size);
    const outlineHtml = await renderStudioReadyHtml(document,size,{renderMode:'outline',delivery:'static',presentationSnapshot:snapshot});
    const browser = await chromium.launch({headless:true});
    try {
      const font = await browser.newPage({viewport:{width:300,height:250}});
      const outline = await browser.newPage({viewport:{width:300,height:250}});
      await Promise.all([load(font,fontHtml),load(outline,outlineHtml)]);
      for (const percent of percentages) {
        const [expected,actual] = await Promise.all([readMotion(font,percent,document.clock.durationS),readMotion(outline,percent,document.clock.durationS)]);
        expect(actual,`${scenario} frames-${includeRoundelFrame?4:3} at ${percent}%; outlined act1=${outlineHtml.includes('id="headline-act1"')}, snapshot-hidden=${snapshot.hiddenTargets?.join(',')}`).toEqual(expected);
      }
    } finally { await browser.close(); }
  },30000);
}
}
