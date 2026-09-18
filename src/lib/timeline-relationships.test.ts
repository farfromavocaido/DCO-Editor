// @ts-nocheck
import {expect,test} from 'vitest';
import {linkedMotionMembers,replaceLinkedMotion,clipBeatReferences,timelineFolders,detachClipTiming} from './timeline-relationships';
import {compileAnimationClips} from './creative-compiler';
import {keyTimelineBeats,moveTimelineBeat,setKeyTimelineBeat} from './timeline-beats';
import {unionPresence} from './timeline-presence';
const context={canvas:{width:100,height:100},parent:{width:100,height:100},durationS:10};
const clip=(id,start)=>({id,preset:'custom',keyframes:[{at:start,opacity:0,translate:[30,0]},{at:start+10,opacity:1,translate:[0,0]}]});
const setup=()=>({clock:{durationS:10,beats:{enter:10,exit:90}},sizes:{square:{layers:[{id:'a',clips:[clip('a',10)]},{id:'b',clips:[{...clip('b',30),copiedFrom:{layerId:'a',clipId:'a'},linked:true}]},{id:'c',clips:[clip('c',10)]}]}}});
test('preset similarity is not a link; explicit copied motion can be edited atomically',()=>{
 const d=setup();expect(linkedMotionMembers(d,'square','a','a').map(m=>m.layer.id)).toEqual(['a','b']);
 const next=clip('a',15);next.keyframes[1].opacity=.7;
 const result=replaceLinkedMotion(d,'square','a','a',next,{},context);
 expect(result.sizes.square.layers[1].clips[0].keyframes.map(f=>f.at)).toEqual([35,45]);
 expect(result.sizes.square.layers[1].clips[0].keyframes[1].opacity).toBe(.7);
 expect(result.sizes.square.layers[2]).toEqual(d.sizes.square.layers[2]);
 expect(d.sizes.square.layers[0].clips[0].keyframes[0].at).toBe(10);
 d.sizes.square.layers[1].clips[0].linked=false;expect(linkedMotionMembers(d,'square','a','a')).toHaveLength(1);
});
test('failed linked edits do not partially modify any member',()=>{
 const d=setup(),before=structuredClone(d);d.sizes.square.layers[1].clips[0].keyframes.pop();const invalid=structuredClone(d);
 expect(()=>replaceLinkedMotion(d,'square','a','a',clip('a',15),{},context)).toThrow(/different keyframes/);expect(d).toEqual(invalid);
});
test('timing references are explicit and key beats are a curated subset',()=>{
 const d=setup();d.sizes.square.layers[0].clips=[{id:'a',label:'enter',preset:'fade',start:'enter + 2',end:'exit'}];
 expect(clipBeatReferences(d.sizes.square.layers[0].clips[0],d.clock.beats)).toEqual(['enter','exit']);
 expect(keyTimelineBeats(d,d.clock.beats)).toEqual(['enter','exit']);
 const selected=setKeyTimelineBeat(d,'exit',false,d.clock.beats);expect(keyTimelineBeats(selected,d.clock.beats)).toEqual(['enter']);
 const moved=moveTimelineBeat(d,'enter',2,['frames-3']);expect(moved.clock.profiles['frames-3'].enter).toBe(20);expect(d.clock.beats.enter).toBe(10);
 const source=d.sizes.square.layers[0].clips[0],detached=detachClipTiming(source,d.clock.beats,10);
 expect(clipBeatReferences(detached,d.clock.beats)).toEqual([]);
 expect(compileAnimationClips([source],d.clock.beats,context)).toEqual(compileAnimationClips([detached],d.clock.beats,context));
});
test('timeline folders do not duplicate members or alter layers; presence summary unions holds',()=>{
 const layers=setup().sizes.square.layers,entries=layers.map(layer=>({kind:'layer',layer}));
 const groups=timelineFolders(entries,{timelineFolders:[{id:'folder',name:'Pair',members:['a','b']}],canvasGroups:[{id:'canvas',name:'Canvas',members:['a','c']}]});
 expect(groups.flatMap(g=>g.layer?[g.layer.id]:g.layers.map(l=>l.id))).toEqual(['a','b','c']);
 expect(unionPresence([{start:10,end:30},{start:20,end:40},{start:60,end:70}])).toEqual([{start:10,end:40},{start:60,end:70}]);
});
