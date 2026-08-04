import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  agencyTimelineSeekEvaluateSource,
  seekAgencyTimeline,
} from './agency-timeline-seek';

test('evaluate source seeks page-content animations like qa capture', () => {
  const source = agencyTimelineSeekEvaluateSource(4250);
  assert.match(source, /getElementById\('page-content'\)/);
  assert.match(source, /getAnimations/);
  assert.match(source, /subtree:\s*true/);
  assert.match(source, /currentTime = t/);
  assert.match(source, /4250/);
  assert.match(source, /motion-ready/);
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
      contains: () => false,
      add() {},
    },
    getAnimations() { return [anim]; },
  } as unknown as Element;

  assert.equal(seekAgencyTimeline(root, 1500), 1);
  assert.deepEqual(calls, [{ pause: true }, { time: 1500 }]);
});
