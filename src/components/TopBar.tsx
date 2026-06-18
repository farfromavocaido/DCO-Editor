// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { EditorIcon } from '@/components/EditorIcon';
import { ToolbarTip } from '@/components/ToolbarTip';
import { useEditorStore } from '@/store/editor-store';

function SegmentedControl({
  label,
  value,
  options,
  onChange,
  tip,
}: {
  label: string;
  value: string | number;
  options: { value: string; label: string; tip?: string }[];
  onChange: (value: string) => void;
  tip?: string;
}) {
  return (
    <ToolbarTip tip={tip || label} className="field field-compact">
      <div className="field-inline">
        <span className="field-label">{label}</span>
        <div className="segmented segmented-compact" role="group" aria-label={label}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              data-value={option.value}
              aria-pressed={String(option.value) === String(value)}
              aria-label={option.tip || option.label}
              data-tip={option.tip || option.label}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </ToolbarTip>
  );
}

export function TopBar() {
  const sizes = useEditorStore((s) => s.sizes);
  const size = useEditorStore((s) => s.size);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const history = useEditorStore((s) => s.history);
  const creativeDirty = useEditorStore((s) => s.creativeDirty);
  const saveFeedDisabled = useEditorStore((s) => s.saveFeedDisabled);
  const loadSize = useEditorStore((s) => s.loadSize);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveCreativeDocument = useEditorStore((s) => s.saveCreativeDocument);
  const saveFeedRows = useEditorStore((s) => s.saveFeedRows);
  const buildHtml = useEditorStore((s) => s.buildHtml);
  const exportClientPackage = useEditorStore((s) => s.exportClientPackage);
  const exportBasePackage = useEditorStore((s) => s.exportBasePackage);
  const viewHtml = useEditorStore((s) => s.viewHtml);
  const openHtmlInspector = useEditorStore((s) => s.openHtmlInspector);
  const setVariantControl = useEditorStore((s) => s.setVariantControl);
  const setStatus = useEditorStore((s) => s.setStatus);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [moreOpen]);

  return (
    <header className="topbar">
      <div className="brand-block">
        <Image
          src="/BGlogo_SVG.svg"
          alt="Boys and Girls"
          className="brand-logo"
          width={493}
          height={170}
          priority
        />
      </div>

      <div className="control-strip" aria-label="Ad controls">
        <ToolbarTip tip="Banner dimensions" className="field field-compact">
          <label className="field-inline">
            <span className="field-label">Size</span>
            <select
              value={size}
              aria-label="Ad size"
              onChange={(event) => {
                loadSize(event.target.value).catch((error) => setStatus(error.message, 'error'));
              }}
            >
              {sizes.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </ToolbarTip>

        <SegmentedControl
          label="Offers"
          tip="Number of offers shown in the ad"
          value={offerCount}
          options={[
            { value: '1', label: '1', tip: 'Single offer' },
            { value: '2', label: '2', tip: 'Dual offers' },
            { value: '3', label: '3', tip: 'Triple offers' },
          ]}
          onChange={(value) => setVariantControl('offer_count_num', value)}
        />
        <SegmentedControl
          label="T&Cs"
          tip="Terms and conditions layout"
          value={tcMode}
          options={[
            { value: 'tcs_only', label: 'Solo', tip: 'T&Cs only' },
            { value: 'tcs_units', label: 'Prices', tip: 'T&Cs with unit rates' },
          ]}
          onChange={(value) => setVariantControl('tc_type_enum', value)}
        />
        <SegmentedControl
          label="CTA"
          tip="Call-to-action button shape"
          value={ctaShape}
          options={[
            { value: 'roundel', label: 'Round', tip: 'Round CTA button' },
            { value: 'rectangle', label: 'Rect', tip: 'Rectangular CTA button' },
          ]}
          onChange={(value) => setVariantControl('cta_type_enum', value)}
        />
      </div>

      <div className="actions">
        <ToolbarTip tip="Undo (⌘Z)">
          <button type="button" className="icon-button icon-button-compact" aria-label="Undo" disabled={historyIndex < 0} onClick={undo}>
            <EditorIcon name="undo" />
          </button>
        </ToolbarTip>
        <ToolbarTip tip="Redo (⇧⌘Z)">
          <button type="button" className="icon-button icon-button-compact" aria-label="Redo" disabled={historyIndex >= history.length - 1} onClick={redo}>
            <EditorIcon name="redo" />
          </button>
        </ToolbarTip>

        <ToolbarTip tip="Open baked preview in a new tab">
          <button type="button" className="icon-button icon-button-compact" aria-label="Preview" onClick={viewHtml}>
            <EditorIcon name="preview" />
          </button>
        </ToolbarTip>

        <div className="menu-anchor" ref={moreRef}>
          <ToolbarTip tip="Export and sample data actions">
            <button
              type="button"
              className="icon-button icon-button-compact"
              aria-label="More actions"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <EditorIcon name="more" />
            </button>
          </ToolbarTip>
          {moreOpen ? (
            <div className="toolbar-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  openHtmlInspector().catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Inspect HTML
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  buildHtml().catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export HTML
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  exportBasePackage().catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export base ZIP for agency
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  exportClientPackage({ includeValidator: true }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export client ZIP with validation
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  exportClientPackage({ includeValidator: false }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export client ZIP without validation
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={saveFeedDisabled}
                onClick={() => {
                  saveFeedRows().catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Save sample values
              </button>
            </div>
          ) : null}
        </div>

        <ToolbarTip tip="Save layout and animation changes to the creative document">
          <button
            type="button"
            className="icon-button icon-button-compact icon-button-primary"
            aria-label="Save creative"
            disabled={!creativeDirty}
            onClick={() => saveCreativeDocument().catch((error) => setStatus(error.message, 'error'))}
          >
            <EditorIcon name="save" />
          </button>
        </ToolbarTip>
      </div>
    </header>
  );
}
