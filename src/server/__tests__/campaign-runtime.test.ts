// @ts-nocheck
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import demo from '../../test/fixtures/campaign/product-demo-creative.json';
import { renderStudioReadyHtml } from '../creative-exporter';

test('generic production runtime binds arbitrary copy, switches scopes and updates exit URL',async()=>{
 const html=await renderStudioReadyHtml(demo,'300x250',{includePreviewBridge:true});
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route('https://s0.2mdn.net/**',route=>route.abort());
  await page.setContent(html);
  await page.waitForFunction(()=>window.__SSE_DCO_READY__);
  assert.equal(await page.locator('#title').textContent(),'Light your space');
  const last=demo.feed.sampleRows.at(-1)!;
  await page.evaluate(async(row)=>{window.applySseDcoRuntimeState(row);await window.__SSE_DCO_SETTLED__;},last);
  assert.match(await page.locator('#page-content').getAttribute('class') || '',/theme-dark/);
  assert.doesNotMatch(await page.locator('#page-content').getAttribute('class') || '',/theme-light|offers-/);
  assert.equal(await page.locator('#title').textContent(),last.title);
  assert.equal(await page.locator('#offer1,#TC_Solo').count(),0);
  const url=await page.evaluate(()=>{let url='';window.open=(value)=>{url=String(value);return null;};document.getElementById('clickbox')!.click();return url;});
  assert.equal(url,last.destination.Url);
 } finally {await browser.close();}
});

test('both generic formats preserve custom bindings and conditions in font and snapshot outline output',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();
  await page.route('https://s0.2mdn.net/**',route=>route.abort());
  for(const size of Object.keys(demo.sizes)) {
   const doc=structuredClone(demo);
   const row={...doc.feed.sampleRows.at(-1),title:'Custom campaign copy',Default:true};
   doc.feed.sampleRows=[row];
   for(const renderMode of ['font','outline']) {
    const html=await renderStudioReadyHtml(doc,size,{renderMode,delivery:'static'});
    await page.setContent(html);
    await page.waitForFunction(()=>document.querySelector('.stage.motion-ready'));
    assert.match(await page.locator('#page-content').getAttribute('class') || '',/product-chair language-ga theme-dark/);
    assert.equal(await page.locator('#offer1,#TC_Solo,#bg-image').count(),0);
    assert.equal(await page.locator('#surface').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(36, 53, 45)');
    if(renderMode==='font') assert.equal(await page.locator('#title').textContent(),'Custom campaign copy');
    else {
     assert.ok(await page.locator('#title svg path').count()>0);
     assert.equal(await page.evaluate(()=>window.clickTag),row.destination.Url);
     assert.doesNotMatch(html,/<script src="https:\/\/s0.2mdn.net/);
    }
   }
  }
 } finally {await browser.close();}
},20000);

test('generic Studio bootstrap uses its authored profile and arbitrary fields',async()=>{
 const doc=structuredClone(demo);doc.feed.studioProfileId=123456;doc.feed.studioProfileElement='Product_Profile';
 const html=await renderStudioReadyHtml(doc,'300x250',{includeStudioDynamicContent:true,includePreviewBridge:false});
 assert.match(html,/Enabler.setProfileId\(123456\)/);
 assert.match(html,/dynamicContent\["Product_Profile"\]/);
 assert.match(html,/Enabler.setDevDynamicContent\(dynamicContent\)/);
 assert.match(html,/"title":"Light your space"/);
 assert.doesNotMatch(html,/offer_count_num/);
});

test('generic bound images use current row assets in font and outline at both sizes',async()=>{
 const doc=structuredClone(demo);
 doc.feed.sampleRows=[{...doc.feed.sampleRows[0],hero:{Url:'assets/SVG/SSELogoWhite.svg'},Default:true}];
 for(const [size,creative] of Object.entries(doc.sizes)) {
  creative.layers.push({id:'product-image',kind:'image',asset:'assets/SVG/SSELogoBlue.svg',binding:{field:'hero'},base:{cssClass:'product-image',left:5,top:5,width:20,height:20},clips:[]});
  const font=await renderStudioReadyHtml(doc,size,{includePreviewBridge:true});
  assert.match(font,/id="product-image"[^>]+data-dco-field="hero"/);
  const outline=await renderStudioReadyHtml(doc,size,{renderMode:'outline',delivery:'static'});
  const image=outline.match(/<img[^>]+id="product-image"[^>]+>/)?.[0] || '';
  assert.match(image,/src="assets\/SSELogoWhite.svg"|src="assets\/SVG\/SSELogoWhite.svg"|src="data:image/);
  assert.doesNotMatch(image,/SSELogoBlue/);
 }
});

test('generic JSON bootstrap preserves comparison characters and normalized breaks without script injection',async()=>{
 const doc=structuredClone(demo);doc.feed.sampleRows=[{...doc.feed.sampleRows[0],title:'A < B<br>safe </script> text',Default:true}];
 const html=await renderStudioReadyHtml(doc,'300x250',{includeStudioDynamicContent:true});
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage();await page.route('https://s0.2mdn.net/**',route=>route.abort());await page.setContent(html);
  await page.waitForFunction(()=>window.__SSE_DCO_READY__);
  assert.equal(await page.locator('#title').textContent(),'A < B\nsafe </script> text');
 } finally {await browser.close();}
});
