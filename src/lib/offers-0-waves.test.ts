import assert from 'node:assert/strict';
import {test} from 'vitest';
import {selectorForVariantRule} from './creative-css';
const NAVY='rgb(0, 41, 117)';

test('white/navy/offers-0 headline scopes exclude Act 4 by default', () => {
  assert.equal(
    selectorForVariantRule({ scope: 'white-headlines', cssClass: 'sse-headline' }),
    '.white-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'navy-headlines', cssClass: 'sse-headline' }),
    '.navy-headlines .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', cssClass: 'sse-headline' }),
    '.offers-0 .sse-headline:not(#headline-act4)',
  );
  assert.equal(
    selectorForVariantRule({ scope: 'offers-0', layerId: 'headline-act4', props: { color: NAVY } }),
    '.offers-0 #headline-act4',
  );
});
