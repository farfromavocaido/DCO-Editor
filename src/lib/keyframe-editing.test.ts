import {expect,test} from 'vitest';
import {editableKeyframes,editKeyframe,retimeClip,insertKeyframe} from './keyframe-editing';
import {compileAnimationClips,frameAtPercent} from './creative-compiler';
const context={durationS:10,canvas:{width:300,height:250},parent:{width:300,height:250}};
test('viewing a preset is read-only; editing a frame preserves its other sampled motion',()=>{
 const clip={id:'fade',preset:'fade',start:10,end:80,params:{enter_duration_pct:10,fade_pct:10}},before=structuredClone(clip);
 const frames=editableKeyframes(clip,{},context);expect(clip).toEqual(before);
 const index=frames.find(f=>f.at===20)!.index,next=editKeyframe(clip,index,{opacity:.6},{},context);
 expect(next.preset).toBe('custom');expect(next.keyframes[index].opacity).toBe(.6);expect(clip).toEqual(before);
 for(const at of [0,10,70,80,100])expect(frameAtPercent(compileAnimationClips([next],{},context),at)).toEqual(frameAtPercent(compileAnimationClips([clip],{},context),at));
});
test('custom retiming preserves values and timing relationships',()=>{
 const clip={id:'move',preset:'custom',keyframes:[{at:'begin',left:10},{at:40,left:30},{at:'end',left:60}]},beats={begin:20,end:60};
 const next=retimeClip(clip,10,90,beats,context);expect(next.keyframes.map(f=>f.at)).toEqual([10,50,90]);expect(next.keyframes.map(f=>f.left)).toEqual([10,30,60]);
 expect(()=>editKeyframe(clip,1,{at:65},beats,context)).toThrow(/neighbours/);
});
test('adding a frame samples existing motion and selects existing times without duplicates',()=>{
 const clip={id:'move',preset:'custom',keyframes:[{at:0,translate:[0,0]},{at:100,translate:[100,0]}]};
 const result=insertKeyframe(clip,50,{},context);expect(result.clip.keyframes[result.index].translate).toEqual([50,0]);expect(insertKeyframe(result.clip,50,{},context).clip.keyframes).toHaveLength(3);
});
test('editing a fade does not introduce transform channels which overwrite another clip',()=>{
 const fade={id:'fade',preset:'fade',start:10,end:80,params:{enter_duration_pct:10,fade_pct:10}},move={id:'move',preset:'custom',keyframes:[{at:0,translate:[40,50],scale:1.5},{at:100,translate:[40,50],scale:1.5}]};
 const index=editableKeyframes(fade,{},context).find(f=>f.at===20)!.index;
 const next=editKeyframe(fade,index,{opacity:.6},{},context);
 expect(next.keyframes.every(f=>f.translate===undefined&&f.scale===undefined)).toBe(true);
 for(const at of [0,10,20,50,80,100]){
  const before=frameAtPercent(compileAnimationClips([move,fade],{},context),at),after=frameAtPercent(compileAnimationClips([move,next],{},context),at);
  expect(after.translate).toEqual(before.translate);expect(after.scale).toEqual(before.scale);
 }
});
test('inserting inside an eased movement preserves the curve on both sides',()=>{
 for(const easing of ['linear','ease-in','ease-out','ease-in-out','cubic-bezier(0.16, 1, 0.3, 1)']){
  const clip={id:'move',preset:'custom',keyframes:[{at:0,translate:[0,0],easing},{at:100,translate:[100,0]}]},next=insertKeyframe(clip,35,{},context).clip;
  const before=compileAnimationClips([clip],{},context),after=compileAnimationClips([next],{},context);
  for(let at=0;at<=100;at+=5)expect(frameAtPercent(after,at).translate[0]).toBeCloseTo(frameAtPercent(before,at).translate[0],2);
 }
});
