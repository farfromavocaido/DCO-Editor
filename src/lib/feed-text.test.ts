import assert from 'node:assert/strict';
import { test } from 'vitest';

import { normalizeFeedLineBreaks } from '@/lib/feed-text';

test('normalizeFeedLineBreaks converts Studio br tags to newlines', () => {
  assert.equal(
    normalizeFeedLineBreaks('A different kind <br> of energy'),
    'A different kind \n of energy',
  );
  assert.equal(normalizeFeedLineBreaks('line<br/>two<br />three'), 'line\ntwo\nthree');
  assert.equal(normalizeFeedLineBreaks('already\nbroken'), 'already\nbroken');
  assert.equal(normalizeFeedLineBreaks(''), '');
});
