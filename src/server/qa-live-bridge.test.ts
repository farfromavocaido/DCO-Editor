import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('live QA and capture share apply + seek bridge contracts', () => {
  const seekSrc = fs.readFileSync(path.join(root, 'src/lib/agency-timeline-seek.ts'), 'utf8');
  const captureSrc = fs.readFileSync(path.join(root, 'scripts/qa-dco/capture.ts'), 'utf8');
  const shellSrc = fs.readFileSync(path.join(root, 'src/server/qa-agency-shell.ts'), 'utf8');
  const qaAppSrc = fs.readFileSync(path.join(root, 'src/components/qa/QaReviewApp.tsx'), 'utf8');

  assert.match(seekSrc, /getAnimations/);
  assert.match(seekSrc, /agencyTimelineSeekEvaluateSource/);
  assert.match(captureSrc, /agencyTimelineSeekEvaluateSource/);
  assert.match(captureSrc, /applySseDcoRuntimeState/);
  assert.match(qaAppSrc, /applySseDcoRuntimeState/);
  assert.match(qaAppSrc, /seekAgencyTimeline/);
  assert.match(shellSrc, /canonical-agency/);
  assert.match(shellSrc, /\.qa-work/);
});
