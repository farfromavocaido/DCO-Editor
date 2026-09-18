// @ts-nocheck
'use client';

import {KeyframeMotionEditor} from './KeyframeMotionEditor';
import {motionGeometry,editMotionGeometry} from '@/lib/motion-geometry';
import {TextAnchorControls} from './TextAnchorControls';
import {captureTextAnchor,renderedGeometry} from '@/lib/text-anchor';
import {FontSelector} from './FontManager';
import {SelectedLayoutRules} from './SelectedLayoutRules';
import {LayoutRuleSourceBadge} from './LayoutRulesPanel';
import { editOwnershipVersion } from '@/lib/ownership-ui';
import { effectiveTextFitForTarget } from '@/lib/text-fit-rules';
import { TextFitPolicyControls } from './TextFitPolicyControls';
import { OfferArrangementControls } from './OfferArrangementControls';
import { CreativeOwnershipControls } from './CreativeOwnershipControls';
import { useEffect, useMemo, useState } from 'react';

import { resolveTimeRef } from '@/lib/creative-compiler';
import { componentLinkForTarget } from '@/lib/creative-components';
import { ComponentLinkControls } from './ComponentLinkControls';
import { currentSizeCreative, isHeadlineLayer, findCreativeTarget } from '@/lib/creative-model';
import { campaignScopes } from '@/lib/campaign-variants';
import { beatsForScopes } from '@/lib/timing-profiles';
import { deriveSelectedTarget, OFFERS_BLOCK_ID } from '@/lib/selection-groups';
import { fitSizeStatus, fitTrackingStatus } from '@/lib/selection-chrome';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';
import { EditorIcon } from '@/components/EditorIcon';
import HeadlineOfferLayoutSection from '@/components/HeadlineOfferLayoutSection';

const fieldSourceLabel = (source) => {
  if (!source) return 'Default';
  if (source.kind === 'sharedDefinition') return `${source.name}${source.format ? ` · ${source.format}` : ''}`;
  if (source.kind === 'localOverride') return 'This state';
  if (source.kind === 'classRule') return 'Shared baseline';
  if (source.kind === 'layerFit' || source.kind === 'layerBase') return 'Base';
  if (source.scope) return String(source.scope).split('.').map((part) => ({
    'tc-solo':'T&Cs only', 'tc-prices':'T&Cs + rates', 'cta-rect':'Rectangular CTA',
    'cta-roundel':'Round CTA', 'roundel-split':'Copy + value', 'roundel-copy-only':'Copy only',
  }[part] || part.replace(/^offers-(\d+)$/, '$1 offers').replace(/^frames-(\d+)$/, '$1 frames'))).join(' · ');
  return 'Default';
};

const displayedGeometry = value => typeof value==='number' ? Number(value.toFixed(2)) : value;
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
function FieldControl({ label, value, onChange, type = 'number', disabled = false }) {
  return (
    <label className={`inspector-field ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        disabled={disabled}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectControl({ label, value, onChange, children, disabled = false }) {
  return (
    <label className={`inspector-field ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <select value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
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
  const [openSections, setOpenSections] = useState(() => new Set(['layout', 'headline-offers', 'gradient', 'blur', 'type', 'animation']));
  const [layerCode, setLayerCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const document = useEditorStore((s) => s.creativeDocument);
  const previewRow = useEditorStore(selectPreviewFeedRow);
  const size = useEditorStore((s) => s.size);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedTargetIds = useEditorStore((s) => s.selectedTargetIds);
  const isolationPath = useEditorStore((s) => s.isolationPath);
  const fitResults = useEditorStore((s) => s.fitResults);
  const motionEditMode=useEditorStore(s=>s.motionEditMode||'path');
  const playhead=useEditorStore(s=>s.percent);
  const selectedKeyframe=useEditorStore(s=>s.selectedKeyframe || s.selectedTransition);
  useEffect(()=>{if(selectedKeyframe)setOpenSections(previous=>new Set([...previous,'animation']));},[selectedKeyframe]);
  const layoutDiagnostics=useEditorStore(s=>s.layoutDiagnostics);
  const selectLayoutRule=useEditorStore(s=>s.selectLayoutRule);
  const fitDiagnostics = useEditorStore((s) => s.fitDiagnostics);
  const fitTrackings = useEditorStore((s) => s.fitTrackings);
  const resizeMode = useEditorStore((s) => s.resizeMode);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const includeRoundelFrame = useEditorStore((s) => s.includeRoundelFrame);
  const frameCount = useEditorStore((s) => s.frameCount);
  const roundelMode = useEditorStore((s) => s.roundelMode);
  const selectedLayer = useEditorStore((s) => s.selectedLayer());
  const selectedClip = useEditorStore((s) => s.selectedClip());
  const updateGroupedTargetValue = useEditorStore((s) => s.updateCreativeTargetValue);
  const updateLayerMetadata = useEditorStore((s) => s.updateCreativeLayerMetadataValue);
  const updateLayerGradient = useEditorStore((s) => s.updateCreativeLayerGradientValue);
  const updateLayerBlur = useEditorStore((s) => s.updateCreativeLayerBlurValue);
  const promoteTargetToSharedStyle = useEditorStore((s) => s.promoteCreativeTargetToSharedStyle);
  const clearTargetOverrides = useEditorStore((s) => s.clearCreativeTargetOverrides);
  const updateLayerFit = useEditorStore((s) => s.updateCreativeLayerFitValue);
  const updateGroupedTargetFit = useEditorStore((s) => s.updateCreativeTargetFitValue);
  const setResizeMode = useEditorStore((s) => s.setResizeMode);
  const replaceSelectedLayerFromCode = useEditorStore((s) => s.replaceSelectedLayerFromCode);

  const sizeCreative = currentSizeCreative(document, size);
  const activeScopes = useMemo(() => campaignScopes(document, previewRow), [document, previewRow]);
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
  const durationS = document?.clock?.durationS || 15;

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

  const componentLink = componentLinkForTarget(document, size, selectedTarget.id, activeScopes);
  const actualGeometry=renderedGeometry(selectedTarget.id);
  const motionOwner=motionGeometry(document,size,selectedTarget.id,activeScopes,playhead);
  const editComponentBounds = (field, raw) => {
    const value = Number(raw);
    const bounds = selectedTarget.bounds;
    if (!bounds || !Number.isFinite(value) || (['width', 'height'].includes(field) && value <= 0)) return;
    const next = { ...bounds, [field]: value };
    if (selectedTarget.resize === 'proportional' && ['width', 'height'].includes(field)) {
      const ratio = value / bounds[field];
      next.width = bounds.width * ratio;
      next.height = bounds.height * ratio;
    }
    useEditorStore.getState().updateSelectedComponentBounds(next);
  };
  if (selectedTarget.kind === 'component' || componentLink) {
    return (
      <aside className="creative-inspector" aria-label="Inspector">
        <div className="workspace-panel-head"><div><span className="panel-kicker">Component</span><h2>{selectedTarget.label}</h2></div></div>
        <div className="inspector-scroll">
          {selectedTarget.kind === 'component' && <div className="inspector-grid">
            {boxFields.map(field => <FieldControl key={field} label={({left:'X',top:'Y',width:'Width',height:'Height'})[field]} type="number"
              value={motionOwner?.values[field] ?? (selectedTarget.fit?.anchor?actualGeometry?.[field]:undefined) ?? selectedTarget.values?.[field] ?? ''} onChange={value => editComponentBounds(field, value)} />)}
          </div>}
          <SelectedLayoutRules key={selectedTarget.id} document={document} size={size} targetId={selectedTarget.id} targetIds={selectedTarget.kind==='component'?selectedTarget.parts.map(p=>p.targetId):[selectedTarget.id]} scopes={activeScopes}/>
          <ComponentLinkControls document={document} size={size} targetId={selectedTarget.id} scopes={activeScopes} />
          {selectedTarget.kind === 'component' && <CreativeOwnershipControls key={`${size}/${selectedTarget.id}/${activeScopes.join('.')}`} document={document} size={size} target={selectedTarget} scopes={activeScopes} />}
          {selectedTarget.kind === 'component' && <InspectorSection id="component-parts" title="Parts" open={true} onToggle={() => {}}>
            {selectedTarget.parts.map((part) => <button key={part.targetId} type="button" className="layer-row-main"
              onClick={() => useEditorStore.getState().setCanvasSelection(part.targetId, [part.targetId], [selectedTarget.id])}>
              {findCreativeTarget(document, size, part.targetId, activeScopes)?.label || part.role}
            </button>)}
          </InspectorSection>}
        </div>
      </aside>
    );
  }

  const isGroupedSelection = selectedTarget.kind === 'group' || selectedTarget.kind === 'multi';
  const layoutOwner=field=>{
    const rule=(document.layoutRules||[]).find(rule=>rule.enabled&&rule.targets.some(member=>member.size===size&&member.targetId===selectedTarget.id)&&((rule.type==='conditional'&&Object.hasOwn({...rule.values,...rule.otherwise},field))||(rule.type==='distribute'&&rule.crossAlign&&rule.crossAlign!=='keep'&&['left','top'].includes(field))||(rule.type!=='conditional'&&(rule.axis==='x'?'left':'top')===field))&&layoutDiagnostics.some(d=>d.id===rule.id&&d.size===size&&d.targetId===selectedTarget.id&&d.status==='active'));
    return rule?{rule,diagnostic:layoutDiagnostics.find(d=>d.id===rule.id&&d.size===size&&d.targetId===selectedTarget.id&&d.status==='active')}:null;
  };
  const showRule=id=>{selectLayoutRule(id);setTimeout(()=>{const details=window.document.querySelector('.inspector-scroll .selected-layout-rules');if(details){details.open=true;details.scrollIntoView({block:'nearest'});}},0);};

  const isGradientSelection = selectedLayer.kind === 'gradient' && !isGroupedSelection;
  const isBlurSelection = selectedLayer.kind === 'blur' && !isGroupedSelection;
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
;
  const activeFit = selectedTarget.fit || {};
  const effectiveFitRule = effectiveTextFitForTarget(document, size, selectedTarget.id, activeScopes);
  const heightManaged=canTextFit&&!motionOwner?.fields.includes('height')&&(effectiveFitRule.frame==='auto'||!effectiveFitRule.frame&&effectiveFitRule.wrap&&Number(effectiveFitRule.maxLines)>0&&actualGeometry&&actualGeometry.height<Number(selectedTarget.values.height)-.5);
  const motionFrameEditable=field=>motionOwner?.clips.some(c=>c.keyframes?.some(k=>k[field]!==undefined&&Math.abs(resolveTimeRef(k.at,activeBeats,document.clock.durationS)-playhead)<.01));
  const editVersion = (targetId, domain, patch) => {
    if (isGroupedSelection) {
      for (const [field,value] of Object.entries(patch)) (domain === 'fit' ? updateGroupedTargetFit : updateGroupedTargetValue)(targetId,field,value);
      return;
    }
    const state = useEditorStore.getState();
    let next=state.creativeDocument;
    for(const [field,value] of Object.entries(patch)){try{if(domain==='values'&&field==='top'&&selectedTarget.fit?.anchor){const current=renderedGeometry(targetId)?.top??selectedTarget.values.top;next=editOwnershipVersion(next,size,targetId,activeScopes,'fit',{anchor:{...selectedTarget.fit.anchor,position:selectedTarget.fit.anchor.position+Number(value)-current}});}next=(domain==='values'?editMotionGeometry(next,size,targetId,activeScopes,state.percent,field,value,state.motionEditMode||'path'):null)||editOwnershipVersion(next,size,targetId,activeScopes,domain,{[field]:value});}catch(error){state.setStatus(error.message,'warn');return;}}
    state.applyCreativeOwnershipDocument(next, 'Updated this version');
  };
  const updateTargetValue = (targetId,field,value) => editVersion(targetId,'values',{[field]:value});
  const applyFitUpdate = (field,value)=>{const patch={[field]:value};if(['maxLines','frame','wrap'].includes(field)&&!selectedTarget.fit?.anchor&&!layoutOwner('top')&&(selectedTarget.values?.alignItems==='flex-end'||selectedTarget.fit?.align==='bottom')){try{patch.anchor=captureTextAnchor(selectedTarget.id,'end');}catch(error){if(!error.message.includes('non-empty')){useEditorStore.getState().setStatus(error.message,'warn');return;}}}editVersion(selectedTarget.id,'fit',patch);};
  const fittedFontSize = fitResults.get(selectedTarget.id) ?? (activeCssClass ? fitResults.get(activeCssClass) : undefined);
  const fittedTracking = fitTrackings?.has?.(selectedTarget.id) ? fitTrackings.get(selectedTarget.id) : activeCssClass && fitTrackings?.has?.(activeCssClass)
    ? fitTrackings.get(activeCssClass)
    : undefined;
  const fitDiagnostic = fitDiagnostics?.get(selectedTarget.id) ?? fitDiagnostics?.get(activeCssClass);
  const fitStatus = fitSizeStatus(selectedTarget.values?.fontSize, fittedFontSize);
  const trackingStatus = fitTrackingStatus(fittedTracking);
  const sourceKind = selectedTarget.writeSource?.kind || '';
  const sourceLabel = sourceKind === 'variantRule'
    ? `${selectedTarget.writeSource.scope} override`
    : sourceKind === 'classRule'
      ? 'Legacy class'
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
    editVersion(selectedTarget.id,'values',{textAlign:align,justifyContent:justify});
  };
  const setTextVerticalAlign = (align) => {
    editVersion(selectedTarget.id,'values',{display:'flex',alignItems:align});
  };
  const fitMode = activeFit?.mode || effectiveFitRule.static || (effectiveFitRule.allowShrink === false ? 'wrap' : 'shrink');
  const minFontEnabled = canTextFit && (effectiveFitRule.frame ? effectiveFitRule.allowShrink !== false && !effectiveFitRule.static : fitMode === 'shrink');

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
          title={isGroupedSelection ? "Layout" : "Edit this version"}
          open={openSections.has('layout')}
          onToggle={() => toggleSection('layout')}
        >
          <span className="inspector-help" tabIndex={0} aria-label="Editing scope" title={isGroupedSelection ? layoutNote : "Changes apply to this format and the current feed conditions."}>ⓘ</span>
          <OfferArrangementControls document={document} size={size} target={selectedTarget} scopes={activeScopes} />
          {!isGroupedSelection ? (
          <div className="inspector-grid">
            {boxFields.map((field) => (
              <div key={field}><FieldControl
                label={({left:'X',top:'Y',width:'Width',height:'Height'})[field]}
                type="text" disabled={Boolean(layoutOwner(field))||(field==='height'&&heightManaged)||(motionEditMode==='keyframe'&&motionOwner?.fields.includes(field)&&!motionFrameEditable(field))}
                value={displayedGeometry((actualGeometry?.layoutMotion?actualGeometry[field]:undefined) ?? (field==='height'&&heightManaged?actualGeometry?.height:undefined) ?? layoutOwner(field)?.diagnostic?.after?.[field] ?? motionOwner?.values[field] ?? (selectedTarget.fit?.anchor?actualGeometry?.[field]:undefined) ?? selectedTarget.values?.[field] ?? '')}
                onChange={(value) => updateTargetValue(selectedTarget.id, field, value)}
              />{layoutOwner(field)&&<LayoutRuleSourceBadge name={layoutOwner(field).rule.name} active linked={layoutOwner(field).rule.targets.length>1} onClick={()=>showRule(layoutOwner(field).rule.id)}/>} {field==='height'&&heightManaged&&<span className="inspector-note" title="Choose Fixed frame in Text frame to edit height directly">Height follows text fitting</span>}{field==='top'&&selectedTarget.fit?.anchor&&!layoutOwner(field)&&<span className="inspector-note" title="Drag or edit Y to move the pinned edge; changing line count keeps it fixed">Pinned {({end:'bottom',start:'top',center:'centre'})[selectedTarget.fit.anchor.edge]}</span>}</div>
            ))}
          </div>
          ) : (
            <span className="inspector-note">{selectedTarget.members?.length || 1} selected items</span>
          )}
        </InspectorSection>

        {motionOwner?.fields.some(field=>!layoutOwner(field))&&<div className="motion-position-source"><span title={motionOwner.clips.map(c=>c.label||c.id).join(', ')}>{motionOwner.fields.filter(field=>!layoutOwner(field)).map(field=>({left:'X',top:'Y',width:'Width',height:'Height'})[field]).join(' / ')} controlled by animation</span><select aria-label="Position editing mode" value={motionEditMode} onChange={e=>useEditorStore.setState({motionEditMode:e.target.value})}><option value="path">Move whole path · this version</option><option value="keyframe">Edit selected position keyframe</option></select></div>}
        {!isGroupedSelection&&<ComponentLinkControls document={document} size={size} targetId={selectedTarget.id} scopes={activeScopes}/> }
        {!isGroupedSelection ? <CreativeOwnershipControls key={`${size}/${selectedTarget.id}/${activeScopes.join(".")}`} document={document} size={size} target={selectedTarget} scopes={activeScopes} /> : null}

        <SelectedLayoutRules key={selectedTarget.id} document={document} size={size} targetId={selectedTarget.id} targetIds={isGroupedSelection?selectedTarget.members:[selectedTarget.id]} scopes={activeScopes}/>

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

        {isGradientSelection ? (
          <InspectorSection
            id="gradient"
            title="Gradient"
            open={openSections.has('gradient')}
            onToggle={() => toggleSection('gradient')}
          >
            <p className="inspector-note">
              Static dark scrim for offers-0 (supports white T&Cs). Mid opacity is always half of start opacity.
              Visible only when Offers is 0.
            </p>
            <div className="inspector-grid">
              <SelectControl
                label="direction"
                value={selectedLayer.gradient?.direction || 'to-bottom'}
                onChange={(value) => updateLayerGradient(selectedLayer.id, 'direction', value)}
              >
                <option value="to-bottom">to bottom</option>
                <option value="to-right">to right</option>
                <option value="to-top">to top</option>
              </SelectControl>
              <FieldControl
                label="end %"
                type="number"
                value={selectedLayer.gradient?.endPct ?? ''}
                onChange={(value) => updateLayerGradient(selectedLayer.id, 'endPct', value)}
              />
              <FieldControl
                label="start opacity"
                type="number"
                value={selectedLayer.gradient?.startOpacity ?? ''}
                onChange={(value) => updateLayerGradient(selectedLayer.id, 'startOpacity', value)}
              />
              <FieldControl
                label="midpoint"
                type="number"
                value={selectedLayer.gradient?.midpoint ?? ''}
                onChange={(value) => updateLayerGradient(selectedLayer.id, 'midpoint', value)}
              />
            </div>
          </InspectorSection>
        ) : null}

        {isBlurSelection ? (
          <InspectorSection
            id="blur"
            title="Blur"
            open={openSections.has('blur')}
            onToggle={() => toggleSection('blur')}
          >
            <p className="inspector-note">
              Offers-0 backdrop blur over the photo. Fades in with the roundel (or CTA if the roundel is off) and out with the blue wave.
            </p>
            <div className="inspector-grid">
              <label className="inspector-field">
                <span>enabled</span>
                <input
                  type="checkbox"
                  checked={selectedLayer.blur?.enabled !== false}
                  onChange={(event) => updateLayerBlur(selectedLayer.id, 'enabled', event.target.checked)}
                />
              </label>
              <FieldControl
                label="strength"
                type="number"
                value={selectedLayer.blur?.strength ?? ''}
                onChange={(value) => updateLayerBlur(selectedLayer.id, 'strength', value)}
              />
            </div>
          </InspectorSection>
        ) : null}

        {selectedTargetIsText && !isGroupedSelection ? (
          <InspectorSection
            id="type"
            title="Typography"
            open={openSections.has('type')}
            onToggle={() => toggleSection('type')}
          >
            <FontSelector document={document} value={selectedTarget.values} onChange={patch=>editVersion(selectedTarget.id,'values',patch)}/>
            <ButtonGroupControl
              label="Handles"
              value={resizeMode}
              options={[
                { value: 'frame', label: 'Frame', tip: 'Resize the text box without changing the text size' },
                { value: 'scale', label: 'Scale', tip: 'Resize the text box and text size together' },
              ]}
              onChange={setResizeMode}
            />
            {fitDiagnostic?.reason ? <p role="status" className="inspector-note">Text constraint: {fitDiagnostic.reason}</p> : null}
            {fitStatus.state !== 'unknown' ? (
              <div className={`fit-status fit-status-${fitStatus.state}`}>
                <strong>{fitStatus.state === 'scaled' ? 'Auto-fitted' : 'Stated size'}</strong>
                <span>{fitStatus.state === 'scaled'
                  ? `${fitStatus.fitted}px rendered from ${fitStatus.requested}px`
                  : `${fitStatus.requested}px rendered as stated`}</span>
                {trackingStatus.state !== 'unknown' ? (
                  <span className={`fit-tracking fit-tracking-${trackingStatus.state}`}>
                    {trackingStatus.state === 'squeezed'
                      ? `Tracking ${trackingStatus.label} (fit squeeze)`
                      : `Tracking ${trackingStatus.label} (no squeeze)`}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="inspector-grid">
              <FieldControl
                label="Font size"
                type="text"
                value={selectedTarget.values?.fontSize ?? ''}
                onChange={(value) => updateTargetValue(selectedTarget.id, 'fontSize', value)}
              />
              {canTextFit ? (
                <FieldControl
                  label="Min font size"
                  type="text"
                  value={activeFit?.minFontSize ?? effectiveFitRule.minFontSize ?? ''}
                  disabled={!minFontEnabled}
                  onChange={(value) => applyFitUpdate('minFontSize', value)}
                />
              ) : null}
            </div>
            {canTextFit&&<TextAnchorControls controlledBy={layoutOwner('top')?.rule.name} target={selectedTarget} canvasHeight={sizeCreative.canvas.height} onChange={applyFitUpdate}/>}
            {canTextFit ? <>
              <FieldControl
                label="Minimum size (% of design)"
                type="text"
                value={Number(effectiveFitRule.minFontSizeRatio || 0) * 100}
                disabled={!minFontEnabled}
                onChange={(value) => applyFitUpdate('minFontSizeRatio', Number(value) / 100)}
              />
              <p className="inspector-note">When shrinking, the minimum is whichever is larger: the pixel minimum or this percentage of the designed font size. Fixed font sizing ignores these limits.</p>
            </> : null}
            {canTextFit ? <TextFitPolicyControls fit={activeFit} effectiveRule={effectiveFitRule} onChange={applyFitUpdate} /> : null}
            {canTextFit ? (
              <div className="inspector-grid">
                {!effectiveFitRule.frame ? <SelectControl
                  label={`Fit mode · ${selectedTarget.fitProvenance?.mode?.scope || selectedTarget.fitProvenance?.mode?.kind || "default"}`}
                  value={fitMode}
                  onChange={(value) => applyFitUpdate('mode', value)}
                >
                  <option value="shrink">shrink</option>
                  <option value="wrap">wrap</option>
                  <option value="clip">clip</option>
                  <option value="truncate">truncate</option>
                </SelectControl> : null}
                <FieldControl
                  label="Max lines"
                  type="text"
                  value={activeFit?.maxLines ?? effectiveFitRule.maxLines ?? ''}
                  onChange={(value) => applyFitUpdate('maxLines', value)}
                />
              </div>
            ) : null}
            <div className="inspector-grid">
              <FieldControl
                label="Line height"
                type="text"
                value={selectedTarget.values?.lineHeight ?? ''}
                onChange={(value) => updateTargetValue(selectedTarget.id, 'lineHeight', value)}
              />
              <FieldControl
                label="Letter spacing"
                type="text"
                value={selectedTarget.values?.letterSpacing ?? ''}
                onChange={(value) => updateTargetValue(selectedTarget.id, 'letterSpacing', value)}
              />
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

        <InspectorSection
          id="style"
          title="Template defaults"
          open={openSections.has('style')}
          onToggle={() => toggleSection('style')}
        >
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
            <span title="Fields on the base layer or shared class">Template: {sharedFields.length ? sharedFields.join(', ') : 'none'}</span>
            {!isHeadlineSelection ? (
              <span title="Fields overridden for the current offer, T&C, or CTA state">Override: {overrideFields.length ? overrideFields.join(', ') : 'none'}</span>
            ) : null}
          </div>
          {!isHeadlineSelection ? (
          <div className="style-action-row">
            <button
              type="button"
              data-tip="Write current legacy variant values to its baseline. Named sharing is managed separately above."
              disabled={sourceKind !== 'variantRule'}
              onClick={() => promoteTargetToSharedStyle(selectedTarget.id, reusableStyleFields)}
            >
              Update template defaults
            </button>
            <button
              type="button"
              data-tip="Remove current legacy variant fields to use the baseline here"
              disabled={!canClearOverride}
              onClick={() => clearTargetOverrides(selectedTarget.id, reusableStyleFields)}
            >
              Use template defaults
            </button>
          </div>
          ) : (
            <p className="inspector-note">Use the Offer layouts section above to copy or reset headline placement by offer count.</p>
          )}
        </InspectorSection>

        {!isGradientSelection && !isBlurSelection ? (
        <InspectorSection
          id="animation"
          title="Motion"
          open={openSections.has('animation')}
          onToggle={() => toggleSection('animation')}
        >
          {selectedTarget.kind === 'nested' ? (
            <p className="inspector-note">Nested offer items inherit animation from {selectedLayer.label || selectedLayer.id}. Select the parent slot to edit motion directly.</p>
          ) : null}
          {isGroupedSelection?<p className="inspector-note">Select a layer or timeline clip to edit its keyframes.</p>:<KeyframeMotionEditor layer={selectedLayer} clip={selectedClip} beats={activeBeats} canvas={sizeCreative.canvas} durationS={durationS}/>}

        </InspectorSection>
        ) : null}

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
