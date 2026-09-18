// @ts-nocheck
'use client';

import {renderedGeometry} from '@/lib/text-anchor';
import {motionGeometry,motionKeyframeAvailable} from '@/lib/motion-geometry';
import { componentLinkForTarget } from '@/lib/creative-components';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {CreativeContextMenu,CreativeTransferLauncher} from './CreativeContextMenu';
import {PlacementPreviewOverlay} from './PlacementPreviewOverlay';
import {LayoutAreaOverlay} from './LayoutAreaOverlay';
import {RuleConnectors} from './RuleConnectors';
import {validateLayoutRules} from '@/lib/layout-rules';
import { ComponentNavigation } from './ComponentNavigation';
import { ProductionCreativeStage } from '@/components/ProductionCreativeStage';
import { getProductionStage, productionTargetClipped, unionProductionBounds, type ProductionTarget } from '@/lib/production-stage';
import {
  collectSnapBounds,
  computeSnap,
  getTargetCanvasBounds,
} from '@/lib/canvas-alignment';
import {
  buildGroupScaleSnapshots,
  frameResizeWritesFromHandle,
  groupResizeAnchor,
  scaledFieldWritesForSnapshot,
  scaledResizeWritesFromHandle,
  scaleTargetIdsForOfferGroup,
  uniformScaleFromHandle,
} from '@/lib/canvas-group-scale';
import {
  currentSizeCreative,
  findCreativeTarget,
  HEADLINE_CSS_CLASS,
  isHeadlineLayer,
  targetIdForLayerChild,
} from '@/lib/creative-model';
import {
  deriveSelectedTarget,
  filterManipulationTargetIds,
  getGroupCanvasBounds,
  OFFERS_BLOCK_ID,
  offerBlockLayerIds,
  selectionHierarchy,
} from '@/lib/selection-groups';
import { zoomLabel, zoomScale } from '@/lib/canvas-zoom';
import { resolveOfferPlusLayout } from '@/lib/offer-plus-layout';
import {
  feedFieldForEditableTarget,
} from '@/lib/preview-utils';
import { resizeHandlesForSelection, selectionChromeKind } from '@/lib/selection-chrome';
import { campaignScopes } from '@/lib/campaign-variants';
import { useStageResize } from '@/hooks/useStageResize';
import { EditorIcon } from '@/components/EditorIcon';
import { PlayheadReadout } from '@/components/PlayheadReadout';
import { AlignControls, AlignmentGuides, ViewportRulersFrame } from '@/components/CanvasWorkspace';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dimensionValue = (value: unknown, fallback: number, basis = fallback) => {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    const percent = Number.parseFloat(value);
    return Number.isFinite(percent) ? (basis * percent) / 100 : fallback;
  }
  return numberValue(value, fallback);
};

export function PreviewPane() {
  const [contextMenu, setContextMenu] = useState(null);
  const [productionTargets, setProductionTargets] = useState<ProductionTarget[]>([]);
  const [manipulationBounds, setManipulationBounds] = useState(null);
  const manipulationActive = useRef(false);
  const receiveProductionTargets = useCallback((targets: ProductionTarget[]) => {
    setProductionTargets(targets);
    if (!manipulationActive.current) setManipulationBounds(null);
    const fitResults = new Map<string, number>();
    const fitTrackings = new Map<string, number>();
    const fitClipped = new Map<string, boolean>();
    const fitDiagnostics = new Map();
    for (const target of targets) {
      const style = target.element.ownerDocument.defaultView?.getComputedStyle(target.element);
      if (!style) continue;
      const outlineSvg = target.element.querySelector('svg[data-rendered-font-size]');
      if (target.element.classList.contains('outlined-text') && !outlineSvg) continue;
      const fontSize = Number.parseFloat(outlineSvg?.getAttribute('data-rendered-font-size') || style.fontSize);
      if (!(fontSize > 0)) continue;
      const tracking = outlineSvg ? Number(outlineSvg.getAttribute('data-rendered-tracking-em') || 0) : (Number.parseFloat(style.letterSpacing) || 0) / fontSize;
      for (const key of [target.id, ...target.element.classList]) {
        fitResults.set(key, fontSize);
        fitTrackings.set(key, tracking);
        fitClipped.set(key, target.element.getAttribute('data-fit-clipped') === 'true');
        if (target.element.hasAttribute('data-fit-status')) fitDiagnostics.set(key, {
          status: target.element.getAttribute('data-fit-status'),
          requestedSize: Number(target.element.getAttribute('data-fit-requested-size')),
          renderedSize: Number(target.element.getAttribute('data-fit-rendered-size')),
          reason: target.element.getAttribute('data-fit-clip-reason') || '',
        });
      }
    }
    useEditorStore.setState({ fitResults, fitTrackings, fitClipped, fitDiagnostics });
  }, []);
  const [snapGuides, setSnapGuides] = useState({ vertical: [], horizontal: [] });
  const [userGuides, setUserGuides] = useState({ vertical: [], horizontal: [] });
  const document = useEditorStore((s) => s.creativeDocument);
  const size = useEditorStore((s) => s.size);
  const percent = useEditorStore((s) => s.percent);
  const statusMessage = useEditorStore((s) => s.statusMessage);
  const statusTone = useEditorStore((s) => s.statusTone);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedTargetIds = useEditorStore((s) => s.selectedTargetIds);
  const isolationPath = useEditorStore((s) => s.isolationPath);
  const isolatedGroupId = useEditorStore((s) => s.isolatedGroupId);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const includeRoundelFrame = useEditorStore((s) => s.includeRoundelFrame);
  const frameCount = useEditorStore((s) => s.frameCount);
  const roundelMode = useEditorStore((s) => s.roundelMode);
  const row = useEditorStore(selectPreviewFeedRow);
  const layoutPreview=useEditorStore(s=>s.layoutPreview);
  const layoutPreviewCopy=useEditorStore(s=>s.layoutPreviewCopy);
  const layoutRow=useMemo(()=>{const base=layoutPreview?.size===size?layoutPreview.row:row;return layoutPreviewCopy?.size===size?{...base,...layoutPreviewCopy.values}:base;},[row,layoutPreview,layoutPreviewCopy,size]);
  const layoutDiagnostics=useEditorStore(s=>s.layoutDiagnostics);
  const selectedLayoutRuleId=useEditorStore(s=>s.selectedLayoutRuleId);
  const pendingLayoutEdit=useEditorStore(s=>s.layoutAreaEdit);
  const previewRenderMode = useEditorStore(s => s.previewRenderMode);
  const setPreviewRenderMode = useEditorStore(s => s.setPreviewRenderMode);
  const canvasZoom = useEditorStore((s) => s.canvasZoom);
  const resizeMode = useEditorStore((s) => s.resizeMode);
  const selectTarget = useEditorStore((s) => s.selectTarget);
  const updateTargetValue = useEditorStore((s) => s.updateCreativeTargetValue);
  const lockedLayerIds = useEditorStore((s) => s.lockedLayerIds);
  const hiddenLayerIds = useEditorStore((s) => s.hiddenLayerIds);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const addAnimationIntent = useEditorStore((s) => s.addAnimationIntent);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const toggleLayerLock = useEditorStore((s) => s.toggleLayerLock);
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility);
  const addShapeLayer = useEditorStore((s) => s.addShapeLayer);
  const moveLayerZ = useEditorStore((s) => s.moveLayerZ);
  const requestEditFeedField = useEditorStore((s) => s.requestEditFeedField);
  const fitClipped = useEditorStore((s) => s.fitClipped);
  const setCanvasZoom = useEditorStore((s) => s.setCanvasZoom);
  const stepCanvasZoom = useEditorStore((s) => s.stepCanvasZoom);
  const alignSelectedTarget = useEditorStore((s) => s.alignSelectedTarget);
  const distributeSelectedTarget = useEditorStore((s) => s.distributeSelectedTarget);
  const clearCanvasSelection = useEditorStore((s) => s.clearCanvasSelection);
  const alignGuideTimerRef = useRef<number | null>(null);
  const handleCanvasTargetClick = useEditorStore((s) => s.handleCanvasTargetClick);
  const drillIntoCanvasTarget = useEditorStore((s) => s.drillIntoCanvasTarget);
  const exitGroupIsolation = useEditorStore((s) => s.exitGroupIsolation);
  const selectOffersBlock = useEditorStore((s) => s.selectOffersBlock);

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const sizeCreative = currentSizeCreative(document, size);
  const { scale: autoScale, shellStyle: autoShellStyle } = useStageResize(viewportRef, sizeCreative?.canvas);
  const scale = zoomScale(canvasZoom, autoScale);
  const shellStyle = sizeCreative?.canvas ? {
    width: sizeCreative.canvas.width * scale,
    height: sizeCreative.canvas.height * scale,
  } : autoShellStyle;
  const activeScopes = useMemo(() => campaignScopes(document, row), [document, row]);
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

  const seconds = document?.clock?.durationS ? (percent / 100) * document.clock.durationS : 0;

  useEffect(() => {
    setUserGuides({ vertical: [], horizontal: [] });
    exitGroupIsolation();
  }, [exitGroupIsolation, size]);

  useEffect(() => {
    useEditorStore.getState().reconcileOfferSelection();
  }, [offerCount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active=window.document.activeElement;
      if (event.key === 'Enter' && active?.matches('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === 'Enter' && selectedTargetId) {
        event.preventDefault();
        drillIntoCanvasTarget();
        return;
      }
      if (event.key === 'Escape' && isolatedGroupId) {
        event.preventDefault();
        exitGroupIsolation();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drillIntoCanvasTarget, exitGroupIsolation, isolatedGroupId, selectedTargetId]);

  const startSelectionDrag = useCallback((event: React.PointerEvent, deepestTargetId: string) => {
    if (!getProductionStage()) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    handleCanvasTargetClick(event, deepestTargetId);

    const lockedLayerId = String(deepestTargetId || '').split('::')[0];
    if (lockedLayerIds.has(lockedLayerId)) return;

    if (event.metaKey || event.ctrlKey || event.shiftKey) return;

    const state = useEditorStore.getState();
    const dragTargetIds = state.selectionDragTargetIds();
    if(state.motionEditMode==='keyframe'&&dragTargetIds.some(id=>{const owner=motionGeometry(state.creativeDocument,size,id,activeScopes,state.percent);return ['left','top'].some(field=>owner?.fields.includes(field)&&!motionKeyframeAvailable(owner,field,state.percent));})){state.setStatus('Select a position keyframe in Motion before dragging','warn');return;}
    if(state.layoutRuleBlocksEdit(dragTargetIds,['left','top']))return;
    const dragTargets = dragTargetIds
      .map((targetId) => {
        const target = findCreativeTarget(state.creativeDocument, size, targetId, activeScopes);
        if (!target) return null;
        const motion=motionGeometry(state.creativeDocument,size,targetId,activeScopes,state.percent);
        return {
          targetId,
          target,
          startLeft: numberValue(motion?.values.left ?? target.values?.left, 0),
          startTop: numberValue(motion?.values.top ?? (target.fit?.anchor?renderedGeometry(targetId)?.top:undefined) ?? target.values?.top, 0),
          isNested: target.kind === 'nested',
          parentLayerId: target.parentLayerId || '',
          originLeft: numberValue(target.wrapperBounds?.left, 0),
          originTop: numberValue(target.wrapperBounds?.top, 0),
        };
      })
      .filter(Boolean);
    if (!dragTargets.length) return;
    const beforeDocument = state.creativeDocument;
    const ghostStart = unionProductionBounds(productionTargets.filter(target => dragTargetIds.includes(target.id)));
    const componentSelection = state.selectedTarget();
    const componentStartBounds = componentSelection?.kind === 'component' ? componentSelection.bounds : null;

    const startX = event.clientX;
    const startY = event.clientY;
    const primary = dragTargets[0];
    const primaryBounds = getTargetCanvasBounds(document, size, primary.targetId, activeScopes);
    const snapOthers = collectSnapBounds(document, size, activeScopes, dragTargetIds);
    let lastPositions = dragTargets.map((item) => ({ targetId: item.targetId, left: item.startLeft, top: item.startTop }));

    let pendingMove: PointerEvent | null = null;
    let moveFrame = 0;
    const applyMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      let deltaLeft = Math.round(dx);
      let deltaTop = Math.round(dy);

      if (primaryBounds && sizeCreative?.canvas && dragTargets.length === 1 && !motionGeometry(state.creativeDocument,size,primary.targetId,activeScopes,state.percent)) {
        const item = dragTargets[0];
        const parentTarget = item.isNested
          ? findCreativeTarget(document, size, item.parentLayerId, activeScopes)
          : null;
        const parentLeft = item.isNested
          ? numberValue(parentTarget?.values?.left, 0)
          : item.originLeft;
        const parentTop = item.isNested
          ? numberValue(parentTarget?.values?.top, 0)
          : item.originTop;
        const hasOrigin = item.isNested || Boolean(item.target.wrapperBounds);
        const proposedLeft = Math.round(item.startLeft + dx);
        const proposedTop = Math.round(item.startTop + dy);
        const canvasLeft = hasOrigin ? parentLeft + proposedLeft : proposedLeft;
        const canvasTop = hasOrigin ? parentTop + proposedTop : proposedTop;
        const snap = computeSnap(
          canvasLeft,
          canvasTop,
          primaryBounds.width,
          primaryBounds.height,
          snapOthers,
          sizeCreative.canvas,
          undefined,
          userGuides,
        );
        deltaLeft = (hasOrigin ? snap.left - parentLeft : snap.left) - item.startLeft;
        deltaTop = (hasOrigin ? snap.top - parentTop : snap.top) - item.startTop;
        setSnapGuides({ vertical: snap.verticalGuides, horizontal: snap.horizontalGuides });
      } else {
        setSnapGuides({ vertical: [], horizontal: [] });
      }

      manipulationActive.current = true;
      if (ghostStart) setManipulationBounds({ ...ghostStart, left: ghostStart.left + deltaLeft, top: ghostStart.top + deltaTop });
      if (componentStartBounds) {
        useEditorStore.getState().updateSelectedComponentBounds({ ...componentStartBounds, left: componentStartBounds.left + deltaLeft, top: componentStartBounds.top + deltaTop }, { record: false, before: beforeDocument });
        return;
      }
      lastPositions = dragTargets.map((item) => {
        const left = Math.round(item.startLeft + deltaLeft);
        const top = Math.round(item.startTop + deltaTop);
        const previous=lastPositions.find(p=>p.targetId===item.targetId);
        if(previous?.left!==left)updateTargetValue(item.targetId, 'left', left, { record: false });
        if(previous?.top!==top)updateTargetValue(item.targetId, 'top', top, { record: false });
        return { targetId: item.targetId, left, top };
      });
    };

    const onMove = (event: PointerEvent) => {
      pendingMove=event;
      if(!moveFrame)moveFrame=requestAnimationFrame(()=>{moveFrame=0;const latest=pendingMove;pendingMove=null;if(latest)applyMove(latest);});
    };
    const onUp = () => {
      if(moveFrame)cancelAnimationFrame(moveFrame);
      if(pendingMove)applyMove(pendingMove);
      pendingMove=null;moveFrame=0;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapGuides({ vertical: [], horizontal: [] });
      manipulationActive.current = false;
      const afterDocument = useEditorStore.getState().creativeDocument;
      if (afterDocument !== beforeDocument) pushHistory([{ kind: 'creativeDocument', before: beforeDocument, after: afterDocument }]);
      else setManipulationBounds(null);
      if (getProductionStage()) setManipulationBounds(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, handleCanvasTargetClick, lockedLayerIds, pushHistory, scale, size, sizeCreative, updateTargetValue, userGuides, productionTargets]);

  const handleAlign = useCallback((mode: string) => {
    const guides = alignSelectedTarget(mode);
    if (!guides) return;
    setSnapGuides(guides);
    if (alignGuideTimerRef.current) window.clearTimeout(alignGuideTimerRef.current);
    alignGuideTimerRef.current = window.setTimeout(() => {
      setSnapGuides({ vertical: [], horizontal: [] });
      alignGuideTimerRef.current = null;
    }, 1500);
  }, [alignSelectedTarget]);

  const handleDistribute = useCallback((axis: 'h' | 'v') => {
    const guides = distributeSelectedTarget(axis);
    if (!guides) return;
    setSnapGuides(guides);
    if (alignGuideTimerRef.current) window.clearTimeout(alignGuideTimerRef.current);
    alignGuideTimerRef.current = window.setTimeout(() => {
      setSnapGuides({ vertical: [], horizontal: [] });
      alignGuideTimerRef.current = null;
    }, 1500);
  }, [distributeSelectedTarget]);

  const handleViewportBackgroundPointerDown = useCallback((event: React.PointerEvent) => {
    if (shellRef.current?.contains(event.target as Node)) return;
    clearCanvasSelection();
    setContextMenu(null);
  }, [clearCanvasSelection]);

  const startGroupResize = useCallback((event: React.PointerEvent, handle: string) => {
    if (!getProductionStage()) return;
    if (!selectedTarget?.bounds) return;
    const memberIds = selectedTarget.id === OFFERS_BLOCK_ID
      ? scaleTargetIdsForOfferGroup(offerCount, document, size, activeScopes)
      : filterManipulationTargetIds(selectedTarget.members || [], document, size, activeScopes);
    if(useEditorStore.getState().layoutRuleBlocksEdit(memberIds,['left','top','width','height']))return;
    const snapshots = buildGroupScaleSnapshots(document, size, memberIds, activeScopes);
    if (!snapshots.length) return;
    const beforeDocument = useEditorStore.getState().creativeDocument;
    const ghostStart = unionProductionBounds(productionTargets.filter(target => memberIds.includes(target.id)));

    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    const startBounds = {
      ...(selectedTarget.kind === 'multi'
        ? getGroupCanvasBounds(document, size, memberIds, activeScopes) || selectedTarget.bounds
        : selectedTarget.bounds),
    };
    const anchor = groupResizeAnchor(startBounds, handle);
    const startX = event.clientX;
    const startY = event.clientY;
    const layerSnapshots = snapshots.filter((item) => item.kind !== 'nested');
    const nestedSnapshots = snapshots.filter((item) => item.kind === 'nested');
    let lastScale = 1;
    let moved = false;

    const applyScale = (scaleFactor: number, record: boolean) => {
      lastScale = scaleFactor;
      if (selectedTarget.kind === 'component') {
        useEditorStore.getState().updateSelectedComponentBounds({
          left: anchor.x + (startBounds.left - anchor.x) * scaleFactor,
          top: anchor.y + (startBounds.top - anchor.y) * scaleFactor,
          width: startBounds.width * scaleFactor, height: startBounds.height * scaleFactor,
        }, { record: false, before: beforeDocument });
        return;
      }
      for (const snapshot of layerSnapshots) {
        for (const write of scaledFieldWritesForSnapshot(snapshot, scaleFactor, anchor)) {
          updateTargetValue(snapshot.targetId, write.field, write.value, { record });
        }
      }
      for (const snapshot of nestedSnapshots) {
        for (const write of scaledFieldWritesForSnapshot(snapshot, scaleFactor, anchor)) {
          updateTargetValue(snapshot.targetId, write.field, write.value, { record });
        }
      }
    };

    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      manipulationActive.current = true;
      if (ghostStart) setManipulationBounds(frameResizeWritesFromHandle(ghostStart, handle, dx, dy, { keepRatio: resizeMode === 'scale' || moveEvent.shiftKey }).next);
      if (selectedTarget.kind === 'component' && selectedTarget.resize === 'frame') {
        const { next } = frameResizeWritesFromHandle(startBounds, handle, dx, dy, { keepRatio: moveEvent.shiftKey });
        useEditorStore.getState().updateSelectedComponentBounds(next, { record: false, before: beforeDocument });
      } else {
        const nextScale = uniformScaleFromHandle(startBounds, handle, dx, dy);
        applyScale(nextScale, false);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) return;
      manipulationActive.current = false;
      const afterDocument = useEditorStore.getState().creativeDocument;
      if (afterDocument !== beforeDocument) pushHistory([{ kind: 'creativeDocument', before: beforeDocument, after: afterDocument }]);
      else setManipulationBounds(null);
      if (getProductionStage()) setManipulationBounds(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, offerCount, pushHistory, scale, selectedTarget, size, updateTargetValue, productionTargets, resizeMode]);

  const startTargetResize = useCallback((event: React.PointerEvent, handle: string) => {
    if (!getProductionStage()) return;
    if (selectedTarget?.kind !== 'component' && componentLinkForTarget(document, size, selectedTarget?.id, activeScopes)) return;
    if (selectedTarget?.kind === 'group' || selectedTarget?.kind === 'multi' || selectedTarget?.kind === 'component') {
      startGroupResize(event, handle);
      return;
    }
    const targetId = selectedTarget?.kind === 'component' && selectedTarget.frameTargetId
      ? selectedTarget.frameTargetId
      : selectedTarget?.members?.length === 1
      ? selectedTarget.members[0]
      : (selectedTarget?.id && !String(selectedTarget.id).startsWith('group:') ? selectedTarget.id : selectedTargetId);
    const target = targetId ? findCreativeTarget(document, size, targetId, activeScopes) : null;
    if (event.button !== 0 || !target) return;
    if(useEditorStore.getState().layoutRuleBlocksEdit([targetId],['left','top','width','height']))return;
    const beforeDocument = useEditorStore.getState().creativeDocument;
    const ghostStart = unionProductionBounds(productionTargets.filter(item => item.id === targetId));
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);

    const parentTarget = target.kind === 'nested'
      ? findCreativeTarget(document, size, target.parentLayerId, activeScopes)
      : null;
    const parentWidth = numberValue(parentTarget?.values?.width, numberValue(target.values?.width, 120));
    const parentHeight = numberValue(parentTarget?.values?.height, numberValue(target.values?.height, 40));
    const start = {
      left: numberValue(target.values?.left, 0),
      top: numberValue(target.values?.top, 0),
      width: dimensionValue(target.values?.width, parentWidth || 120, parentWidth || 120),
      height: dimensionValue(
        target.values?.height,
        numberValue(target.values?.fontSize, 28) * numberValue(target.values?.lineHeight, 1.15),
        parentHeight || 40,
      ),
    };
    const rawStart = {
      left: target.values?.left,
      top: target.values?.top,
      width: target.values?.width,
      height: target.values?.height,
      fontSize: target.values?.fontSize,
    };
    const scaleSnapshots = resizeMode === 'scale'
      ? buildGroupScaleSnapshots(document, size, [targetId], activeScopes)
      : [];
    const scaleSnapshot = scaleSnapshots.find((snapshot) => snapshot.targetId === targetId) || null;
    const rawStarts = new Map(scaleSnapshots.map((snapshot) => [snapshot.targetId, snapshot.raw]));
    rawStarts.set(targetId, rawStart);
    const startX = event.clientX;
    const startY = event.clientY;
    let last: Record<string, unknown> = { ...start, fontSize: numberValue(target.values?.fontSize, 0) };
    const lastByTarget = new Map([[targetId, last]]);
    const touchedFieldsByTarget = new Map();
    const rememberWrite = (writeTargetId: string, field: string, value: unknown) => {
      const targetLast = lastByTarget.get(writeTargetId) || {};
      targetLast[field] = value;
      lastByTarget.set(writeTargetId, targetLast);
      const touched = touchedFieldsByTarget.get(writeTargetId) || new Set<string>();
      touched.add(field);
      touchedFieldsByTarget.set(writeTargetId, touched);
    };

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      manipulationActive.current = true;
      if (ghostStart) setManipulationBounds(frameResizeWritesFromHandle(ghostStart, handle, dx, dy, { keepRatio: resizeMode === 'scale' || moveEvent.shiftKey }).next);
      if (resizeMode === 'scale' && scaleSnapshot) {
        const result = scaledResizeWritesFromHandle(scaleSnapshot, handle, dx, dy);
        const anchor = groupResizeAnchor(scaleSnapshot.bounds, handle);
        for (const snapshot of scaleSnapshots) {
          for (const write of scaledFieldWritesForSnapshot(snapshot, result.scale, anchor)) {
            rememberWrite(snapshot.targetId, write.field, write.value);
            updateTargetValue(snapshot.targetId, write.field, write.value, { record: false, preserveAnchor:true });
          }
        }
        return;
      }

      const result = frameResizeWritesFromHandle(start, handle, dx, dy, { keepRatio: moveEvent.shiftKey });
      for (const write of result.writes) {
        const field = write.field;
        last[field] = write.value;
        rememberWrite(targetId, field, write.value);
        updateTargetValue(targetId, field, write.value, { record: false, preserveAnchor:true });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      manipulationActive.current = false;
      const afterDocument = useEditorStore.getState().creativeDocument;
      if (afterDocument !== beforeDocument) pushHistory([{ kind: 'creativeDocument', before: beforeDocument, after: afterDocument }]);
      else setManipulationBounds(null);
      if (getProductionStage()) setManipulationBounds(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, pushHistory, resizeMode, scale, selectedTarget, selectedTargetId, size, startGroupResize, updateTargetValue, productionTargets]);

  const layers = [...(sizeCreative?.layers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const productionLayerIds = useMemo(() => (sizeCreative?.layers || []).map(layer => String(layer.id)), [sizeCreative]);

  if (!sizeCreative) return null;

  const selectionBox = (() => {
    if (!selectedTarget) return null;
    const ids = selectedTarget.members?.length ? selectedTarget.members : [selectedTarget.id];
    const bounds = manipulationBounds || unionProductionBounds(productionTargets.filter(target => ids.includes(target.id)));
    if (!bounds) return null;
    return { ...bounds, transform: 'none', label: selectedTarget.label,
      scope: selectedTarget.kind === 'group' ? 'group' : selectedTarget.coordinateScope || 'canvas',
      boundsMode: selectedTarget.boundsMode || '' };
  })();
  const selectionKind = selectionChromeKind(selectedTarget, selectionBox?.boundsMode || '');
  const offersBlockIsolated = isolatedGroupId === OFFERS_BLOCK_ID;
  const showSelectionChrome = Boolean(selectionBox);
  const selectionDragHandleTargetId = selectedTarget?.members?.length === 1
    ? selectedTarget.members[0]
    : (selectedTarget?.id && !String(selectedTarget.id).startsWith('group:') ? selectedTarget.id : selectedTargetId);
  const selectionResizeHandles = (() => {
    if (!showSelectionChrome) return [];
    return resizeHandlesForSelection(selectedTarget, selectedTargetId);
  })();
  const selectionFitCssClass = selectedTarget?.cssClass
    || (String(selectedTargetId || '').includes('::offer-subline') ? 'offer-subline' : '')
    || (String(selectedTargetId || '').includes('::offer-value') ? 'offer-value' : '')
    || (isHeadlineLayer(selectedTarget?.layer) ? HEADLINE_CSS_CLASS : '');
  const selectionFitClipped = productionTargetClipped(fitClipped, selectedTarget?.id || '', selectionFitCssClass);
  const showOffersBlock = Number(offerCount) >= 2;
  const distributeCount = selectedTarget?.id === OFFERS_BLOCK_ID
    ? offerBlockLayerIds(offerCount).length
    : selectedTarget?.kind === 'multi' || selectedTarget?.kind === 'group'
      ? selectedTarget.members.filter((targetId) => !String(targetId).includes('::')).length
      : 0;
  const canDistribute = distributeCount >= 2;

  const labelForMenuTarget = (targetId: string) => {
    if (targetId === OFFERS_BLOCK_ID) return 'offers block';
    const childMatch = targetId.match(/^offer-slot-(\d)::(.+)$/);
    if (childMatch) {
      const childLabel = childMatch[2] === 'offer-value'
        ? 'value'
        : childMatch[2] === 'offer-subline'
          ? 'subline'
          : childMatch[2].replace(/-/g, ' ');
      return `Offer ${childMatch[1]} ${childLabel}`;
    }
    const slotMatch = targetId.match(/^offer-slot-(\d)/);
    if (slotMatch) return `Offer Slot ${slotMatch[1]}`;
    const plusMatch = targetId.match(/^plus-(\d)/);
    if (plusMatch) return `plus ${plusMatch[1]}`;
    const target = findCreativeTarget(document, size, targetId, activeScopes);
    return target?.label || layerById.get(targetId)?.label || targetId;
  };

  const menuChoicesForTarget = (targetId: string) => {
    const hitPath = selectionHierarchy(targetId, offerCount, document, size, activeScopes);
    const orderedPath = [...hitPath].reverse();
    const choices = orderedPath.map((pathId) => ({
      id: pathId,
      label: `Select ${labelForMenuTarget(pathId)}`,
      select: () => {
        if (pathId === OFFERS_BLOCK_ID) selectOffersBlock();
        else selectTarget(pathId);
      },
    }));
    const slotId = hitPath.find((pathId) => pathId.startsWith('offer-slot-') && !pathId.includes('::'));
    if (slotId) {
      for (const childKey of ['offer-value', 'offer-subline']) {
        const childId = targetIdForLayerChild(slotId, childKey);
        if (choices.some((choice) => choice.id === childId)) continue;
        choices.push({
          id: childId,
          label: `Select ${labelForMenuTarget(childId)}`,
          select: () => selectTarget(childId),
        });
      }
    }
    return choices.length ? choices : [{
      id: targetId,
      label: `Select ${labelForMenuTarget(targetId)}`,
      select: () => selectTarget(targetId),
    }];
  };

  const openLayerMenu = (event: React.MouseEvent, layer: Record<string, unknown>, targetId = layer.id) => {
    event.preventDefault();
    event.stopPropagation();
    if(!useEditorStore.getState().selectedTargetIds.includes(targetId)){if (targetId === OFFERS_BLOCK_ID) selectOffersBlock();else selectTarget(targetId);}
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      layerId: layer.id,
      targetId: String(targetId),
      layerLabel: layer.label || layer.id,
      editField: feedFieldForEditableTarget(layer, String(targetId)),
      locked: lockedLayerIds.has(String(layer.id)),
      hidden: hiddenLayerIds.has(String(layer.id)),
      choices: menuChoicesForTarget(String(targetId)).slice(0, 4),
    });
  };

  const isolationDepth = isolationPath?.length || 0;
  const stageClassName = [
    'stage',
    'page-content',
    ...activeScopes,
    isolationDepth ? 'is-editing-inside' : '',
    isolationDepth ? `is-editing-depth-${isolationDepth}` : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="preview-pane">
      <div className="preview-toolbar">
        <div className="preview-toolbar-left">
          <PlayheadReadout seconds={seconds} percent={percent} />
          <select title="Dynamic text refits when copy changes. Fixed text as outlines bakes the current copy into SVG shapes." aria-label="Preview rendition" value={previewRenderMode} onChange={event => setPreviewRenderMode(event.target.value)}>
            <option value="font">Dynamic text</option>
            <option value="outline">Fixed text as outlines</option>
          </select>

          <ComponentNavigation />
          {offersBlockIsolated ? (
            <div className="isolation-crumb" aria-label="Offers editing path">
              <button type="button" className="isolation-crumb-link" onClick={() => selectOffersBlock()}>
                Offers group
              </button>
              <span className="isolation-crumb-sep">/</span>
              <span className="isolation-crumb-current">{selectedTarget?.label || 'Item'}</span>
              <button
                type="button"
                className="isolation-crumb-exit"
                data-tip="Exit isolation (Esc)"
                aria-label="Exit offers isolation"
                onClick={() => exitGroupIsolation()}
              >
                Esc
              </button>
            </div>
          ) : null}
          <div className="preview-status" data-tone={statusTone} title={statusMessage}>{statusMessage}</div>
          {hiddenLayerIds.size > 0 && <span className="preview-status" title="Temporary editor visibility; exported creative includes these layers">Hidden in editor: {hiddenLayerIds.size}</span>}
        </div>
        <AlignControls
          disabled={!selectedTarget}
          canDistribute={canDistribute}
          onAlign={handleAlign}
          onDistribute={handleDistribute}
        />
        <div className="zoom-controls" aria-label="Canvas zoom">
          <button type="button" data-tip="Zoom out" aria-label="Zoom out" onClick={() => stepCanvasZoom(-1)}>
            <EditorIcon name="zoomOut" />
          </button>
          <button type="button" data-tip="Fit banner to viewport" aria-label="Fit to viewport" aria-pressed={canvasZoom === 'auto'} onClick={() => setCanvasZoom('auto')}>
            <EditorIcon name="fit" />
          </button>
          <button type="button" data-tip="100% zoom" aria-label="100% zoom" aria-pressed={canvasZoom === 1} onClick={() => setCanvasZoom(1)}>100%</button>
          <button type="button" data-tip="200% zoom" aria-label="200% zoom" aria-pressed={canvasZoom === 2} onClick={() => setCanvasZoom(2)}>200%</button>
          <button type="button" data-tip="Zoom in" aria-label="Zoom in" onClick={() => stepCanvasZoom(1)}>
            <EditorIcon name="zoomIn" />
          </button>
          <span className="zoom-readout">{zoomLabel(canvasZoom)}</span>
        </div>
      </div>
      {pendingLayoutEdit?.size===size&&<button type="button" className="layout-draft-resume" title="Your changes are held in a draft until you Apply or Cancel" onClick={()=>{const ids=pendingLayoutEdit.rule.targets.filter(t=>t.size===size).map(t=>t.targetId);useEditorStore.getState().setCanvasSelection(ids[0],ids);useEditorStore.setState({selectedLayoutRuleId:pendingLayoutEdit.rule.id,layoutRulesOpen:true});}}>Resume layout edit · not applied</button>}
      <div className="preview-viewport" onPointerDownCapture={event=>{if(!(event.target as Element).closest('.layout-area-outline'))useEditorStore.getState().selectLayoutRule(null);}}>
        <ViewportRulersFrame
          canvas={sizeCreative.canvas}
          scale={scale}
          guides={userGuides}
          onGuidesChange={setUserGuides}
          stageShellRef={shellRef}
          viewportRef={viewportRef}
        >
          <div
            className="preview-viewport-inner"
            onPointerDown={handleViewportBackgroundPointerDown}
          >
            <div className="stage-shell" ref={shellRef} style={shellStyle}>
              <div
                ref={stageRef}
                className={stageClassName}
                data-editor-stage="true"
                data-size={size}
                data-offer-plus-layout={resolveOfferPlusLayout(document)}
                style={{ width: sizeCreative.canvas.width, height: sizeCreative.canvas.height, transform: `scale(${scale})` }}
                onPointerDown={() => setContextMenu(null)}
              >
            <ProductionCreativeStage
              document={layoutPreview?.size===size?layoutPreview.document:document} row={layoutRow} size={size} percent={percent} renderMode={previewRenderMode}
              layerIds={productionLayerIds} hiddenLayerIds={hiddenLayerIds}
              onTargets={receiveProductionTargets}
              onPointerDown={startSelectionDrag}
              onDoubleClick={drillIntoCanvasTarget}
              onContextMenu={(event, targetId) => {
                const layer = layerById.get(targetId.split('::')[0]);
                if (layer) openLayerMenu(event, layer, targetId);
              }}
            />
            <PlacementPreviewOverlay targets={productionTargets} size={size} scale={scale}/>
            <LayoutAreaOverlay document={document} size={size} scale={scale}/>
            <RuleConnectors scaledParent width={sizeCreative.canvas.width} height={sizeCreative.canvas.height} zoom={scale} diagnostics={layoutDiagnostics.filter(item=>item.size===size&&item.targetId===(selectedTarget?.id||selectedTargetId))} selectedRuleId={selectedLayoutRuleId} onSelectRule={id=>useEditorStore.getState().selectLayoutRule(id)} onGapChange={(id,pixels)=>{
              const diagnostic=layoutDiagnostics.find(item=>item.id===id&&item.size===size&&item.targetId===(selectedTarget?.id||selectedTargetId)&&item.status==='active');
              if(!diagnostic)return;
              const next={...document,layoutRules:document.layoutRules.map(rule=>rule.id===id?{...rule,[diagnostic.usingFallback?'fallbackGap':'gap']:pixels/(diagnostic.gapScale||1)}:rule)};
              validateLayoutRules(next);useEditorStore.getState().applyCreativeOwnershipDocument(next,'Updated responsive gap');
            }}/>

            {showSelectionChrome ? (
              <div
                className={`selection-box selection-scope-${selectionBox.scope} selection-kind-${selectionKind}`}
                data-bounds-mode={selectionBox.boundsMode}
                data-selection-kind={selectionKind}
                data-manipulation-preview={manipulationBounds ? "true" : undefined}
                style={{
                  left: selectionBox.left,
                  top: selectionBox.top,
                  width: selectionBox.width,
                  height: selectionBox.height,
                }}
                aria-label={`Selected ${selectionBox.label}`}
                onPointerDown={(event) => {
                  if (!selectionDragHandleTargetId) return;
                  startSelectionDrag(event, selectionDragHandleTargetId);
                }}
              >
                <span className="selection-label">{selectedTarget?.label || selectionBox.label}</span>
                {selectionFitClipped ? (
                  <span
                    className="selection-label selection-label-clipped"
                    title="Clipped: text still overflows after fitting (hover the red dot on the copy for detail)"
                    aria-label="Clipped"
                  />
                ) : null}
                {selectionResizeHandles.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={`resize-handle resize-${handle}`}
                    aria-label={`Resize ${handle}`}
                    onPointerDown={(event) => startTargetResize(event, handle)}
                  />
                ))}
              </div>
            ) : null}
            <AlignmentGuides vertical={snapGuides.vertical} horizontal={snapGuides.horizontal} />
              </div>
            </div>
          </div>
        </ViewportRulersFrame>
      </div>
      <CreativeTransferLauncher/>
      {contextMenu && <CreativeContextMenu menu={contextMenu} onClose={()=>setContextMenu(null)}/>}
    </section>
  );
}
