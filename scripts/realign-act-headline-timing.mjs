#!/usr/bin/env node
/**
 * Act / headline timing realignment:
 * - act4_in + tc_exit beats
 * - H3 roundel-only; H4 always on endframe/CTA
 * - roundel-frame-off hides headline-act3
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../campaign/sse-dco-creative.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

// Phase 1: beats
doc.clock.beats.act4_in = doc.clock.beats.cta_in;
doc.clock.beats.tc_exit = doc.clock.beats.cta_in;
doc.clock.profiles['frames-3'].act4_in = Number(
  (doc.clock.profiles['frames-3'].swap + 0.1).toFixed(1),
);
doc.clock.profiles['frames-3'].tc_exit = doc.clock.profiles['frames-3'].cta_in;
doc.clock.profiles['frames-4'].act4_in = doc.clock.profiles['frames-4'].cta_in;
doc.clock.profiles['frames-4'].tc_exit = doc.clock.profiles['frames-4'].cta_in;

const BANNER_ENDFRAME_START = {
  '320x50': 'bn_cta_in',
};

for (const [sizeKey, sizeCreative] of Object.entries(doc.sizes)) {
  const h2 = sizeCreative.layers.find((l) => l.id === 'headline-act2');
  const h3 = sizeCreative.layers.find((l) => l.id === 'headline-act3');
  const h4 = sizeCreative.layers.find((l) => l.id === 'headline-act4');

  if (h2) {
    const h2f3 = h2.clips?.find((c) => c.profiles?.includes('frames-3'));
    const h2f4 = h2.clips?.find((c) => c.profiles?.includes('frames-4'));
    if (h2f3) h2f3.end = 'offers_exit';
    if (h2f4) h2f4.end = 'offers_exit';
  }

  const h3f4Clip = h3?.clips?.find((c) => c.profiles?.includes('frames-4')) || null;

  if (h3) {
    h3.clips = (h3.clips || []).filter((c) => !c.profiles?.includes('frames-3'));
    if (h3f4Clip) {
      h3f4Clip.start = 'roundel_in';
      h3f4Clip.end = 'act4_in';
    }
  }

  if (h4) {
    const endframeStart = BANNER_ENDFRAME_START[sizeKey] || 'act4_in';
    const endframeEnd = 'act3_exit-1';
    const template = h4.clips?.find((c) => c.profiles?.includes('frames-4'))
      || h3?.clips?.find((c) => c.profiles?.includes('frames-4'))
      || { preset: 'slideInRight', params: { exit_dy: 10 } };

    let h4f3 = h4.clips?.find((c) => c.profiles?.includes('frames-3'));
    if (!h4f3) {
      h4f3 = {
        id: 'headline-act4-slideInRight-frames-3',
        label: 'Headline Act4 slideInRight',
        preset: template.preset || 'slideInRight',
        start: endframeStart,
        end: endframeEnd,
        params: { ...(template.params || {}), exit_dy: template.params?.exit_dy ?? 10 },
        profiles: ['frames-3'],
      };
      h4.clips = h4.clips || [];
      h4.clips.unshift(h4f3);
    } else {
      h4f3.start = endframeStart;
      h4f3.end = endframeEnd;
    }

    const h4f4 = h4.clips?.find((c) => c.profiles?.includes('frames-4'));
    if (h4f4) {
      h4f4.start = 'act4_in';
      h4f4.end = endframeEnd;
    }
  }

  if (typeof sizeCreative.manualCss === 'string') {
    sizeCreative.manualCss = sizeCreative.manualCss.replace(
      /\n\s*\.frames-3\s+#headline-act4\s*\{\s*visibility:\s*hidden;\s*\}/g,
      '',
    );
  }

  sizeCreative.variantRules = sizeCreative.variantRules || [];
  const hideCss = '    .roundel-frame-off #headline-act3 { visibility: hidden; }';
  if (typeof sizeCreative.manualCss === 'string' && !sizeCreative.manualCss.includes('.roundel-frame-off #headline-act3')) {
    sizeCreative.manualCss += `\n${hideCss}\n`;
  }
}

fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log('Updated act/headline timing in', docPath);
