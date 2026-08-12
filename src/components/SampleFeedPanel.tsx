// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';

import { fieldInputValue, rowLabel } from '@/lib/feed-model';
import {
  SIZE_OVERRIDABLE_TEXT_FIELDS,
  sizeOverrideFieldNamesForSize,
} from '@/lib/feed-size-text';
import { selectSelectedFeedRow, useEditorStore } from '@/store/editor-store';

type SampleFeedPanelProps = {
  /** Ensure the parent Sample section is expanded (e.g. canvas context-menu edit). */
  ensureOpen?: () => void;
};

const OVERALL_FIELD_NAMES = [
  'offer_count_num',
  'tc_type_enum',
  'cta_type_enum',
  'include_roundel_frame_bool',
] as const;

const HEADLINE_FIELD_NAMES = [
  'heading1_text',
  'heading2_text',
  'heading3_text',
  'heading4_text',
] as const;

const OFFER_PAIRS = [
  { value: 'offer1_value_text', sub: 'offer1_sub_text', label: 'Offer 1' },
  { value: 'offer2_value_text', sub: 'offer2_sub_text', label: 'Offer 2' },
  { value: 'offer3_value_text', sub: 'offer3_sub_text', label: 'Offer 3' },
] as const;

const ROUNDEL_FIELD_NAMES = ['roundel_text_text', 'roundel_value_text'] as const;
const TERMS_FIELD_NAMES = ['tc_terms_text', 'tc_units_text'] as const;
const CTA_FIELD_NAMES = ['cta_text'] as const;

const OVERALL_FIELD_SET = new Set(OVERALL_FIELD_NAMES);

const STRUCTURED_FIELD_NAMES = new Set([
  ...OVERALL_FIELD_NAMES,
  ...HEADLINE_FIELD_NAMES,
  ...OFFER_PAIRS.flatMap((pair) => [pair.value, pair.sub]),
  ...ROUNDEL_FIELD_NAMES,
  ...TERMS_FIELD_NAMES,
  ...CTA_FIELD_NAMES,
]);

/** `{base}_{WxH}` size-override columns — edited in the Size overrides section. */
const isSizeOverrideFieldName = (name: string) => (
  SIZE_OVERRIDABLE_TEXT_FIELDS.some((base) => (
    name.startsWith(`${base}_`) && /\d+x\d+$/.test(name.slice(base.length + 1))
  ))
);

function fieldByName(fields, name) {
  return fields.find((field) => field.name === name) || null;
}

function textareaRowsFor(value) {
  return Math.max(1, String(value ?? '').split('\n').length);
}

export function SampleFeedPanel({ ensureOpen }: SampleFeedPanelProps) {
  const [overallOpen, setOverallOpen] = useState(false);
  const [sizeOverridesOpen, setSizeOverridesOpen] = useState(false);
  const feedFields = useEditorStore((s) => s.feedFields);
  const feedDraft = useEditorStore((s) => s.feedDraft);
  const focusFeedFieldRequest = useEditorStore((s) => s.focusFeedFieldRequest);
  const clearFocusFeedFieldRequest = useEditorStore((s) => s.clearFocusFeedFieldRequest);
  const row = useEditorStore(selectSelectedFeedRow);
  const size = useEditorStore((s) => s.size);
  const setFeedRowIndex = useEditorStore((s) => s.setFeedRowIndex);
  const updateSelectedFeedField = useEditorStore((s) => s.updateSelectedFeedField);
  const setStatus = useEditorStore((s) => s.setStatus);

  const fields = useMemo(() => {
    const map = new Map(feedFields.map((field) => [field.name, field]));
    return {
      map,
      overall: OVERALL_FIELD_NAMES.map((name) => map.get(name)).filter(Boolean),
      headlines: HEADLINE_FIELD_NAMES.map((name) => map.get(name)).filter(Boolean),
      roundel: ROUNDEL_FIELD_NAMES.map((name) => map.get(name)).filter(Boolean),
      terms: TERMS_FIELD_NAMES.map((name) => map.get(name)).filter(Boolean),
      cta: CTA_FIELD_NAMES.map((name) => map.get(name)).filter(Boolean),
    };
  }, [feedFields]);

  useEffect(() => {
    if (!focusFeedFieldRequest?.fieldName) return;
    const fieldName = focusFeedFieldRequest.fieldName;
    ensureOpen?.();
    if (OVERALL_FIELD_SET.has(fieldName)) {
      setOverallOpen(true);
    }
    if (isSizeOverrideFieldName(fieldName)) {
      setSizeOverridesOpen(true);
    }
    const focus = () => {
      const node = globalThis.document?.querySelector(`[data-feed-field="${CSS.escape(fieldName)}"]`);
      if (!(node instanceof HTMLElement)) return false;
      node.focus();
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
        const length = node.value.length;
        node.setSelectionRange?.(length, length);
      }
      return true;
    };
    // Section may mount on the next paint after openSections updates.
    requestAnimationFrame(() => {
      if (!focus()) {
        requestAnimationFrame(() => {
          focus();
          clearFocusFeedFieldRequest();
        });
        return;
      }
      clearFocusFeedFieldRequest();
    });
  }, [focusFeedFieldRequest, clearFocusFeedFieldRequest, ensureOpen]);

  const writeField = (fieldName, value) => {
    try {
      updateSelectedFeedField(fieldName, value);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const renderControl = (field, { compactCheckbox = false, shortLabel = '' } = {}) => {
    if (!field) return null;
    const value = fieldInputValue(row, field);
    const usesTextarea = field.type === 'multiline'
      || (field.type === 'string' && ['Copy', 'Offers'].includes(field.group));

    if (field.type === 'boolean') {
      return (
        <label
          key={field.name}
          className={`sample-field sample-field-bool ${compactCheckbox ? 'sample-field-bool-compact' : ''}`}
        >
          <input
            data-feed-field={field.name}
            type="checkbox"
            checked={Boolean(row[field.name])}
            onChange={(event) => writeField(field.name, event.target.checked)}
          />
          <span>{shortLabel || field.label}</span>
        </label>
      );
    }

    if (field.type === 'enum') {
      return (
        <label key={field.name} className="sample-field">
          <span>{shortLabel || field.label}</span>
          <select
            data-feed-field={field.name}
            value={String(row[field.name] ?? '')}
            onChange={(event) => writeField(field.name, event.target.value)}
          >
            {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      );
    }

    if (usesTextarea) {
      return (
        <label key={field.name} className="sample-field sample-field-multiline">
          <span>{shortLabel || field.label}</span>
          <textarea
            data-feed-field={field.name}
            rows={textareaRowsFor(value)}
            value={value}
            onChange={(event) => writeField(field.name, event.target.value)}
          />
        </label>
      );
    }

    return (
      <label key={field.name} className="sample-field">
        <span>{shortLabel || field.label}</span>
        <input
          data-feed-field={field.name}
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => writeField(field.name, event.target.value)}
        />
      </label>
    );
  };

  const offerCountField = fieldByName(feedFields, 'offer_count_num');
  const tcModeField = fieldByName(feedFields, 'tc_type_enum');
  const ctaShapeField = fieldByName(feedFields, 'cta_type_enum');
  const roundelFrameField = fieldByName(feedFields, 'include_roundel_frame_bool');

  return (
    <div className="sample-feed-panel">
      <label className="inspector-field full sample-row-field">
        <span>Sample row</span>
        <select
          value={feedDraft.selectedIndex}
          onChange={(event) => setFeedRowIndex(Number(event.target.value) || 0)}
        >
          {feedDraft.rows.map((feedRow, index) => (
            <option key={index} value={index}>{rowLabel(feedRow, index)}</option>
          ))}
        </select>
      </label>

      <section className={`sample-overall ${overallOpen ? 'is-open' : 'is-collapsed'}`}>
        <button
          type="button"
          className="sample-overall-toggle"
          onClick={() => setOverallOpen((open) => !open)}
          aria-expanded={overallOpen}
        >
          <span>Overall settings</span>
          <span aria-hidden="true">{overallOpen ? '−' : '+'}</span>
        </button>
        {overallOpen ? (
          <div className="sample-overall-body">
            {renderControl(offerCountField)}
            {renderControl(tcModeField)}
            {renderControl(ctaShapeField)}
            <div className="sample-divider sample-divider-soft" role="separator" />
            {renderControl(roundelFrameField, { compactCheckbox: true, shortLabel: 'Roundel frame' })}
          </div>
        ) : null}
      </section>

      <div className="sample-divider" role="separator" />

      <section className="sample-block" aria-label="Headlines">
        <span className="sample-block-label">Headlines</span>
        {fields.headlines.map((field, index) => {
          const value = fieldInputValue(row, field);
          const usesTextarea = field.type === 'multiline'
            || (field.type === 'string' && field.group === 'Copy');
          return (
            <div key={field.name} className="sample-indexed-row">
              <span className="sample-index" aria-hidden="true">{index + 1}</span>
              <label className="sample-field sample-field-bare">
                <span className="sr-only">{field.label}</span>
                {usesTextarea ? (
                  <textarea
                    data-feed-field={field.name}
                    rows={textareaRowsFor(value)}
                    value={value}
                    aria-label={field.label}
                    onChange={(event) => writeField(field.name, event.target.value)}
                  />
                ) : (
                  <input
                    data-feed-field={field.name}
                    value={value}
                    aria-label={field.label}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => writeField(field.name, event.target.value)}
                  />
                )}
              </label>
            </div>
          );
        })}
      </section>

      <div className="sample-divider" role="separator" />

      <section className="sample-block" aria-label="Offers">
        <span className="sample-block-label">Offers</span>
        {OFFER_PAIRS.map((pair, index) => {
          const valueField = fields.map.get(pair.value);
          const subField = fields.map.get(pair.sub);
          if (!valueField && !subField) return null;
          return (
            <div key={pair.label} className="sample-offer-group">
              {index > 0 ? <div className="sample-divider sample-divider-whisper" role="separator" /> : null}
              <div className="sample-indexed-row">
                <span className="sample-index" aria-hidden="true">{index + 1}</span>
                <div className="sample-offer-row">
                  {valueField ? (
                    <label className="sample-field sample-field-bare sample-field-offer-value">
                      <span className="sr-only">{valueField.label}</span>
                      <input
                        data-feed-field={valueField.name}
                        value={fieldInputValue(row, valueField)}
                        aria-label={valueField.label}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => writeField(valueField.name, event.target.value)}
                      />
                    </label>
                  ) : null}
                  {subField ? (
                    <label className="sample-field sample-field-bare sample-field-offer-sub">
                      <span className="sr-only">{subField.label}</span>
                      <input
                        data-feed-field={subField.name}
                        value={fieldInputValue(row, subField)}
                        aria-label={subField.label}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => writeField(subField.name, event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <div className="sample-divider" role="separator" />

      <section className="sample-block" aria-label="Roundel">
        <span className="sample-block-label">Roundel</span>
        <div className="sample-offer-row sample-roundel-row">
          {fields.roundel.map((field) => (
            <label
              key={field.name}
              className={`sample-field sample-field-bare ${field.name === 'roundel_value_text' ? 'sample-field-offer-value' : 'sample-field-offer-sub'}`}
            >
              <span className="sr-only">{field.label}</span>
              <input
                data-feed-field={field.name}
                value={fieldInputValue(row, field)}
                aria-label={field.label}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => writeField(field.name, event.target.value)}
              />
            </label>
          ))}
        </div>
      </section>

      <div className="sample-divider" role="separator" />

      <section className="sample-block" aria-label="Terms">
        {fields.terms.map((field) => renderControl(field))}
      </section>

      <div className="sample-divider" role="separator" />

      <section className="sample-block" aria-label="CTA">
        {fields.cta.map((field) => renderControl(field))}
      </section>

      <div className="sample-divider" role="separator" />

      <section className={`sample-overall ${sizeOverridesOpen ? 'is-open' : 'is-collapsed'}`}>
        <button
          type="button"
          className="sample-overall-toggle"
          onClick={() => setSizeOverridesOpen((open) => !open)}
          aria-expanded={sizeOverridesOpen}
        >
          <span>Size overrides ({size || '—'})</span>
          <span aria-hidden="true">{sizeOverridesOpen ? '−' : '+'}</span>
        </button>
        {sizeOverridesOpen ? (
          <div className="sample-overall-body">
            <p style={{ margin: '0 0 8px', opacity: 0.7, fontSize: 12, lineHeight: 1.35 }}>
              Blank = use the base headline / unit-rate field. Only the active size is shown.
            </p>
            {sizeOverrideFieldNamesForSize(size || '').map((fieldName) => {
              const field = fields.map.get(fieldName) || {
                name: fieldName,
                label: fieldName,
                type: 'multiline',
              };
              return (
                <div key={fieldName}>
                  {renderControl(field)}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Keep unknown/extra Creative State·Offers·Copy fields reachable if schema grows. */}
      {feedFields
        .filter((field) => ['Creative State', 'Offers', 'Copy'].includes(field.group)
          && !STRUCTURED_FIELD_NAMES.has(field.name)
          && !isSizeOverrideFieldName(field.name))
        .map((field) => renderControl(field))}
    </div>
  );
}
