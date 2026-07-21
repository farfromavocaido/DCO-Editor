// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';

import { animationFamilyForLayer, animationIntentDefinitions, timelineSpanForClip } from '@/lib/animation-intents';
import { compileAnimationClips } from '@/lib/creative-compiler';
import { currentSizeCreative, isHeadlineLayer } from '@/lib/creative-model';
import { activeScopesFromControls, fieldInputValue, rowLabel } from '@/lib/feed-model';
import { beatsForScopes } from '@/lib/timing-profiles';
import { deriveSelectedTarget, OFFERS_BLOCK_ID } from '@/lib/selection-groups';
import { fitSizeStatus } from '@/lib/selection-chrome';
import { useEditorStore } from '@/store/editor-store';
import { EditorIcon } from '@/components/EditorIcon';
import HeadlineOfferLayoutSection from '@/components/HeadlineOfferLayoutSection';

const boxFields = ['left', 'top', 'width', 'height'];
const typeFields = ['fontSize', 'lineHeight', 'letterSpacing'];
const reusableStyleFields = [
  ...boxFields,
  ...typeFields,
  'display',
  'textAlign',
  'justifyContent',
  'alignItems',
];
const presetLabels = {
  fade: 'Fade clip',
  slideInRight: 'Slide right',
  fadeUp: 'Fade up',
  popPulse: 'Pop pulse',
};

const keyframeTone = (keyframe) => {
  if (keyframe.scale !== undefined) return 'scale';
  if (keyframe.translate) return 'transform';
  if (keyframe.opacity !== undefined) return 'opacity';
  return 'hold';
};

const keyframeText = (keyframe) => {
  const parts = [`${keyframe.at}%`];
  if (keyframe.translate) parts.push(`move ${keyframe.translate[0]}, ${keyframe.translate[1]}`);
  if (keyframe.scale !== undefined) parts.push(`scale ${keyframe.scale}`);
  if (keyframe.opacity !== undefined) parts.push(`fade ${keyframe.opacity}`);
  return parts.join(' · ');
};

function FieldControl({ label, value, onChange, type = 'number' }) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectControl({ label, value, onChange, children }) {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function ButtonGroupControl({ label, value, options, onChange }) {
  return (
    <div className="inspector-field inspector-button-group">
      <span>{label}</span>
      <div className="segmented-control" style={{ '--segments': options.length }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            aria-label={option.tip || option.label}
            data-tip={option.tip}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? (
              <>
                <EditorIcon name={option.icon} size={15} />
                <span className="sr-only">{option.label}</span>
              </>
            ) : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InspectorSection({ id, title, open, onToggle, children }) {
  return (
    <section className={`inspector-section ${open ? '' : 'is-collapsed'}`} data-section={id}>
      <button type="button" className="inspector-section-head" onClick={onToggle} aria-expanded={open}>
        <h3>{title}</h3>
        <span aria-hidden="true">{open ? '-' : '+'}</span>
      </button>
      {open ? <div className="inspector-section-body">{children}</div> : null}
    </section>
  );
}

export function CreativeInspector() {
  const [openSections, setOpenSections] = useState(() => new Set(['layout', 'headline-offers', 'type', 'style', 'animation']));
  const [layerCode, setLayerCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const document = useEditorStore((s) => s.creativeDocument);
  const size = useEditorStore((s) => s.size);
  const percent = useEditorStore((s) => s.percent);
  const feedFields = useEditorStore((s) => s.feedFields);
  const feedDraft = useEditorStore((s) => s.feedDraft);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedTargetIds = useEditorStore((s) => s.selectedTargetIds);
  const isolationPath = useEditorStore((s) => s.isolationPath);
  const fitResults = useEditorStore((s) => s.fitResults);
  const resizeMode = useEditorStore((s) => s.resizeMode);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const includeRoundelFrame = useEditorStore((s) => s.includeRoundelFrame);
  const frameCount = useEditorStore((s) => s.frameCount);
  const roundelMode = useEditorStore((s) => s.roundelMode);
  const selectedLayer = useEditorStore((s) => s.selectedLayer());
  const selectedClip = useEditorStore((s) => s.selectedClip());
  const selectedFeedRow = useEditorStore((s) => s.selectedFeedRow);
  const setFeedRowIndex = useEditorStore((s) => s.setFeedRowIndex);
  const updateSelectedFeedField = useEditorStore((s) => s.updateSelectedFeedField);
  const updateTargetValue = useEditorStore((s) => s.updateCreativeTargetValue);
  const updateLayerMetadata = useEditorStore((s) => s.updateCreativeLayerMetadataValue);
  const promoteTargetToSharedStyle = useEditorStore((s) => s.promoteCreativeTargetToSharedStyle);
  const clearTargetOverrides = useEditorStore((s) => s.clearCreativeTargetOverrides);
  const updateLayerFit = useEditorStore((s) => s.updateCreativeLayerFitValue);
  const updateTargetFit = useEditorStore((s) => s.updateCreativeTargetFitValue);
  const setResizeMode = useEditorStore((s) => s.setResizeMode);
  const replaceSelectedLayerFromCode = useEditorStore((s) => s.replaceSelectedLayerFromCode);
  const updateClip = useEditorStore((s) => s.updateCreativeLayerClipValue);
  const addClip = useEditorStore((s) => s.addCreativeClip);
  const addAnimationIntent = useEditorStore((s) => s.addAnimationIntent);
  const copySelectedClipToAnimationFamily = useEditorStore((s) => s.copySelectedClipToAnimationFamily);
  const selectClip = useEditorStore((s) => s.selectClip);
  const setStatus = useEditorStore((s) => s.setStatus);

  const sizeCreative = currentSizeCreative(document, size);
  const activeScopes = useMemo(() => activeScopesFromControls({
    offerCount,
    tcMode,
    ctaShape,
    includeRoundelFrame,
    frameCount,
    roundelMode,
  }), [ctaShape, frameCount, includeRoundelFrame, offerCount, roundelMode, tcMode]);
  const selectedTarget = useMemo(
    () => deriveSelectedTarget(
      document,
      size,
      selectedTargetId,
      selectedLayerId,
      selectedTargetIds,
      offerCount,
      activeScopes,
    ),
    [activeScopes, document, offerCount, selectedLayerId, selectedTargetId, selectedTargetIds, size],
  );
  const row = selectedFeedRow();
  const activeCssClass = selectedTarget?.cssClass || selectedLayer?.base?.cssClass;
  const sharedRule = activeCssClass
    ? (sizeCreative?.classRules || []).find((rule) => rule.cssClass === activeCssClass)
    : null;
  const activeRule = selectedTarget?.writeSource?.kind === 'variantRule'
    ? (sizeCreative?.variantRules || []).find((rule) => rule.id === selectedTarget.writeSource.ruleId)
    : null;
  const layerRules = selectedLayer
    ? (sizeCreative?.variantRules || []).filter((rule) => (
        rule.layerId === selectedLayer.id
        || rule.cssClass === selectedLayer.base?.cssClass
        || rule.cssClass === activeCssClass
      ))
    : [];
  const activeBeats = useMemo(() => beatsForScopes(document, activeScopes), [activeScopes, document]);
  const keyframes = selectedClip
    ? compileAnimationClips([selectedClip], activeBeats)
    : [];
  const family = animationFamilyForLayer(selectedLayer || {});
  const familyMembers = (sizeCreative?.layers || []).filter((layer) => animationFamilyForLayer(layer).id === family.id);
  const selectedClipSpan = selectedClip ? timelineSpanForClip(selectedClip, activeBeats) : null;
  const durationS = document?.clock?.durationS || 15;
  const playheadSeconds = ((percent / 100) * durationS).toFixed(2);
  const playheadLabel = `${playheadSeconds}s / ${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
  const spanSeconds = selectedClipSpan
    ? `${((selectedClipSpan.start / 100) * durationS).toFixed(2)}s - ${((selectedClipSpan.end / 100) * durationS).toFixed(2)}s`
    : '';

  useEffect(() => {
    if (!selectedLayer) {
      setLayerCode('');
      return;
    }
    setLayerCode(JSON.stringify(selectedLayer, null, 2));
    setCodeError('');
  }, [selectedLayer?.id, selectedLayer]);

  const toggleSection = (id) => setOpenSections((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (!selectedLayer || !selectedTarget) {
    return (
      <aside className="creative-inspector">
        <div className="workspace-panel-head">
          <div>
            <span className="panel-kicker">Inspector</span>
            <h2>No layer</h2>
          </div>
        </div>
      </aside>
    );
  }

  const isGroupedSelection = selectedTarget.kind === 'group' || selectedTarget.kind === 'multi';
  const isHeadlineSelection = isHeadlineLayer(selectedLayer) && !isGroupedSelection;
  const layoutNote = isolationPath?.length === 1 && isolationPath[0] === OFFERS_BLOCK_ID
    ? 'Editing inside the offer block. Select a slot or plus sign; double-click a slot to edit value and subline placement.'
    : selectedTarget.description;
  const isNestedTextTarget = selectedTarget.kind === 'nested'
    && ['offer-value', 'offer-subline'].includes(String(selectedTarget.childId || ''));
  const selectedTargetIsText = isNestedTextTarget || selectedLayer.kind === 'text' || selectedLayer.id === 'cta';
  const canTextFit = !isGroupedSelection
    && selectedTargetIsText
    && selectedLayer.kind !== 'image'
    && (selectedLayer.kind !== 'group' || isNestedTextTarget)
    && selectedLayer.id !== 'cta';
  const activeFit = selectedTarget.kind === 'nested'
    ? (selectedTarget.fit || {})
    : (selectedLayer.fit || {});
  // Nested fit (offer value/subline) writes to classRule under offers-1 and to
  // variantRules[].fit under offers-2/3 — same independence as layout props.
  const applyFitUpdate = (field, value) => (
    selectedTarget.kind === 'nested'
      ? updateTargetFit(selectedTarget.id, field, value)
      : updateLayerFit(selectedLayer.id, field, value)
  );
  const fittedFontSize = activeCssClass ? fitResults.get(activeCssClass) : undefined;
  const fitStatus = fitSizeStatus(selectedTarget.values?.fontSize, fittedFontSize);
  const sourceKind = selectedTarget.writeSource?.kind || '';
  const sourceLabel = sourceKind === 'variantRule'
    ? `${selectedTarget.writeSource.scope} override`
    : sourceKind === 'classRule'
      ? 'Shared class'
      : 'Base layer';
  const sharedFields = Object.keys(
    selectedTarget.kind === 'nested'
      ? (sharedRule?.properties || {})
      : (selectedLayer?.base || {}),
  ).filter((field) => field !== 'cssClass');
  const overrideFields = Object.keys(activeRule?.props || {});
  const canClearOverride = overrideFields.some((field) => reusableStyleFields.includes(field));
  const setTextHorizontalAlign = (align) => {
    const justify = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
    updateTargetValue(selectedTarget.id, 'textAlign', align);
    updateTargetValue(selectedTarget.id, 'justifyContent', justify);
  };
  const setTextVerticalAlign = (align) => {
    updateTargetValue(selectedTarget.id, 'display', 'flex');
    updateTargetValue(selectedTarget.id, 'alignItems', align);
  };
  const scaleSelectedText = (delta) => {
    const current = Number(selectedTarget.values?.fontSize || 0);
    if (!Number.isFinite(current) || current <= 0) return;
    updateTargetValue(selectedTarget.id, 'fontSize', Math.max(1, Math.round(current + delta)));
  };

  return (
    <aside className="creative-inspector" aria-label="Inspector">
      <div className="workspace-panel-head">
        <div>
          <span className="panel-kicker">Inspector</span>
          <h2>{selectedTarget.label || selectedLayer.label || selectedLayer.id}</h2>
        </div>
        <span className="panel-count" title={selectedTarget.description}>
          {isGroupedSelection ? 'Grouped' : selectedTarget.coordinateScope === 'group' ? 'Group' : 'Canvas'}
        </span>
      </div>

      <div className="inspector-scroll">
        <InspectorSection
          id="layout"
          title="Layout"
          open={openSections.has('layout')}
          onToggle={() => toggleSection('layout')}
        >
          <p className="inspector-note">{layoutNote}</p>
          {!isGroupedSelection ? (
            <p className="inspector-note">
              Source: {selectedTarget.writeSource?.kind === 'variantRule'
                ? `${selectedTarget.writeSource.scope} override`
                : selectedTarget.writeSource?.kind === 'classRule'
                  ? 'shared group style'
                  : 'base layer'}
            </p>
          ) : null}
          {!isGroupedSelection ? (
          <div className="inspector-grid">
            {boxFields.map((field) => (
              <FieldControl
                key={field}
                label={field}
                type="text"
                value={selectedTarget.values?.[field] ?? ''}
                onChange={(value) => updateTargetValue(selectedTarget.id, field, value)}
              />
            ))}
          </div>
          ) : (
            <p className="inspector-note">This is the logical edit box for the active offer format. Drag or align it as one unit; double-click to edit inside.</p>
          )}
        </InspectorSection>

        {isHeadlineSelection ? (
          <InspectorSection
            id="headline-offers"
            title="Offer layouts"
            open={openSections.has('headline-offers')}
            onToggle={() => toggleSection('headline-offers')}
          >
            <HeadlineOfferLayoutSection document={document} size={size} offerCount={offerCount} />
          </InspectorSection>
        ) : null}

        <InspectorSection
          id="style"
          title="Styles"
          open={openSections.has('style')}
          onToggle={() => toggleSection('style')}
        >
          <div className="style-source-card">
            <div>
              <span className={`style-source-pill source-${sourceKind || 'base'}`}>{sourceLabel}</span>
              <strong>{selectedTarget.kind === 'nested' ? activeCssClass : selectedLayer.id}</strong>
              <p>
                {selectedTarget.kind === 'nested'
                  ? `Nested item uses the shared .${activeCssClass} class and can be overridden for ${activeScopes.join(', ')}.`
                  : `Layer class .${activeCssClass || selectedLayer.id} sits in the ${selectedLayer.group || 'Other'} library group.`}
              </p>
            </div>
          </div>
          <div className="inspector-grid">
            <FieldControl
              label="template name"
              type="text"
              value={selectedLayer.label || selectedLayer.id}
              onChange={(value) => updateLayerMetadata(selectedLayer.id, 'label', value)}
            />
            <FieldControl
              label="library group"
              type="text"
              value={selectedLayer.group || 'Other'}
              onChange={(value) => updateLayerMetadata(selectedLayer.id, 'group', value)}
            />
          </div>
          <div className="style-field-summary" aria-label="Reusable style fields">
            <span title="Fields on the base layer or shared class">Shared: {sharedFields.length ? sharedFields.join(', ') : 'none'}</span>
            {!isHeadlineSelection ? (
              <span title="Fields overridden for the current offer, T&C, or CTA state">Override: {overrideFields.length ? overrideFields.join(', ') : 'none'}</span>
            ) : null}
          </div>
          {!isHeadlineSelection ? (
          <div className="style-action-row">
            <button
              type="button"
              data-tip="Write the current active override values back to the shared style"
              disabled={sourceKind !== 'variantRule'}
              onClick={() => promoteTargetToSharedStyle(selectedTarget.id, reusableStyleFields)}
            >
              Promote to shared
            </button>
            <button
              type="button"
              data-tip="Remove the current variant override and use the shared style here"
              disabled={!canClearOverride}
              onClick={() => clearTargetOverrides(selectedTarget.id, reusableStyleFields)}
            >
              Clear override
            </button>
          </div>
          ) : (
            <p className="inspector-note">Use the Offer layouts section above to copy or reset headline placement by offer count.</p>
          )}
        </InspectorSection>

        {selectedTargetIsText && !isGroupedSelection ? (
          <InspectorSection
            id="type"
            title="Typography"
            open={openSections.has('type')}
            onToggle={() => toggleSection('type')}
          >
            <ButtonGroupControl
              label="Handles"
              value={resizeMode}
              options={[
                { value: 'frame', label: 'Frame', tip: 'Resize the text box without changing the text size' },
                { value: 'scale', label: 'Scale', tip: 'Resize the text box and text size together' },
              ]}
              onChange={setResizeMode}
            />
            {fitStatus.state !== 'unknown' ? (
              <div className={`fit-status fit-status-${fitStatus.state}`}>
                <strong>{fitStatus.state === 'scaled' ? 'Auto-fitted' : 'Stated size'}</strong>
                <span>{fitStatus.state === 'scaled'
                  ? `${fitStatus.fitted}px rendered from ${fitStatus.requested}px`
                  : `${fitStatus.requested}px rendered as stated`}</span>
              </div>
            ) : null}
            <div className="inspector-grid">
              {typeFields.map((field) => (
                <FieldControl
                  key={field}
                  label={field}
                  type="text"
                  value={selectedTarget.values?.[field] ?? ''}
                  onChange={(value) => updateTargetValue(selectedTarget.id, field, value)}
                />
              ))}
            </div>
            <div className="text-scale-row">
              <button type="button" data-tip="Decrease text size" aria-label="Decrease text size" onClick={() => scaleSelectedText(-1)}>A-</button>
              <button type="button" data-tip="Increase text size" aria-label="Increase text size" onClick={() => scaleSelectedText(1)}>A+</button>
            </div>
            <ButtonGroupControl
              label="Text x"
              value={selectedTarget.values?.textAlign || ''}
              options={[
                { value: 'left', label: 'Left', icon: 'alignLeft', tip: 'Align text left inside the box' },
                { value: 'center', label: 'Center', icon: 'alignCenterH', tip: 'Center text horizontally inside the box' },
                { value: 'right', label: 'Right', icon: 'alignRight', tip: 'Align text right inside the box' },
              ]}
              onChange={setTextHorizontalAlign}
            />
            <ButtonGroupControl
              label="Text y"
              value={selectedTarget.values?.alignItems || ''}
              options={[
                { value: 'flex-start', label: 'Top', icon: 'alignTop', tip: 'Align text to the top of the box' },
                { value: 'center', label: 'Middle', icon: 'alignCenterV', tip: 'Center text vertically inside the box' },
                { value: 'flex-end', label: 'Bottom', icon: 'alignBottom', tip: 'Align text to the bottom of the box; multi-line wraps upward' },
              ]}
              onChange={setTextVerticalAlign}
            />
          </InspectorSection>
        ) : null}

        {canTextFit ? (
          <InspectorSection
            id="fit"
            title="Fit"
            open={openSections.has('fit')}
            onToggle={() => toggleSection('fit')}
          >
            <p className="inspector-note">
              Shrink: reduce type until copy fits. Max lines 1 = single line; max lines 2+ = wrap up to that budget, then shrink. Wrap: keep the designed size and wrap only. Clip/truncate: no wrap or shrink — overflow is hidden. Clipped copy shows a red badge on the canvas.
            </p>
            <div className="inspector-grid">
              <SelectControl
                label="mode"
                value={activeFit?.mode || 'shrink'}
                onChange={(value) => applyFitUpdate('mode', value)}
              >
                <option value="shrink">shrink</option>
                <option value="wrap">wrap</option>
                <option value="clip">clip</option>
                <option value="truncate">truncate</option>
              </SelectControl>
              <FieldControl
                label="min font"
                type="text"
                value={activeFit?.minFontSize ?? ''}
                onChange={(value) => applyFitUpdate('minFontSize', value)}
              />
              <FieldControl
                label="max lines"
                type="text"
                value={activeFit?.maxLines ?? ''}
                onChange={(value) => applyFitUpdate('maxLines', value)}
              />
            </div>
          </InspectorSection>
        ) : null}

        <InspectorSection
          id="animation"
          title="Motion"
          open={openSections.has('animation')}
          onToggle={() => toggleSection('animation')}
        >
          {selectedTarget.kind === 'nested' ? (
            <p className="inspector-note">Nested offer items inherit animation from {selectedLayer.label || selectedLayer.id}. Select the parent slot to edit motion directly.</p>
          ) : null}
          <div className="motion-family-card">
            <div>
              <span className="panel-kicker">Motion family</span>
              <strong>{family.label}</strong>
              <p>{familyMembers.length > 1 ? `${familyMembers.length} related layers can share this motion style.` : 'This layer uses its own motion.'}</p>
            </div>
            {selectedClip ? (
              <button type="button" disabled={familyMembers.length < 2} onClick={() => copySelectedClipToAnimationFamily()}>
                Apply to family
              </button>
            ) : null}
          </div>
          <div className="motion-action-grid" aria-label="Add motion at current timeline point">
            {['fadeIn', 'fadeOut', 'slideInRight', 'fadeUp'].map((intentId) => (
              <button
                key={intentId}
                type="button"
                className={`motion-action intent-${intentId}`}
                data-tip={`Add ${animationIntentDefinitions[intentId].label.toLowerCase()} at ${playheadLabel}`}
                onClick={() => addAnimationIntent(selectedLayer.id, intentId)}
              >
                <span>{animationIntentDefinitions[intentId].label}</span>
                <small>{animationIntentDefinitions[intentId].anchor === 'end' ? 'End' : 'Start'} at {playheadLabel}</small>
              </button>
            ))}
          </div>
          <div className="clip-toolbar">
            <select
              value={selectedClip?.id || ''}
              onChange={(event) => selectClip(selectedLayer.id, event.target.value)}
            >
              {(selectedLayer.clips || []).map((clip) => (
                <option key={clip.id} value={clip.id}>{clip.label || clip.id}</option>
              ))}
            </select>
            <button type="button" data-tip={`Add a fade clip from ${playheadLabel}`} onClick={() => addClip(selectedLayer.id, 'fade')}>Add fade clip</button>
          </div>
          {selectedClip ? (
            <>
              <div className={`motion-summary intent-${selectedClipSpan?.intentId || selectedClip.preset}`}>
                <strong>{selectedClipSpan?.label || selectedClip.preset}</strong>
                <span>{spanSeconds}</span>
                <em>{selectedClipSpan?.linked ? 'Linked style' : 'Unlinked override'}</em>
                <button
                  type="button"
                  onClick={() => updateClip(selectedLayer.id, selectedClip.id, 'linked', !selectedClipSpan?.linked)}
                >
                  {selectedClipSpan?.linked ? 'Unlink' : 'Relink'}
                </button>
              </div>
              <div className="inspector-grid">
                <FieldControl
                  label="Preset"
                  type="text"
                  value={selectedClip.preset}
                  onChange={(value) => updateClip(selectedLayer.id, selectedClip.id, 'preset', value)}
                />
                <FieldControl
                  label="Start %"
                  type="text"
                  value={selectedClip.start}
                  onChange={(value) => updateClip(selectedLayer.id, selectedClip.id, 'start', value)}
                />
                <FieldControl
                  label="End %"
                  type="text"
                  value={selectedClip.end}
                  onChange={(value) => updateClip(selectedLayer.id, selectedClip.id, 'end', value)}
                />
              </div>
              <div className="param-grid">
                {Object.entries(selectedClip.params || {}).map(([field, value]) => (
                  <FieldControl
                    key={field}
                    label={field}
                    type="text"
                    value={value}
                    onChange={(next) => updateClip(selectedLayer.id, selectedClip.id, field, next, 'params')}
                  />
                ))}
              </div>
              <div className="preset-row">
                {['fade', 'slideInRight', 'fadeUp', 'popPulse'].map((preset) => (
                  <button key={preset} type="button" data-tip={`Add ${presetLabels[preset]} at ${playheadLabel}`} onClick={() => addClip(selectedLayer.id, preset)}>
                    {presetLabels[preset]}
                  </button>
                ))}
              </div>
              <div className="keyframe-list" aria-label="Selected clip keyframes">
                {keyframes.map((keyframe, index) => (
                  <span className={`keyframe-chip keyframe-chip-${keyframeTone(keyframe)}`} key={`${keyframe.at}-${index}`}>
                    {keyframeText(keyframe)}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </InspectorSection>

        <InspectorSection
          id="variants"
          title="Overrides"
          open={openSections.has('variants')}
          onToggle={() => toggleSection('variants')}
        >
          <div className="rule-list">
            {layerRules.length ? layerRules.map((rule) => (
              <div key={rule.id} className="rule-pill">
                <span>{Object.entries(rule.when || {}).map(([key, value]) => `${key}: ${value}`).join(', ') || rule.scope}</span>
                <strong>{Object.keys(rule.props || {}).join(', ')}</strong>
              </div>
            )) : <p className="muted-copy">No layer-specific variant rules.</p>}
          </div>
        </InspectorSection>

        <InspectorSection
          id="sample"
          title="Sample"
          open={openSections.has('sample')}
          onToggle={() => toggleSection('sample')}
        >
          <label className="inspector-field full">
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
          {feedFields
            .filter((field) => ['Creative State', 'Offers', 'Copy'].includes(field.group))
            .map((field) => (
              <label key={field.name} className="sample-field">
                <span>{field.label}</span>
                {field.type === 'enum' ? (
                  <select
                    value={String(row[field.name] ?? '')}
                    onChange={(event) => updateSelectedFeedField(field.name, event.target.value)}
                  >
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(row[field.name])}
                    onChange={(event) => updateSelectedFeedField(field.name, event.target.checked)}
                  />
                ) : (
                  <input
                    value={fieldInputValue(row, field)}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      try {
                        updateSelectedFeedField(field.name, event.target.value);
                      } catch (error) {
                        setStatus(error instanceof Error ? error.message : String(error), 'error');
                      }
                    }}
                  />
                )}
              </label>
            ))}
        </InspectorSection>

        <InspectorSection
          id="code"
          title="Code"
          open={openSections.has('code')}
          onToggle={() => toggleSection('code')}
        >
          <p className="inspector-note">Selected layer JSON. Apply keeps the same layer id and updates the creative document.</p>
          <textarea
            className="layer-code-editor"
            spellCheck={false}
            value={layerCode}
            onChange={(event) => {
              setLayerCode(event.target.value);
              setCodeError('');
            }}
          />
          {codeError ? <p className="code-error">{codeError}</p> : null}
          <div className="code-actions">
            <button
              type="button"
              onClick={() => {
                try {
                  replaceSelectedLayerFromCode(layerCode);
                  setCodeError('');
                } catch (error) {
                  setCodeError(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              Apply JSON
            </button>
            <button type="button" onClick={() => setLayerCode(JSON.stringify(selectedLayer, null, 2))}>
              Reset
            </button>
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}
