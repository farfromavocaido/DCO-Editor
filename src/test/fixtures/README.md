# Fixed compatibility inputs

These JSON documents are frozen test inputs, captured during the test-boundary cleanup. They exercise the SSE legacy adapter, arbitrary campaign dimensions, multiple formats, ownership, fonts, feed fields and export routes.

They are intentionally separate from the editable files under `campaign/`. Editing a client ad must not change engine-test input. Do not automatically refresh these fixtures from the working campaign. New behaviour should normally use a small purpose-built fixture; change these only when deliberately updating the compatibility scenario, with its corresponding assertions.

No generated ZIPs or approved-art snapshots belong here. See `docs/TESTING.md` for suite boundaries and the remaining binary asset dependency.
