import { afterAll, beforeAll, expect, test } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { textFitEngineSource } from './text-fit';
import { updateCreativeTargetFit } from './creative-model';
import { propsWithFitBudget } from './fit-box';
import { effectiveTextFitForTarget, normalizeFitConfig, textFitRulesForSize } from './text-fit-rules';

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ headless: true }); });
afterAll(async () => { await browser?.close(); });

async function fit(html: string, rule: Record<string, unknown>) {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>.target{font:20px/1.2 sans-serif;width:100px;height:24px;margin:0;position:relative}</style>${html}`);
    return await page.evaluate(({ source, rule }) => {
      const factory = new Function(`return ${source}`)();
      const elements = [...document.querySelectorAll<HTMLElement>('.target')];
      const before = elements.map(e => ({ x: e.offsetLeft, y: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight }));
      const results = factory(window).applyRules(document.body, [rule]);
      return { results, before, after: elements.map(e => ({ x:e.offsetLeft,y:e.offsetTop,width:e.offsetWidth,height:e.offsetHeight,size:parseFloat(getComputedStyle(e).fontSize),overflow:getComputedStyle(e).overflow,reason:e.getAttribute('data-fit-clip-reason') })) };
    }, { source: textFitEngineSource(), rule: { cssClass: 'target', ...rule } });
  } finally { await page.close(); }
}

test('explicit fixed frame does not acquire a max-lines geometry budget', () => {
  const props = { top: 20, fontSize: 20, lineHeight: 1, alignItems: 'flex-end' };
  expect(propsWithFitBudget(props, { frame: 'fixed', maxLines: 4 })).toEqual(props);
});

test('explicit policy keeps wrapping and shrinking independent from legacy mode', () => {
  expect(normalizeFitConfig({ frame:'fixed', mode:'wrap', wrap:false, allowShrink:true, overflow:'visible' })).toMatchObject({frame:'fixed',wrap:false,allowShrink:true,overflow:'visible'});
});

test('full shaped multiline text must fit frame height without shrinking the frame', async () => {
  const result = await fit('<p class="target">alpha beta gamma delta epsilon</p>', {frame:'fixed',wrap:true,allowShrink:true,maxLines:2,minFontSize:8,overflow:'clip'});
  expect(result.after[0].size).toBeLessThan(20);
  expect(result.after[0]).toMatchObject(result.before[0]);
  expect(result.results[0].diagnostics[0]).toMatchObject({requestedSize:20,renderedSize:result.after[0].size,reasons:[]});
});

test('impossible fixed-size fit reports height and max lines even with visible overflow', async () => {
  const result = await fit('<p class="target">alpha beta gamma delta epsilon zeta eta theta</p>', {frame:'fixed',wrap:true,allowShrink:false,maxLines:1,minFontSize:8,overflow:'visible'});
  expect(result.after[0]).toMatchObject({...result.before[0],size:20,overflow:'visible'});
  expect(result.results[0].clipped).toBe(true);
  expect(result.results[0].diagnostics[0].reasons).toEqual(expect.arrayContaining(['height','max-lines']));
});

test('a contradictory minimum remains visible instead of silently clamping configuration', async () => {
  const result = await fit('<p class="target" style="font-size:6px">short</p>', {frame:'fixed',wrap:false,allowShrink:true,minFontSize:10,overflow:'clip'});
  expect(result.after[0].size).toBe(6);
  expect(result.results[0].diagnostics[0].reasons).toContain('minimum-size');
});

test('shared explicit fitting includes opacity-hidden active animation members', async () => {
  const result = await fit('<p class="target">short</p><p class="target" style="opacity:0">supercalifragilistic</p>', {frame:'fixed',wrap:false,shared:true,minFontSize:8,overflow:'clip'});
  expect(result.after[0].size).toEqual(result.after[1].size);
  expect(result.after[0].size).toBeLessThan(20);
});

test('unscoped fit overrides and compound scopes reach runtime in specificity order', () => {
  const rules = textFitRulesForSize({layers:[{id:'body',kind:'text',base:{fontSize:20},fit:{maxLines:1}}],variantRules:[
    {layerId:'body',scope:'offers-0.roundel-copy-only',fit:{maxLines:4}},
    {layerId:'body',scope:'offers-0',fit:{maxLines:3}},
    {layerId:'body',fit:{maxLines:2,frame:'fixed'}},
  ]});
  const body = rules.find((r: {cssClass:string}) => r.cssClass === 'body');
  expect(body).toMatchObject({maxLines:2,frame:'fixed'});
  expect(Object.keys(body.scopes)).toEqual(['offers-0','offers-0.roundel-copy-only']);
});

test('target-specific fit edits affect one headline rather than its CSS siblings', async () => {
  const rules = textFitRulesForSize({ layers: [
    { id:'headline-act1',kind:'text',base:{fontSize:20},fit:{frame:'fixed',wrap:false,allowShrink:false,shared:false} },
    { id:'headline-act2',kind:'text',base:{fontSize:20} },
  ], variantRules:[{targetId:'headline-act1',layerId:'headline-act1',cssClass:'sse-headline',scope:'offers-0',fit:{allowShrink:true,minFontSize:8}}] });
  const page = await browser.newPage();
  try {
    await page.setContent('<style>.sse-headline{font:20px/1.2 sans-serif;width:100px;height:24px;margin:0}</style><main class="offers-0"><p class="sse-headline" id="headline-act1">a very long headline</p><p class="sse-headline" id="headline-act2">a very long headline</p></main>');
    const sizes = await page.evaluate(({source,rules})=>{
      new Function(`return ${source}`)()(window).applyRules(document.querySelector('main'),rules);
      return [...document.querySelectorAll('.sse-headline')].map(e=>parseFloat(getComputedStyle(e).fontSize));
    },{source:textFitEngineSource(),rules});
    expect(sizes[0]).toBeLessThan(20);
    expect(sizes[1]).toBe(20);
  } finally { await page.close(); }
});

test('content-height policy allows the frame to grow while preserving font size', async () => {
  const result = await fit('<p class="target">alpha beta gamma delta epsilon</p>',{frame:'auto',wrap:true,allowShrink:false,overflow:'visible'});
  expect(result.after[0].height).toBeGreaterThan(24);
  expect(result.after[0].size).toBe(20);
  expect(result.results[0].diagnostics[0].reasons).toEqual([]);
});

test('explicit sizing can override a legacy clipping mode', () => {
  expect(normalizeFitConfig({frame:'fixed',mode:'clip',allowShrink:true})).toMatchObject({allowShrink:true});
  expect(normalizeFitConfig({frame:'fixed',mode:'clip',allowShrink:true}).static).toBeUndefined();
});


test('shared size membership survives target-specific policy overrides', async () => {
  const rules = textFitRulesForSize({ layers: [
    { id:'headline-act1',kind:'text',base:{fontSize:20},fit:{frame:'fixed',wrap:false,shared:true,minFontSize:8} },
    { id:'headline-act2',kind:'text',base:{fontSize:20} },
  ], variantRules:[{targetId:'headline-act1',layerId:'headline-act1',cssClass:'sse-headline',fit:{overflow:'visible'}}] });
  const page = await browser.newPage();
  try {
    await page.setContent('<style>.sse-headline{font:20px/1.2 sans-serif;width:100px;height:24px;margin:0}</style><main><p class="sse-headline" id="headline-act1">short</p><p class="sse-headline" id="headline-act2">a very long headline</p></main>');
    const sizes = await page.evaluate(({source,rules})=>{
      new Function(`return ${source}`)()(window).applyRules(document.querySelector('main'),rules);
      return [...document.querySelectorAll('.sse-headline')].map(e=>parseFloat(getComputedStyle(e).fontSize));
    },{source:textFitEngineSource(),rules});
    expect(sizes[0]).toEqual(sizes[1]);
  } finally { await page.close(); }
});


test('state-inactive members do not constrain the active shared fit', async () => {
  const result = await fit('<p class="target">short</p><div style="visibility:hidden"><p class="target">supercalifragilistic</p></div><div style="display:none"><p class="target">supercalifragilistic</p></div>', {frame:'fixed',wrap:false,shared:true,minFontSize:8,overflow:'clip'});
  expect(result.after[0].size).toBe(20);
  expect(result.results[0].diagnostics).toHaveLength(1);
});

test.each(['clip','truncate'])('explicit font sizing can override a scoped %s mode in the production runtime', async (mode) => {
  const document = {sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'target',kind:'text',base:{fontSize:20},fit:{frame:'fixed',wrap:false,minFontSize:8},clips:[]}],variantRules:[{id:'scoped-mode',layerId:'target',scope:'offers-1',fit:{mode}}]}}};
  const updated = updateCreativeTargetFit(document,'300x250','target',['offers-1'],'allowShrink',true);
  const effective = effectiveTextFitForTarget(updated,'300x250','target',['offers-1']);
  const result = await fit('<p class="target">a very long headline</p>', effective);
  expect(result.after[0].size).toBeLessThan(20);
});
