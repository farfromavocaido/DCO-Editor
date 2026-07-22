import { test } from 'vitest';
import assert from 'node:assert/strict';

import { feedFieldForEditableTarget } from './preview-utils';

test('feedFieldForEditableTarget resolves bindings, headlines, and offer children', () => {
  assert.equal(
    feedFieldForEditableTarget({ id: 'headline-act1', binding: { field: 'heading1_text' } }),
    'heading1_text',
  );
  assert.equal(feedFieldForEditableTarget({ id: 'headline-act2' }), 'heading2_text');
  assert.equal(feedFieldForEditableTarget({ id: 'cta' }), 'cta_text');
  assert.equal(feedFieldForEditableTarget({ id: 'terms-solo' }), 'tc_terms_text');
  assert.equal(
    feedFieldForEditableTarget({ id: 'offer-slot-2' }, 'offer-slot-2::offer-subline'),
    'offer2_sub_text',
  );
  assert.equal(
    feedFieldForEditableTarget({ id: 'offer-slot-1' }, 'offer-slot-1::offer-value'),
    'offer1_value_text',
  );
  assert.equal(feedFieldForEditableTarget({ id: 'greenwave' }), '');
});
