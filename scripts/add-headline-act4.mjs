#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../campaign/sse-dco-creative.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

doc.clock.profiles['frames-4'].act2_out = 45;
doc.clock.profiles['frames-4'].act3_in = 45;
doc.clock.profiles['frames-4'].act3_out = 55;

const heading4Field = {
  name: 'heading4_text',
  label: 'Headline act 4',
  type: 'string',
  group: 'Copy',
  description: 'Act 4 headline copy (roundel / four-act profile only).',
};

if (!doc.feed.fields.some((field) => field.name === 'heading4_text')) {
  const heading3Index = doc.feed.fields.findIndex((field) => field.name === 'heading3_text');
  doc.feed.fields.splice(heading3Index + 1, 0, heading4Field);
}

for (const row of doc.feed.sampleRows || []) {
  if (!Object.prototype.hasOwnProperty.call(row, 'heading4_text')) {
    row.heading4_text = 'Switch and save today';
  }
}

const tagHeadlineClips = (sizeCreative) => {
  const act2 = sizeCreative.layers.find((layer) => layer.id === 'headline-act2');
  const act3 = sizeCreative.layers.find((layer) => layer.id === 'headline-act3');
  if (act2?.clips?.[0]) {
    const base = act2.clips[0];
    act2.clips = [
      {
        ...base,
        id: `${base.id}-frames-3`,
        profiles: ['frames-3'],
      },
      {
        id: `${base.id}-frames-4`,
        label: base.label,
        preset: base.preset,
        start: 'act2_in',
        end: 'act2_out',
        params: base.params || {},
        profiles: ['frames-4'],
      },
    ];
  }
  if (act3?.clips?.[0]) {
    const base = act3.clips[0];
    act3.clips = [
      {
        ...base,
        id: `${base.id}-frames-3`,
        profiles: ['frames-3'],
      },
      {
        id: `${base.id}-frames-4`,
        label: base.label,
        preset: base.preset,
        start: 'act3_in',
        end: 'act3_out',
        params: base.params || {},
        profiles: ['frames-4'],
      },
    ];
  }

  if (!sizeCreative.layers.some((layer) => layer.id === 'headline-act4')) {
    const act3Layer = sizeCreative.layers.find((layer) => layer.id === 'headline-act3');
    sizeCreative.layers.push({
      id: 'headline-act4',
      label: 'Headline Act4',
      group: 'Headlines',
      kind: 'text',
      zIndex: 2,
      base: { cssClass: 'sse-headline' },
      binding: { field: 'heading4_text' },
      clips: [
        {
          id: 'headline-act4-slideInRight',
          label: 'Headline Act4 slideInRight',
          preset: 'slideInRight',
          start: 'act3_out',
          end: 'act3_exit-1',
          params: act3Layer?.clips?.find((clip) => clip.profiles?.includes('frames-3'))?.params
            || act3Layer?.clips?.[0]?.params
            || { exit_dy: 10 },
          profiles: ['frames-4'],
        },
      ],
      fit: act3Layer?.fit ? { ...act3Layer.fit } : { maxLines: 4 },
    });
  }

  if (typeof sizeCreative.manualCss === 'string' && !sizeCreative.manualCss.includes('#headline-act4')) {
    sizeCreative.manualCss += '\n    .frames-3 #headline-act4 { visibility: hidden; }\n';
  }
};

for (const sizeCreative of Object.values(doc.sizes)) tagHeadlineClips(sizeCreative);

fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
