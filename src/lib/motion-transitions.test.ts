import { expect, test } from 'vitest';
import { motionTransitions, retimeTransition, editTransitionEndpoint } from './motion-transitions';
import { addTimelineBeat, renameTimelineBeat } from './timeline-beats';
import { compileAnimationClips } from './creative-compiler';
const context = { durationS: 10, canvas: { width: 300, height: 250 }, parent: { width: 300, height: 250 } };
test('transition view omits holds without changing the original animation', () => {
 const clip = { id: 'fade', preset: 'fade' as const, start: 10, end: 80, params: { enter_duration_pct: 10, fade_pct: 10 } };
 const before = structuredClone(clip), transitions = motionTransitions(clip, {}, context);
 expect(transitions.map((t: any) => [t.label, t.start, t.end])).toEqual([['Fade in', 10, 20], ['Fade out', 70, 80]]);
 expect(clip).toEqual(before);
 const next = retimeTransition(clip, transitions[0], 5, 25, {}, context);
 expect(motionTransitions(next, {}, context).map((t: any) => [t.start, t.end])).toEqual([[5, 25], [70, 80]]);
 expect(next.keyframes.every((f: any) => f.scale === undefined && f.translate === undefined)).toBe(true);
 expect(() => retimeTransition(clip, transitions[0], 5, 75, {}, context)).toThrow(/neighbour/);
});
test('editing transition endpoints retains relative motion, other channels and indexed offsets', () => {
 const clip = { id:'move',preset:'custom' as const,geometryEdits:[{scope:'example',keyframeIndex:1,dx:2}],keyframes:[
  {at:10,translate:[{value:20,unit:'canvas'},0],opacity:0,easing:'ease-in'},
  {at:30,translate:[0,0],opacity:1},{at:80,translate:[0,0],opacity:1}
 ]};
 const transition=motionTransitions(clip,{},context)[0];
 const next=editTransitionEndpoint(clip,transition,'from',{opacity:.2},{},context);
 expect(next.keyframes[0].translate).toEqual(clip.keyframes[0].translate);
 expect(next.keyframes[0].easing).toBe('ease-in');
 expect(next.geometryEdits).toEqual(clip.geometryEdits);
 expect(next.keyframes.slice(1)).toEqual(clip.keyframes.slice(1));
});
test('beat naming leaves all timing references and rendered motion intact', () => {
 const clip = { id: 'fade', preset: 'fade' as const, start: 'begin', end: 90 };
 const doc = { clock: { durationS: 10, beats: { begin: 10 }, profiles: { alternate: { begin: 20 } } }, clips: [clip] };
 const renamed = renameTimelineBeat(doc, 'begin', 'Opening');
 expect(renamed.clips).toEqual(doc.clips); expect(renamed.clock.beats).toEqual(doc.clock.beats); expect(renamed.clock.profiles).toEqual(doc.clock.profiles);
 const result = addTimelineBeat(renamed, 'Reveal', 4);
 expect(result.document.clock.beats[result.id]).toBe(40);
 expect(compileAnimationClips([clip], result.document.clock.beats, context)).toEqual(compileAnimationClips([clip], doc.clock.beats, context));
 expect(() => addTimelineBeat(doc, 'Invalid', 11)).toThrow(/inside/);
});
