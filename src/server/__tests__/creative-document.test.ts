import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  readCreativeDocument,
  validateCreativeDocument,
} from '../creative-document';

test('rejects unregistered campaign ids', () => {
  assert.throws(
    () => validateCreativeDocument({
      version: 1,
      campaign: { id: 'not-a-campaign', name: 'Nope' },
      clock: { durationS: 15, beats: {} },
      feed: { profileName: 'x', sampleRows: [] },
      sizes: {
        '300x250': {
          canvas: { width: 300, height: 250 },
          layers: [{ id: 'a', kind: 'text', base: {}, clips: [] }],
        },
      },
    }),
    /registered campaign/,
  );
});

test('preserves authored offer-count roundel overrides during validation', async () => {
  const document = validateCreativeDocument({
    version: 1,
    campaign: { id: 'sse-dco', name: 'SSE DCO' },
    clock: { durationS: 15, beats: { start: 0, end: 100 } },
    feed: { profileName: 'SSE_DCO_Offers', sampleRows: [{}] },
    sizes: {
      '728x90': {
        canvas: { width: 728, height: 90 },
        layers: [
          {
            id: 'roundel-frame',
            kind: 'shape',
            base: { left: 300, top: -16, width: 130, height: 130, cssClass: 'roundel-frame' },
            clips: [],
          },
          {
            id: 'bg-image',
            kind: 'image',
            base: { left: 0, top: 0, width: 728, height: 90, cssClass: 'bg-image' },
            clips: [],
          },
        ],
        variantRules: [
          {
            id: 'roundel-split|roundel-copy',
            scope: 'roundel-split',
            layerId: 'roundel-copy',
            cssClass: 'roundel-copy',
            props: { left: 310, top: 9 },
            editable: true,
          },
          {
            id: 'offers-2|roundel-frame',
            scope: 'offers-2',
            layerId: 'roundel-frame',
            cssClass: 'roundel-frame',
            when: { offer_count_num: 2 },
            props: { left: 312, top: -4, width: 101, height: 100 },
            editable: true,
          },
          {
            id: 'offers-3|roundel-copy',
            scope: 'offers-3',
            layerId: 'roundel-copy',
            cssClass: 'roundel-copy',
            when: { offer_count_num: 3 },
            props: { left: 326, top: 24 },
            editable: true,
          },
          {
            id: 'offers-2|offer-slot-1',
            scope: 'offers-2',
            layerId: 'offer-slot-1',
            when: { offer_count_num: 2 },
            props: { left: 10 },
            editable: true,
          },
          {
            id: 'offers-0|roundel-frame',
            scope: 'offers-0',
            layerId: 'roundel-frame',
            cssClass: 'roundel-frame',
            when: { offer_count_num: 0 },
            props: { backgroundColor: 'rgb(0, 229, 165)' },
            editable: true,
          },
        ],
      },
    },
  });

  const ids = document.sizes['728x90'].variantRules.map((rule) => rule.id);
  assert.deepEqual(ids, [
    'roundel-split|roundel-copy',
    'offers-2|roundel-frame',
    'offers-3|roundel-copy',
    'offers-2|offer-slot-1',
    'offers-0|roundel-frame',
  ]);
});
