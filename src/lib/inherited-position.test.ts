// @ts-nocheck
import {expect,test} from 'vitest';
import {inheritedPositionSharing,setInheritedPositionIndependent} from './inherited-position';
import {findCreativeTarget,updateCreativeTargetValue} from './creative-model';
const fixture=()=>({campaign:{id:'sse-dco'},sizes:{'728x90':{canvas:{width:728,height:90},classRules:[{cssClass:'sse-headline',properties:{left:10,top:8,width:200,height:60}}],variantRules:[{id:'shared',scope:'offers-3',cssClass:'sse-headline',props:{left:18,top:12}}],layers:[1,2,3].map(i=>({id:`headline-act${i}`,label:`Headline ${i}`,kind:'text',base:{cssClass:'sse-headline'},fit:{},clips:[]}))}}});
test('inherited shared positions detach without changing appearance and reconnect without changing peers',()=>{
 const d=fixture(),s='728x90',id='headline-act3',scopes=['offers-3'];
 expect(inheritedPositionSharing(d,s,id,scopes).map(p=>p.members.length)).toEqual([2,2]);
 const independent=setInheritedPositionIndependent(d,s,id,scopes,true);
 expect(findCreativeTarget(independent,s,id,scopes).values).toEqual(findCreativeTarget(d,s,id,scopes).values);
 const moved=updateCreativeTargetValue(independent,s,id,scopes,'top',33);
 expect(findCreativeTarget(moved,s,id,scopes).values.top).toBe(33);
 expect(findCreativeTarget(moved,s,'headline-act1',scopes).values.top).toBe(12);
 expect(findCreativeTarget(moved,s,id,['offers-2']).values.top).toBe(8);
 const restored=setInheritedPositionIndependent(moved,s,id,scopes,false);
 expect(findCreativeTarget(restored,s,id,scopes).values.top).toBe(12);
 expect(restored.sizes[s].variantRules).toEqual(d.sizes[s].variantRules);
});

test('reconnection remains available when every member has a local position',()=>{
 let d=fixture();for(const id of ['headline-act1','headline-act2','headline-act3'])d=setInheritedPositionIndependent(d,'728x90',id,['offers-3'],true);
 const sharing=inheritedPositionSharing(d,'728x90','headline-act3',['offers-3']);expect(sharing).toHaveLength(2);expect(sharing.every(p=>p.independent&&p.members.every(m=>m.independent))).toBe(true);
 expect(inheritedPositionSharing(setInheritedPositionIndependent(d,'728x90','headline-act3',['offers-3'],false),'728x90','headline-act3',['offers-3']).every(p=>!p.independent)).toBe(true);
});
