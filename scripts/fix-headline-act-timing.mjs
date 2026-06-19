#!/usr/bin/env node
/**
 * Correct headline act placement:
 * H1/H2 over offers, H3 over roundel, H4 over CTA, T&Cs exit at CTA frame.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../campaign/sse-dco-creative.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

const f3 = doc.clock.profiles['frames-3'];
const f4 = doc.clock.profiles['frames-4'];

doc.clock.beats.act4_in = doc.clock.beats.cta_in;
doc.clock.beats.tc_exit = doc.clock.beats.cta_in;
// Roundel off: H4 handoff at swap; T&Cs still exit at CTA frame.
f3.act4_in = Number((f3.swap + 0.1).toFixed(1));
f3.tc_exit = f3.cta_in;
f4.act4_in = f4.cta_in;
f4.tc_exit = f4.cta_in;

const H4_START_FRAMES_3 = {
  '320x50': 'bn_cta_in',
};

for (const sizeCreative of Object.values(doc.sizes)) {
  const h2 = sizeCreative.layers.find((l) => l.id === 'headline-act2');
  const h3 = sizeCreative.layers.find((l) => l.id === 'headline-act3');
  const h4 = sizeCreative.layers.find((l) => l.id === 'headline-act4');

  const h2f3 = h2?.clips?.find((c) => c.profiles?.includes('frames-3'));
  const h2f4 = h2?.clips?.find((c) => c.profiles?.includes('frames-4'));
  if (h2f3) h2f3.end = 'offers_exit';
  if (h2f4) h2f4.end = 'offers_exit';

  const h3f4 = h3?.clips?.find((c) => c.profiles?.includes('frames-4'));
  if (h3f4) {
    h3f4.start = 'roundel_in';
    h3f4.end = 'act4_in';
  }

  const sizeKey = Object.entries(doc.sizes).find(([, sc]) => sc === sizeCreative)?.[0];
  const h4f3 = h4?.clips?.find((c) => c.profiles?.includes('frames-3'));
  const h4f4 = h4?.clips?.find((c) => c.profiles?.includes('frames-4'));
  if (h4f3) h4f3.start = H4_START_FRAMES_3[sizeKey] || 'act4_in';
  if (h4f4) {
    h4f4.start = 'act4_in';
    h4f4.end = 'act3_exit-1';
  }
}

fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log('Fixed headline act timing');
console.log('frames-3 act4_in/tc_exit:', f3.act4_in);
console.log('frames-4 act4_in/tc_exit:', f4.act4_in);
