// @ts-nocheck
'use client';

import { headlineOfferLayoutStatus } from '@/lib/creative-model';
import { useEditorStore } from '@/store/editor-store';

function HeadlineOfferLayoutSection({ document, size, offerCount }) {
  const copyHeadlineOfferLayout = useEditorStore((s) => s.copyHeadlineOfferLayout);
  const resetHeadlineOfferLayout = useEditorStore((s) => s.resetHeadlineOfferLayout);
  const statuses = headlineOfferLayoutStatus(document, size);
  const current = statuses.find((item) => item.offerCount === offerCount) || statuses[0];
  const copySources = [1, 2, 3].filter((count) => count !== offerCount);

  return (
    <div className="headline-offer-layout">
      <p className="inspector-note">
        Headline placement is shared across acts 1–4. Each offer count can use the 1-offer baseline or its own override.
      </p>
      <div className="headline-offer-status-row" aria-label="Headline layout status by offer count">
        {statuses.map((item) => (
          <span
            key={item.offerCount}
            className={`headline-offer-status tone-${item.tone}${item.offerCount === offerCount ? ' is-active' : ''}`}
            title={item.detail}
          >
            {item.label}
          </span>
        ))}
      </div>
      <p className="inspector-note">
        Editing <strong>{current?.label || `${offerCount}-offer`}</strong>
        {current?.tone === 'baseline' && offerCount === 1
          ? ' — changes here become the shared baseline.'
          : current?.tone === 'baseline'
            ? ' — currently follows the 1-offer baseline.'
            : ' — changes here only affect this offer count.'}
      </p>
      {offerCount === 1 ? (
        <div className="headline-offer-actions">
          <span className="headline-offer-actions-label">Apply this layout to</span>
          <div className="headline-offer-action-row">
            <button type="button" onClick={() => copyHeadlineOfferLayout(1, 2)}>2-offer</button>
            <button type="button" onClick={() => copyHeadlineOfferLayout(1, 3)}>3-offer</button>
          </div>
        </div>
      ) : (
        <div className="headline-offer-actions">
          <span className="headline-offer-actions-label">Copy layout from</span>
          <div className="headline-offer-action-row">
            {copySources.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => copyHeadlineOfferLayout(count, offerCount)}
              >
                {count}-offer
              </button>
            ))}
          </div>
          <button
            type="button"
            className="headline-offer-reset"
            onClick={() => resetHeadlineOfferLayout(offerCount)}
          >
            Use 1-offer baseline
          </button>
        </div>
      )}
    </div>
  );
}

export default HeadlineOfferLayoutSection;
