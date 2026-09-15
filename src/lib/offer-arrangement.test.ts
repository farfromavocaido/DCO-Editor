import {afterAll,beforeAll,expect,test} from 'vitest';
import {chromium,type Browser} from 'playwright';
import {layoutOffersRuntime} from './offer-layout';
import {structuredRuleCss} from './creative-css';
import {materializeCreativeOwnership} from './creative-ownership';
import {useEditorStore} from '@/store/editor-store';
import {updateCreativeTargetValue} from './creative-model';
import {offerArrangementMode,setOfferArrangementMode,productionOfferArrangementSource} from './offer-arrangement';
let browser:Browser;
beforeAll(async()=>{browser=await chromium.launch({headless:true});});afterAll(async()=>{await browser?.close();});
const size='300x250';
const fixture=()=>({sizes:{[size]:{canvas:{width:300,height:250},layers:[{id:'offer-slot-1',kind:'group',base:{left:10,top:10,width:200,height:60},clips:[]}],classRules:[{cssClass:'offer-subline',properties:{left:70,top:8,width:100,height:20}},{cssClass:'offer-value',properties:{left:0,top:0,width:40,height:40,fontSize:32}}],variantRules:[]}}});
const css=(doc:any)=>structuredRuleCss(materializeCreativeOwnership(doc).sizes[size]);
const html=(doc:any,offerScope='offers-1 tc-prices')=>`<style>.stage{position:relative;width:300px;height:250px}.offer-slot-1{position:absolute;left:10px;top:10px;width:200px;height:60px}.offer-value,.offer-subline{position:absolute;margin:0;font:20px/1.2 Arial}.offer-subline{display:flex;align-items:flex-start}${css(doc)}</style><main class="stage ${offerScope}" data-size="300x250"><div id="offer1" class="offer-slot-1" data-gwd-group="OfferSlot"><p class="offer-value"><span class="offer-value-run">25%</span></p><p class="offer-subline">OFF</p></div></main>`;

test('manual arrangement preserves rendered positions then permits a genuine subline move',async()=>{
 const original=fixture();const page=await browser.newPage();
 try{
  await page.setContent(html(original));
  const snapshot=await page.evaluate(({layout,capture})=>{
   new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)();
   return new Function(`return ${capture}`)()(document.querySelector('.stage'),['offer-slot-1']);
  },{layout:layoutOffersRuntime,capture:productionOfferArrangementSource});
  const manual=setOfferArrangementMode(original,size,['offers-1','tc-prices'],'manual',snapshot);
  useEditorStore.setState({creativeDocument:original,size,history:[],historyIndex:-1});
  useEditorStore.getState().applyCreativeOwnershipDocument(manual);
  useEditorStore.getState().undo();expect(useEditorStore.getState().creativeDocument).toEqual(original);
  useEditorStore.getState().redo();expect(useEditorStore.getState().creativeDocument).toEqual(manual);
  await page.setContent(html(manual));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  const read=()=>page.locator('.offer-subline').evaluate(el=>parseFloat(getComputedStyle(el).left));
  const before=await read();expect(before).toBeCloseTo(snapshot.find((item:any)=>item.targetId.endsWith('::offer-subline')).left,3);
  const moved=updateCreativeTargetValue(manual,size,'offer-slot-1::offer-subline',['offers-1','tc-prices'],'left',before+23);
  await page.setContent(html(moved));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  expect(await read()).toBeCloseTo(before+23,3);
  expect(original.sizes[size].localOverrides).toBeUndefined();
  const automatic=setOfferArrangementMode(moved,size,['offers-1','tc-prices'],'auto',snapshot);
  expect(materializeCreativeOwnership(automatic).sizes[size].localOverrides.find((item:any)=>item.targetId==='offer-slot-1::offer-subline')?.values.left).toBeUndefined();
  await page.setContent(html(moved,'offers-2 tc-prices'));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  const otherAfter=await read();await page.setContent(html(original,'offers-2 tc-prices'));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  expect(otherAfter).toBeCloseTo(await read(),3);
  await page.setContent(html(moved,'offers-1 tc-solo'));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  const compoundAfter=await read();await page.setContent(html(original,'offers-1 tc-solo'));await page.evaluate(layout=>new Function(`${layout};layoutOffers(document.querySelector('.stage'));`)(),layoutOffersRuntime);
  expect(compoundAfter).toBeCloseTo(await read(),3);
 }finally{await page.close();}
});


test('mode label ignores manual ownership on state-hidden slots',()=>{
 const document:any=fixture();
 document.sizes[size].layers.push({id:'offer-slot-3',kind:'group',base:{visibility:'hidden'},clips:[]});
 document.sharedDefinitions=[{id:'hidden-manual',name:'Hidden manual',values:{'--offer-layout-mode':'manual'},members:[{size,targetId:'offer-slot-3'}]}];
 document.sizes[size].variantRules=[{id:'show-third',layerId:'offer-slot-3',scope:'offers-3',props:{visibility:'visible'}}];
 expect(offerArrangementMode(document,size,['offers-1','tc-prices'])).toBe('auto');
 expect(offerArrangementMode(document,size,['offers-3','tc-prices'])).toBe('manual');
});
