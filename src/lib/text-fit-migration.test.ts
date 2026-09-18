// @ts-nocheck
import {expect,test} from 'vitest';
import {migrateTextFitting} from './text-fit-migration';
import {findCreativeTarget} from './creative-model';
import {effectiveTextFitForTarget} from './text-fit-rules';
const fixture=()=>({campaign:{id:'product-demo'},clock:{durationS:7,beats:{}},variantModel:{dimensions:[{id:'theme',field:'theme',defaultValue:'a',options:[{value:'a',scope:'a'},{value:'b',scope:'b'}]}]},sizes:{small:{canvas:{width:200,height:100},layers:[{id:'heading',kind:'text',base:{left:10,top:10,width:150,height:30,fontSize:14},fit:{mode:'shrink',maxLines:2,minFontSize:18},clips:[{id:'fade',preset:'fade',start:0,end:100}]}],variantRules:[{id:'other',layerId:'heading',scope:'b',props:{fontSize:25},fit:{mode:'wrap',maxLines:3}}]}}});
test('conversion is explicit, scoped, preserves artwork and corrects reversed bounds',()=>{
 const d=fixture(),before=structuredClone(d),next=migrateTextFitting(d).document;
 expect(d).toEqual(before);expect(next.clock).toEqual(d.clock);expect(next.sizes.small.layers[0].clips).toEqual(d.sizes.small.layers[0].clips);
 expect(findCreativeTarget(next,'small','heading',['a']).values).toMatchObject({left:10,top:10,width:150,height:30,fontSize:18});
 expect(effectiveTextFitForTarget(next,'small','heading',['a'])).toMatchObject({frame:'fixed',minFontSize:14,allowShrink:true,maxLines:2});
 expect(effectiveTextFitForTarget(next,'small','heading',['b'])).toMatchObject({frame:'fixed',allowShrink:false,maxLines:3});
 expect(findCreativeTarget(next,'small','heading',['b']).values.fontSize).toBe(25);
});
