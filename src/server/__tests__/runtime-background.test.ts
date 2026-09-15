import { test, expect } from 'vitest';
import { chromium } from 'playwright';
import path from 'node:path';
import { readCreativeDocument } from '../creative-document';
import { renderStudioReadyHtml, renderWipHtml } from '../creative-exporter';
import { projectRoot } from '../paths';

for (const packaged of [false,true]) test(`blank replacement rows reset backgrounds (packaged fallback=${packaged})`,async()=>{
  const doc=await readCreativeDocument() as Record<string,any>;
  const size='300x250';
  doc.sizes[size].assets.background='fixture-bg.svg';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="250"><rect width="300" height="250" fill="green"/></svg>';
  const first={...doc.feed.sampleRows[0],background_image_url_300x250:{Url:`data:image/svg+xml,${encodeURIComponent(svg)}`}};
  const html=renderWipHtml(await renderStudioReadyHtml(doc,size,{fontBasePath:'assets/fonts/',includePackagedBackground:packaged,includePreviewBridge:true}),first);
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    await page.route('http://background-test.local/**',async route=>{
      const name=new URL(route.request().url()).pathname.slice(1);
      if(name==='index.html')return route.fulfill({contentType:'text/html',body:html});
      if(name==='fixture-bg.svg')return route.fulfill({contentType:'image/svg+xml',body:svg});
      try{await route.fulfill({path:path.join(projectRoot,name)});}catch{await route.fulfill({status:404,body:''});}
    });
    await page.route('https://s0.2mdn.net/ads/studio/Enabler.js',route=>route.fulfill({contentType:'application/javascript',body:''}));
    await page.goto('http://background-test.local/index.html');
    await page.waitForFunction('document.querySelector(".stage.motion-ready")');
    expect(await page.locator('#bg-image').getAttribute('src')).toBe(first.background_image_url_300x250.Url);
    await page.evaluate(row=>(window as any).applySseDcoRuntimeState(row),{...first,background_image_url_300x250:{Url:''}});
    expect(await page.locator('#bg-image').getAttribute('src')).toBe(packaged?'fixture-bg.svg':'');
  }finally{await browser.close();}
},30000);
