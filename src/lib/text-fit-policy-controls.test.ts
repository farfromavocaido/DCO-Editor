// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test } from 'vitest';
import { TextFitPolicyControls } from '@/components/TextFitPolicyControls';
import { effectiveTextFitForTarget } from '@/lib/text-fit-rules';
import { updateCreativeTargetFit } from '@/lib/creative-model';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(()=>{for(const root of roots.splice(0)) act(()=>root.unmount());document.body.innerHTML='';});

const fixture = (cssClass='sse-headline',id='headline-act1') => ({ sizes:{'300x250':{canvas:{width:300,height:250},layers:cssClass==='offer-value'?[{id:'offer-slot-1',kind:'group',base:{},clips:[]}]:[{id,kind:'text',base:{cssClass,fontSize:20},fit:{frame:'fixed'},clips:[]}],classRules:cssClass==='offer-value'?[{cssClass:'offer-value',properties:{fontSize:20},fit:{frame:'fixed'}}]:[],variantRules:[]} } });
const selectFor = (container:HTMLElement,label:string) => [...container.querySelectorAll('label')].find(element=>element.querySelector('span')?.textContent===label)?.querySelector('select') as HTMLSelectElement;

test.each([['sse-headline','headline-act1'],['offer-value','offer-slot-1::offer-value']])('controls display effective %s family equalisation without authoring it', (cssClass,id) => {
  const creative = fixture(cssClass,id);
  const authored = structuredClone(creative);
  const container = document.body.appendChild(document.createElement('div'));
  const root=createRoot(container); roots.push(root);
  const effectiveRule=effectiveTextFitForTarget(creative,'300x250',id,[]);
  act(()=>root.render(createElement(TextFitPolicyControls, {fit:{frame:'fixed'}, effectiveRule, onChange:()=>{throw new Error('reading controls must not author defaults');}})));
  expect(selectFor(container,'Fit equalisation').value).toBe('shared');
  expect(creative).toEqual(authored);
});

test('independent sizing control writes the selected allowShrink field into active document scope', () => {
  let creative:any=fixture('body','body');
  creative.sizes['300x250'].variantRules=[{id:'body-clip',layerId:'body',cssClass:'body',scope:'offers-1',fit:{mode:'clip'}}];
  const container=document.body.appendChild(document.createElement('div'));
  const root=createRoot(container);roots.push(root);
  act(()=>root.render(createElement(TextFitPolicyControls, {fit:{frame:'fixed',mode:'clip'},effectiveRule:{frame:'fixed',allowShrink:false,overflow:'clip'},onChange:(field,value)=>{creative=updateCreativeTargetFit(creative,'300x250','body',['offers-1'],field,value);}})));
  const select=selectFor(container,'Font sizing');
  act(()=>{select.value='shrink';select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(creative.sizes['300x250'].variantRules[0].fit.allowShrink).toBe(true);
  const effectiveRule=effectiveTextFitForTarget(creative,'300x250','body',['offers-1']);
  expect(effectiveRule).toMatchObject({frame:'fixed',allowShrink:true,overflow:'clip'});
  expect(effectiveRule.static).toBeUndefined();
  act(()=>root.render(createElement(TextFitPolicyControls,{fit:{frame:'fixed',mode:'clip',allowShrink:true},effectiveRule,onChange:()=>{}})));
  expect(selectFor(container,'Font sizing').value).toBe('shrink');
});
