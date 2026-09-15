import { expect, test } from 'vitest';
import { compileAnimationClips, type AnimationClip } from './creative-compiler';
import { createAnimationIntentClip } from './animation-intents';

const context = { canvas: { width: 300, height: 250 }, parent: { width: 120, height: 80 }, durationS: 20 };

test('relative custom motion uses canvas or parent dimensions independently by axis', () => {
  const frames = compileAnimationClips([{id:'move',preset:'custom',start:0,keyframes:[{at:0,translate:[{value:25,unit:'canvas'},{value:-50,unit:'parent'}]},{at:100,translate:[0,0]}]}], {}, context);
  expect(frames[0].translate).toEqual([75,-40]);
});

test('pixel preset distances remain pixels and relative preset distances use context', () => {
  const legacy: AnimationClip = {id:'move',preset:'slideInRight',start:0,end:50,params:{enter_distance_px:20}};
  expect(compileAnimationClips([legacy],{},context)[0].translate).toEqual([20,0]);
  expect(compileAnimationClips([{...legacy,params:{enter_distance:{value:25,unit:'canvas'}}}],{},context)[0].translate).toEqual([75,0]);
});

test('relative distances never silently fall back to element percentages or zero', () => {
  expect(() => compileAnimationClips([{id:'move',preset:'fadeUp',start:0,params:{enter_dy:{value:20,unit:'parent'}}}],{})).toThrow(/parent/);
});

test('seconds and timeline percentages resolve separately from motion distances', () => {
  const frames = compileAnimationClips([{id:'move',preset:'custom',start:0,keyframes:[{at:{value:2,unit:'seconds'},translate:[{value:10,unit:'canvas'},0]},{at:{value:50,unit:'timeline-percent'},translate:[0,0]}]}],{},context);
  expect(frames.find(f=>f.at===10)?.translate).toEqual([30,0]);
  expect(frames.find(f=>f.at===50)?.translate).toEqual([0,0]);
});

test('authoring an intent retains distance units in the document for each format', () => {
  const clip = createAnimationIntentClip({layerId:'headline',intentId:'slideInRight',anchorPct:10,durationS:20,distance:{value:10,unit:'canvas'},motionDuration:{value:2,unit:'seconds'}}) as AnimationClip;
  expect(clip.keyframes![0].translate).toEqual([{value:10,unit:'canvas'},0]);
  expect(clip.end).toBe(20);
  expect(compileAnimationClips([clip],{},context).find(f=>f.at===10)?.translate).toEqual([30,0]);
  expect(compileAnimationClips([clip],{},{...context,canvas:{width:970,height:250}}).find(f=>f.at===10)?.translate).toEqual([97,0]);
});

test('live headline runtime preserves relative custom movement when it overrides CSS', async () => {
  const { headlineTransitionRuntimeBlock } = await import('./headline-motion');
  const layers = [{id:'headline-act1',base:{},clips:[{id:'move',preset:'custom',start:0,end:30,keyframes:[{at:0,translate:[{value:10,unit:'canvas'},0],opacity:0},{at:{value:2,unit:'seconds'},translate:[0,0],opacity:1},{at:30,translate:[0,0],opacity:0}]}]}];
  const source = headlineTransitionRuntimeBlock(layers,{'frames-3':{}},20,false,context);
  const plan = new Function(`${source}; return __buildHeadlineMotionPlan({offer_count_num:1,heading1_text:'A'},'frames-3');`)();
  expect(plan[0].keyframes[0].translate).toEqual([30,0]);
  expect(plan[0].keyframes.find((frame:{at:number})=>frame.at===10)?.opacity).toBe(1);
});
