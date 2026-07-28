import assert from 'node:assert/strict';
import { test } from 'vitest';

import { renderStaticsPreviewPage } from './render-statics-preview-page';

test('renders a campaign/size shell with download link', () => {
  const html = renderStaticsPreviewPage({
    generatedAt: '2026-07-28T08:00:00.000Z',
    zip: 'downloads/SSE_Statics_20260728-080000.zip',
    campaigns: [
      {
        id: 'sse-hiker-welcome',
        name: 'Hiker Welcome Credit',
        exportSlug: 'SSE_Hiker_Welcome',
        sizes: ['300x250', '728x90'],
      },
    ],
  });

  assert.match(html, /Statics Preview/);
  assert.match(html, /Hiker Welcome Credit/);
  assert.match(html, /id="campaign"/);
  assert.match(html, /id="size"/);
  assert.match(html, /downloads\/SSE_Statics_20260728-080000\.zip/);
  assert.match(html, /campaigns\/' \+ campaign\.id \+ '\/' \+ campaign\.exportSlug/);
  assert.match(html, /href="\.\.\/"/);
});
