import { afterAll, beforeAll, expect, test } from 'vitest';
import { chromium, type Browser } from 'playwright';
import { layoutOffersRuntime } from './offer-layout';
let browser:Browser;
beforeAll(async()=>{browser=await chromium.launch({headless:true});});
afterAll(async()=>{await browser?.close();});
const html = `<style>
.stage{position:relative;width:300px;height:100px}.slot{position:absolute;width:100px;height:60px;top:10px}.a{left:10px}.b{left:180px}
.offer-value{position:absolute;left:0;top:0;width:30px;height:40px;font:30px/1 sans-serif;margin:0}.offer-subline{position:absolute;left:40px;top:8px;width:60px;height:24px;font:12px/1 sans-serif;display:flex;align-items:flex-start;margin:0}
.plus-1{position:absolute;left:140px;top:20px;width:10px;height:10px;font:10px/1 sans-serif}
.empty .slot,.empty .plus-1{visibility:hidden}.empty .offer-subline{left:44px;top:19px}
</style><main class="stage" data-size="300x100"><div class="slot a" data-gwd-group="OfferSlot" data-offer-index="1"><p class="offer-value"><span class="offer-value-run">25%</span></p><p class="offer-subline">OFF ELECTRICITY</p></div><div class="slot b" data-gwd-group="OfferSlot" data-offer-index="2"><p class="offer-value"><span class="offer-value-run">15%</span></p><p class="offer-subline">OFF GAS</p></div><span class="plus-1">+</span></main>`;

test.each(['auto','manual'])('offer layout restores inactive nodes before filtering in %s mode',async mode=>{
 const page=await browser.newPage();
 try {
  await page.setContent(html);
  const result=await page.evaluate(({runtime,mode})=>{
    const layout=new Function(`${runtime};return layoutOffers;`)();
    const stage=document.querySelector<HTMLElement>('.stage')!;
    stage.dataset.offerPlusLayout=mode;
    const fresh=stage.cloneNode(true) as HTMLElement;
    const read=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>('.slot,.offer-subline,.plus-1')].map(el=>{const css=getComputedStyle(el);return {left:css.left,top:css.top,width:css.width,align:css.alignItems};});
    const original=read(stage);layout(stage);const moved=JSON.stringify(read(stage))!==JSON.stringify(original);
    const blank=(root:HTMLElement)=>{root.classList.add('empty');root.querySelectorAll('.offer-value-run,.offer-subline').forEach(el=>el.textContent='');};
    blank(stage);layout(stage);blank(fresh);document.body.append(fresh);layout(fresh);
    return {moved,reused:read(stage),fresh:read(fresh)};
  },{runtime:layoutOffersRuntime,mode});
  expect(result.moved).toBe(true);
  expect(result.reused).toEqual(result.fresh);
 }finally{await page.close();}
});

test('switching auto to manual restores authored inline positions and leaves unrelated properties intact',async()=>{
 const page=await browser.newPage();
 try{
  await page.setContent(html);
  const result=await page.evaluate(runtime=>{
    const layout=new Function(`${runtime};return layoutOffers;`)();
    const stage=document.querySelector<HTMLElement>('.stage')!;
    const slot=stage.querySelector<HTMLElement>('.a')!;slot.style.left='17px';slot.style.top='13px';slot.style.width='110px';
    const plus=stage.querySelector<HTMLElement>('.plus-1')!;plus.style.setProperty('left','145px','important');plus.style.top='23px';
    const fresh=stage.cloneNode(true) as HTMLElement;
    layout(stage);slot.style.borderColor='red';stage.dataset.offerPlusLayout='manual';layout(stage);
    fresh.dataset.offerPlusLayout='manual';document.body.append(fresh);layout(fresh);
    const read=(root:HTMLElement)=>[...root.querySelectorAll<HTMLElement>('.slot,.plus-1')].map(el=>({left:el.style.left,top:el.style.top,width:el.style.width,priority:el.style.getPropertyPriority('left')}));
    return {reused:read(stage),fresh:read(fresh),border:slot.style.borderColor};
  },layoutOffersRuntime);
  expect(result.reused).toEqual(result.fresh);
  expect(result.reused[0]).toMatchObject({left:'17px',top:'13px',width:'110px'});
  expect(result.reused[2]).toMatchObject({left:'145px',top:'23px',priority:'important'});
  expect(result.border).toBe('red');
 }finally{await page.close();}
});
