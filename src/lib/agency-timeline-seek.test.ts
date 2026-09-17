import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  agencyTimelineSeekEvaluateSource,
  seekAgencyTimeline,
} from './agency-timeline-seek';

test('serialized QA seek pauses the same animations at the requested time',()=>{
 for(const time of [0,1375,18000]){
  let paused=false;const animation={currentTime:-1,pause(){paused=true;}};
  const root={classList:{contains:()=>true},getAnimations:()=>[animation]};
  const run=new Function('document',`return ${agencyTimelineSeekEvaluateSource(time)}`);
  assert.equal(run({getElementById:()=>root}),1);assert.equal(animation.currentTime,time);assert.equal(paused,true);
 }
});

test('seekAgencyTimeline pauses animations and sets currentTime', () => {
  const calls: Array<{ pause?: boolean; time?: number }> = [];
  const anim = {
    pause() { calls.push({ pause: true }); },
    set currentTime(value: number) { calls.push({ time: value }); },
    get currentTime() { return 0; },
  };
  const root = {
    classList: {
      contains: () => true,
      add() {},
    },
    getAnimations() { return [anim]; },
  } as unknown as Element;

  assert.equal(seekAgencyTimeline(root, 1500), 1);
  assert.deepEqual(calls, [{ pause: true }, { time: 1500 }]);
});


test('seeking never releases a runtime that is still fitting', () => {
  const root = {
    classList: { contains: () => false, add() { throw new Error('must not force readiness'); } },
    getAnimations() { throw new Error('must not seek before readiness'); },
  } as unknown as Element;
  assert.equal(seekAgencyTimeline(root, 1500), 0);
  const evaluate = new Function('document', `return ${agencyTimelineSeekEvaluateSource(1500)}`);
  assert.equal(evaluate({ getElementById: () => root }), 0);
});
