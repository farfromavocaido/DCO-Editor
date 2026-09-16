// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

import { EditorIcon } from '@/components/EditorIcon';
import { ToolbarTip } from '@/components/ToolbarTip';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';
import { campaignHeaderDimensions, campaignScopes, campaignVariantModel } from '@/lib/campaign-variants';
import { CampaignHeaderSettings } from './CampaignHeaderSettings';

function SegmentedControl({
  label,
  value,
  options,
  onChange,
  tip,
  disabled = false,
}: {
  label: string;
  value: string | number;
  options: { value: string; label: string; tip?: string }[];
  onChange: (value: string) => void;
  tip?: string;
  disabled?: boolean;
}) {
  return (
    <ToolbarTip tip={tip || label} className="field field-compact">
      <div className={`field-inline${disabled ? ' is-disabled' : ''}`}>
        <span className="field-label">{label}</span>
        <div className="segmented segmented-compact" role="group" aria-label={label} aria-disabled={disabled || undefined}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              data-value={option.value}
              aria-pressed={String(option.value) === String(value)}
              aria-label={option.tip || option.label}
              data-tip={option.tip || option.label}
              disabled={disabled}
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
  const document = useEditorStore((s) => s.creativeDocument);
  const previewRow = useEditorStore(selectPreviewFeedRow);
  const dimensions = campaignHeaderDimensions(document, previewRow);
  const scopes = campaignScopes(document, previewRow);
  const sizes = useEditorStore((s) => s.sizes);
  const size = useEditorStore((s) => s.size);
  const campaigns = useEditorStore((s) => s.campaigns);
  const activeCampaignId = useEditorStore((s) => s.activeCampaignId);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const includeRoundelFrame = useEditorStore((s) => s.includeRoundelFrame);
  const navyHeadlines = useEditorStore((s) => s.navyHeadlines);
  const historyIndex = useEditorStore((s) => s.historyIndex);
  const history = useEditorStore((s) => s.history);
  const creativeDirty = useEditorStore((s) => s.creativeDirty);
  const saveFeedDisabled = useEditorStore((s) => s.saveFeedDisabled);
  const loadSize = useEditorStore((s) => s.loadSize);
  const switchCampaign = useEditorStore((s) => s.switchCampaign);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const saveCreativeDocument = useEditorStore((s) => s.saveCreativeDocument);
  const saveFeedRows = useEditorStore((s) => s.saveFeedRows);
  const buildHtml = useEditorStore((s) => s.buildHtml);
  const exportForPreview = useEditorStore((s) => s.exportForPreview);
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
        <ToolbarTip tip="Active campaign document" className="field field-compact">
          <label className="field-inline">
            <span className="field-label">Campaign</span>
            <select
              value={activeCampaignId}
              aria-label="Campaign"
              onChange={(event) => {
                switchCampaign(event.target.value).catch((error) => setStatus(error.message, 'error'));
              }}
            >
              {(campaigns.length
                ? campaigns
                : [{ id: 'sse-dco', name: 'SSE DCO' }]
              ).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        </ToolbarTip>

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

        {dimensions.map(dimension => <SegmentedControl key={dimension.id}
          label={dimension.label}
          value={String(dimension.options.find(option => scopes.includes(option.scope))?.value ?? dimension.defaultValue)}
          options={dimension.options.map(option => ({...option, value:String(option.value)}))}
          onChange={value => {try {setVariantControl(dimension.field,value);} catch(error) {setStatus(error.message,'error');}}}
        />)}
        {document ? <CampaignHeaderSettings document={document} dimensions={campaignVariantModel(document).dimensions} /> : null}
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
                className="toolbar-menu-primary"
                onClick={() => {
                  exportBasePackage({ assetMode: 'embed' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export Canonical Zip
              </button>
              <button
                type="button"
                role="menuitem"
                className="toolbar-menu-primary"
                onClick={() => {
                  exportBasePackage({ assetMode: 'canonical-agency' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export Canonical Agency Zip
              </button>
              <div className="toolbar-menu-separator" role="separator" />
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
                  buildHtml({ renderMode: 'font' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export HTML (dynamic text)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  buildHtml({ renderMode: 'outline' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export HTML (fixed text as outlines)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  buildHtml({ renderMode: 'outline', delivery: 'static' })
                    .catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export for Static
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  exportForPreview().catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Sync Zips
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
                  exportBasePackage({ assetMode: 'cdn' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export agency ZIP with CDN assets
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
                onClick={() => {
                  exportClientPackage({ renderMode: 'outline' }).catch((error) => setStatus(error.message, 'error'));
                  setMoreOpen(false);
                }}
              >
                Export client ZIP (fixed text as outlines)
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

        <ToolbarTip tip="Live agency QA — settled holds in canonical-agency HTML">
          <a
            className="icon-button icon-button-compact"
            href={`/qa?campaign=${encodeURIComponent(activeCampaignId)}`}
            aria-label="Open agency QA"
          >
            QA
          </a>
        </ToolbarTip>
      </div>
    </header>
  );
}
