// @vitest-environment jsdom
import {expect,test} from 'vitest';
import {productionElementPresent} from './timeline-presence';
test('presence includes partial on-canvas visibility and excludes transparent or off-canvas elements',()=>{
 const stage=document.body.appendChild(document.createElement('div')),parent=stage.appendChild(document.createElement('div')),element=parent.appendChild(document.createElement('div'));
 stage.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:100,width:100,height:100}) as DOMRect;
 element.getBoundingClientRect=()=>({left:-10,top:0,right:10,bottom:20,width:20,height:20}) as DOMRect;
 stage.style.opacity='1';parent.style.opacity='1';element.style.opacity='1';
 expect(productionElementPresent(stage,element)).toBe(true);
 parent.style.opacity='0';expect(productionElementPresent(stage,element)).toBe(false);
 parent.style.opacity='0.001';expect(productionElementPresent(stage,element)).toBe(true);
 element.getBoundingClientRect=()=>({left:100,top:0,right:120,bottom:20,width:20,height:20}) as DOMRect;
 expect(productionElementPresent(stage,element)).toBe(false);stage.remove();
});
