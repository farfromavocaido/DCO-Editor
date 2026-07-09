// @ts-nocheck
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { compileAnimationClips, frameAtPercent } from '@/lib/creative-compiler';
import { compileHeadlineKeyframes, headlineAct4DisplayText } from '@/lib/headline-motion';
import { cssName, cssValue, structuredRuleCss } from '@/lib/creative-css';
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
import { currentSizeCreative, findCreativeTarget, HEADLINE_CSS_CLASS, isHeadlineLayer, targetIdForLayerChild } from '@/lib/creative-model';
import {
  deriveSelectedTarget,
  filterManipulationTargetIds,
  getGroupCanvasBounds,
  OFFERS_BLOCK_ID,
  linkedTargetIdsForSelection,
  offerBlockLayerIds,
  selectionHierarchy,
  targetMatchesSelection,
} from '@/lib/selection-groups';
import { zoomLabel, zoomScale } from '@/lib/canvas-zoom';
import { assetUrl, fieldValue, previewBackgroundSrc, wrapOfferValueSymbols } from '@/lib/preview-utils';
import { resizeHandlesForSelection, selectionChromeKind } from '@/lib/selection-chrome';
import { activeFrameScope, beatsForScopes } from '@/lib/timing-profiles';
import { activeScopesFromControls } from '@/lib/feed-model';
import {
  offerTargetAtPoint as resolveOfferTargetAtPoint,
  shouldBypassOfferCapture,
} from '@/lib/offer-hit-testing';
import { useStageResize } from '@/hooks/useStageResize';
import { EditorIcon } from '@/components/EditorIcon';
import { PlayheadReadout } from '@/components/PlayheadReadout';
import { AlignControls, AlignmentGuides, ViewportRulersFrame } from '@/components/CanvasWorkspace';
import { useEditorStore } from '@/store/editor-store';
const renderLayerRule = (layer: Record<string, unknown>) => {
  if (isHeadlineLayer(layer)) return '';
  const base = layer.base || {};
  const cssClass = base.cssClass || layer.id;
  const decl = Object.entries(base)
    .filter(([key]) => key !== 'cssClass')
    .map(([key, value]) => {
      const cssKey = key === 'fontSize' ? 'font-size' : cssName(key);
      return `      ${cssKey}: ${cssValue(key, value)};`;
    });
  decl.push('      position: absolute;');
  decl.push('      visibility: inherit;');
  return `    .${cssClass} {\n${decl.join('\n')}\n    }`;
};

const renderCreativeCss = (sizeCreative: Record<string, unknown>) => [
  '    p, h1, h2, h3 { margin: 0px; }',
  sizeCreative.manualCss || '',
  ...(sizeCreative.layers || []).map(renderLayerRule),
  structuredRuleCss(sizeCreative),
  '    .stage-element, .stage-static { cursor: move; }',
].join('\n\n');

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

const translateFromTransform = (transform = '') => {
  const match = String(transform).match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/i);
  if (!match) return { x: 0, y: 0 };
  return {
    x: Number(match[1]) || 0,
    y: Number(match[2]) || 0,
  };
};

export function PreviewPane() {
  const [contextMenu, setContextMenu] = useState(null);
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
  const selectedFeedRow = useEditorStore((s) => s.selectedFeedRow);
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
  const applyPreviewTextFitting = useEditorStore((s) => s.applyPreviewTextFitting);
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
  const activeScopes = useMemo(() => activeScopesFromControls({
    offerCount,
    tcMode,
    ctaShape,
    includeRoundelFrame,
    frameCount,
    roundelMode,
  }), [ctaShape, frameCount, includeRoundelFrame, offerCount, roundelMode, tcMode]);
  const activeOfferBlockIds = useMemo(() => new Set(offerBlockLayerIds(offerCount)), [offerCount]);
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
  const activeBeats = useMemo(() => beatsForScopes(document, activeScopes), [activeScopes, document]);
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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      applyPreviewTextFitting(stage);
    });
    // Refit once Museo lands so the preview never keeps fallback-font metrics
    // (mirrors scheduleFontRefit in the exported runtime).
    window.document.fonts?.ready?.then(() => {
      if (cancelled || !stageRef.current) return;
      applyPreviewTextFitting(stageRef.current);
    }).catch(() => {});
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [activeScopes, applyPreviewTextFitting, document, offerCount, row, size]);

  const startSelectionDrag = useCallback((event: React.PointerEvent, deepestTargetId: string) => {
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
    const dragTargets = dragTargetIds
      .map((targetId) => {
        const target = findCreativeTarget(state.creativeDocument, size, targetId, activeScopes);
        if (!target) return null;
        return {
          targetId,
          target,
          startLeft: numberValue(target.values?.left, 0),
          startTop: numberValue(target.values?.top, 0),
          isNested: target.kind === 'nested',
          parentLayerId: target.parentLayerId || '',
        };
      })
      .filter(Boolean);
    if (!dragTargets.length) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const primary = dragTargets[0];
    const primaryBounds = getTargetCanvasBounds(document, size, primary.targetId, activeScopes);
    const snapOthers = collectSnapBounds(document, size, activeScopes, dragTargetIds);
    let lastPositions = dragTargets.map((item) => ({ targetId: item.targetId, left: item.startLeft, top: item.startTop }));

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      let deltaLeft = Math.round(dx);
      let deltaTop = Math.round(dy);

      if (primaryBounds && sizeCreative?.canvas && dragTargets.length === 1) {
        const item = dragTargets[0];
        const parentTarget = item.isNested
          ? findCreativeTarget(document, size, item.parentLayerId, activeScopes)
          : null;
        const parentLeft = numberValue(parentTarget?.values?.left, 0);
        const parentTop = numberValue(parentTarget?.values?.top, 0);
        const proposedLeft = Math.round(item.startLeft + dx);
        const proposedTop = Math.round(item.startTop + dy);
        const canvasLeft = item.isNested ? parentLeft + proposedLeft : proposedLeft;
        const canvasTop = item.isNested ? parentTop + proposedTop : proposedTop;
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
        deltaLeft = (item.isNested ? snap.left - parentLeft : snap.left) - item.startLeft;
        deltaTop = (item.isNested ? snap.top - parentTop : snap.top) - item.startTop;
        setSnapGuides({ vertical: snap.verticalGuides, horizontal: snap.horizontalGuides });
      } else {
        setSnapGuides({ vertical: [], horizontal: [] });
      }

      lastPositions = dragTargets.map((item) => {
        const left = Math.round(item.startLeft + deltaLeft);
        const top = Math.round(item.startTop + deltaTop);
        updateTargetValue(item.targetId, 'left', left, { record: false });
        updateTargetValue(item.targetId, 'top', top, { record: false });
        return { targetId: item.targetId, left, top };
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSnapGuides({ vertical: [], horizontal: [] });
      const history = [];
      dragTargets.forEach((item, index) => {
        const last = lastPositions[index];
        history.push(
          { kind: 'creativeTarget', size, targetId: item.targetId, activeScopes, field: 'left', before: item.startLeft, after: last.left },
          { kind: 'creativeTarget', size, targetId: item.targetId, activeScopes, field: 'top', before: item.startTop, after: last.top },
        );
      });
      pushHistory(history);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, handleCanvasTargetClick, lockedLayerIds, pushHistory, scale, size, sizeCreative, updateTargetValue, userGuides]);

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
    if (!selectedTarget?.bounds) return;
    const memberIds = selectedTarget.kind === 'group'
      ? scaleTargetIdsForOfferGroup(offerCount, document, size, activeScopes)
      : filterManipulationTargetIds(selectedTarget.members || [], document, size, activeScopes);
    const snapshots = buildGroupScaleSnapshots(document, size, memberIds, activeScopes);
    if (!snapshots.length) return;

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
      const nextScale = uniformScaleFromHandle(startBounds, handle, dx, dy);
      applyScale(nextScale, false);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) return;
      const history = [];
      for (const snapshot of snapshots) {
        for (const write of scaledFieldWritesForSnapshot(snapshot, lastScale, anchor)) {
          history.push({
            kind: 'creativeTarget',
            size,
            targetId: snapshot.targetId,
            activeScopes,
            field: write.field,
            before: snapshot.raw[write.field],
            after: write.value,
          });
        }
      }
      pushHistory(history);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, offerCount, pushHistory, scale, selectedTarget, size, updateTargetValue]);

  const startTargetResize = useCallback((event: React.PointerEvent, handle: string) => {
    if (selectedTarget?.kind === 'group' || selectedTarget?.kind === 'multi') {
      startGroupResize(event, handle);
      return;
    }
    const targetId = selectedTarget?.members?.length === 1
      ? selectedTarget.members[0]
      : (selectedTarget?.id && !String(selectedTarget.id).startsWith('group:') ? selectedTarget.id : selectedTargetId);
    const target = targetId ? findCreativeTarget(document, size, targetId, activeScopes) : null;
    if (event.button !== 0 || !target) return;
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
      if (resizeMode === 'scale' && scaleSnapshot) {
        const result = scaledResizeWritesFromHandle(scaleSnapshot, handle, dx, dy);
        const anchor = groupResizeAnchor(scaleSnapshot.bounds, handle);
        for (const snapshot of scaleSnapshots) {
          for (const write of scaledFieldWritesForSnapshot(snapshot, result.scale, anchor)) {
            rememberWrite(snapshot.targetId, write.field, write.value);
            updateTargetValue(snapshot.targetId, write.field, write.value, { record: false });
          }
        }
        return;
      }

      const result = frameResizeWritesFromHandle(start, handle, dx, dy, { keepRatio: moveEvent.shiftKey });
      for (const write of result.writes) {
        const field = write.field;
        last[field] = write.value;
        rememberWrite(targetId, field, write.value);
        updateTargetValue(targetId, field, write.value, { record: false });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const history = [];
      for (const [historyTargetId, touchedFields] of touchedFieldsByTarget) {
        const beforeValues = rawStarts.get(historyTargetId) || {};
        const afterValues = lastByTarget.get(historyTargetId) || {};
        for (const field of touchedFields) {
          history.push({
            kind: 'creativeTarget',
            size,
            targetId: historyTargetId,
            activeScopes,
            field,
            before: beforeValues[field],
            after: afterValues[field],
          });
        }
      }
      pushHistory(history);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [activeScopes, document, pushHistory, resizeMode, scale, selectedTarget, selectedTargetId, size, startGroupResize, updateTargetValue]);

  const selectionClassForTarget = useCallback((targetId: string) => {
    if (targetMatchesSelection(targetId, selectedTargetId, selectedTargetIds, offerCount, isolatedGroupId)) return 'is-selected';
    if (isolatedGroupId === OFFERS_BLOCK_ID) return '';
    if (linkedTargetIdsForSelection(selectedTargetId, selectedTargetIds, offerCount, isolatedGroupId).includes(targetId)) return 'is-linked';
    return '';
  }, [isolatedGroupId, offerCount, selectedTargetId, selectedTargetIds]);

  const targetOutsideIsolation = useCallback((targetId: string) => {
    if (!isolationPath?.length) return false;
    const path = selectionHierarchy(targetId, offerCount, document, size, activeScopes);
    return !isolationPath.every((id, index) => path[index] === id);
  }, [activeScopes, document, isolationPath, offerCount, size]);

  const layerClass = (layer: Record<string, unknown>, targetId = layer.id) => [
    'stage-element',
    isHeadlineLayer(layer) ? HEADLINE_CSS_CLASS : (layer.base?.cssClass || layer.id),
    lockedLayerIds.has(String(layer.id)) ? 'is-locked' : '',
    selectionClassForTarget(String(targetId)),
    targetOutsideIsolation(String(targetId)) ? 'is-outside-isolation' : '',
  ].filter(Boolean).join(' ');

  const layers = [...(sizeCreative?.layers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const renderedLayers = layers.filter((layer) => !hiddenLayerIds.has(String(layer.id)));
  const offerLayers = renderedLayers.filter((layer) => layer.id.startsWith('offer-slot-') && activeOfferBlockIds.has(layer.id));
  const activeOfferLayers = renderedLayers.filter((layer) => (
    activeOfferBlockIds.has(layer.id)
    && (layer.id.startsWith('offer-slot-') || layer.id.startsWith('plus-'))
  ));
  const nonOfferLayers = renderedLayers.filter((layer) => (
    !layer.id.startsWith('offer-slot-')
    && !layer.id.startsWith('plus-')
  ));

  const offerTargetAtPoint = useCallback((clientX: number, clientY: number) => (
    resolveOfferTargetAtPoint({
      stage: stageRef.current,
      activeOfferLayers,
      clientX,
      clientY,
    })
  ), [activeOfferLayers]);

  const handleStagePointerDownCapture = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (shouldBypassOfferCapture(target) || target?.closest('.offers-block-group')) return;
    const offerTargetId = offerTargetAtPoint(event.clientX, event.clientY);
    if (offerTargetId) startSelectionDrag(event, offerTargetId);
  }, [offerTargetAtPoint, startSelectionDrag]);

  const handleStageDoubleClickCapture = useCallback((event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (shouldBypassOfferCapture(target) || target?.closest('.offers-block-group')) return;
    const offerTargetId = offerTargetAtPoint(event.clientX, event.clientY);
    if (!offerTargetId) return;
    event.preventDefault();
    event.stopPropagation();
    drillIntoCanvasTarget(offerTargetId);
  }, [drillIntoCanvasTarget, offerTargetAtPoint]);

  if (!sizeCreative) return null;

  const isolationOpacityForTarget = (targetId: string) => {
    if (!targetOutsideIsolation(targetId)) return 1;
    const selectionClass = selectionClassForTarget(targetId);
    return selectionClass === 'is-selected' || selectionClass === 'is-linked' ? 1 : 0.28;
  };

  const targetStateClass = (targetId: string) => [
    selectionClassForTarget(targetId),
    targetOutsideIsolation(targetId) ? 'is-outside-isolation' : '',
  ].filter(Boolean).join(' ');

  const frameStyle = (layer: Record<string, unknown>, targetId = layer.id) => {
    const profile = activeFrameScope(activeScopes);
    const keyframes = layer.id?.startsWith('headline-act')
      ? compileHeadlineKeyframes(layer, sizeCreative?.layers || [], row, profile, activeBeats)
      : compileAnimationClips(layer.clips || [], activeBeats);
    const frame = frameAtPercent(keyframes, percent);
    const transform = [
      `translate3d(${frame.translate[0]}px, ${frame.translate[1]}px, 0px)`,
      frame.scale === 1 ? '' : `scale3d(${frame.scale}, ${frame.scale}, 1)`,
    ].filter(Boolean).join(' ');
    return {
      transform,
      opacity: frame.opacity * isolationOpacityForTarget(String(targetId)),
      pointerEvents: frame.opacity <= 0.03 ? 'none' : 'auto',
    };
  };

  const termsFrameStyle = (id: string) => {
    const layer = layerById.get(id);
    return layer ? frameStyle(layer, id) : undefined;
  };
  const visibleTermsFrameStyle = (id: string) => (
    hiddenLayerIds.has(id) ? { display: 'none' } : termsFrameStyle(id)
  );

  const selectionBox = (() => {
    if (!selectedTarget?.bounds && selectedTarget?.kind !== 'nested' && !selectedTarget?.values) return null;
    if (selectedTarget.bounds) {
      const layerForBounds = layerById.get(selectedTarget.parentLayerId || selectedTarget.id);
      const frame = layerForBounds ? frameStyle(layerForBounds, selectedTarget.parentLayerId || selectedTarget.id) : { transform: 'none' };
      return {
        left: selectedTarget.bounds.left,
        top: selectedTarget.bounds.top,
        width: selectedTarget.bounds.width,
        height: selectedTarget.bounds.height,
        transform: frame.transform,
        label: selectedTarget.label,
        scope: selectedTarget.kind === 'group' ? 'group' : selectedTarget.coordinateScope || 'canvas',
        boundsMode: selectedTarget.boundsMode || '',
      };
    }
    const parentTarget = selectedTarget.kind === 'nested'
      ? findCreativeTarget(document, size, selectedTarget.parentLayerId, activeScopes)
      : null;
    const parentLayer = selectedTarget.kind === 'nested'
      ? layerById.get(selectedTarget.parentLayerId)
      : layerById.get(selectedTarget.id);
    const parentWidth = numberValue(parentTarget?.values?.width, numberValue(selectedTarget.values?.width, 80));
    const parentHeight = numberValue(parentTarget?.values?.height, numberValue(selectedTarget.values?.height, 40));
    const fontSize = numberValue(selectedTarget.values?.fontSize, 22);
    const lineHeight = numberValue(selectedTarget.values?.lineHeight, 1.15);
    const childLeft = numberValue(selectedTarget.values?.left, 0);
    const childTop = numberValue(selectedTarget.values?.top, 0);
    const width = dimensionValue(selectedTarget.values?.width, selectedTarget.kind === 'nested' ? parentWidth : 80, parentWidth || 80);
    const height = dimensionValue(selectedTarget.values?.height, fontSize * lineHeight, parentHeight || 40);
    const left = selectedTarget.kind === 'nested'
      ? numberValue(parentTarget?.values?.left, 0) + childLeft
      : childLeft;
    const top = selectedTarget.kind === 'nested'
      ? numberValue(parentTarget?.values?.top, 0) + childTop
      : childTop;
    const frame = parentLayer ? frameStyle(parentLayer) : { transform: 'none' };
    return {
      left,
      top,
      width: Math.max(4, width),
      height: Math.max(4, height),
      transform: frame.transform,
      label: selectedTarget.label,
      scope: selectedTarget.coordinateScope,
      boundsMode: selectedTarget.boundsMode || '',
    };
  })();
  const selectionKind = selectionChromeKind(selectedTarget, selectionBox?.boundsMode || '');
  const showRestingSelectionBox = Boolean(selectionBox?.transform && selectionBox.transform !== 'none');
  const motionGuide = (() => {
    if (!showRestingSelectionBox || !selectionBox) return null;
    const translate = translateFromTransform(selectionBox.transform);
    if (Math.abs(translate.x) < 0.5 && Math.abs(translate.y) < 0.5) return null;
    const rest = {
      x: selectionBox.left + selectionBox.width / 2,
      y: selectionBox.top + selectionBox.height / 2,
    };
    const current = {
      x: rest.x + translate.x,
      y: rest.y + translate.y,
    };
    const pad = 14;
    const left = Math.min(rest.x, current.x) - pad;
    const top = Math.min(rest.y, current.y) - pad;
    return {
      left,
      top,
      width: Math.max(2, Math.abs(current.x - rest.x)) + pad * 2,
      height: Math.max(2, Math.abs(current.y - rest.y)) + pad * 2,
      restX: rest.x - left,
      restY: rest.y - top,
      currentX: current.x - left,
      currentY: current.y - top,
    };
  })();

  const renderOfferSlot = (layer: Record<string, unknown>) => {
    const index = layer.id.match(/(\d)$/)?.[1] || '1';
    const valueId = targetIdForLayerChild(layer.id, 'offer-value');
    const sublineId = targetIdForLayerChild(layer.id, 'offer-subline');
    const slotOutsideIsolation = targetOutsideIsolation(layer.id);
    return (
      <div
        key={layer.id}
        className={layerClass(layer)}
        data-gwd-group="OfferSlot"
        data-offer-index={index}
        id={`offer${index}`}
        style={frameStyle(layer, layer.id)}
        onPointerDown={(event) => startSelectionDrag(event, layer.id)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          drillIntoCanvasTarget(layer.id);
        }}
        onContextMenu={(event) => openLayerMenu(event, layer, layer.id)}
      >
        <p
          className={`gwd-grp-offer offer-value ${selectionClassForTarget(valueId)} ${targetOutsideIsolation(valueId) ? 'is-outside-isolation' : ''}`}
          style={{ opacity: slotOutsideIsolation ? 1 : isolationOpacityForTarget(valueId) }}
          dangerouslySetInnerHTML={{ __html: wrapOfferValueSymbols(row[`offer${index}_value_text`]) }}
          onPointerDown={(event) => startSelectionDrag(event, valueId)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            drillIntoCanvasTarget(valueId);
          }}
          onContextMenu={(event) => openLayerMenu(event, layer, valueId)}
        />
        <p
          className={`gwd-grp-offer offer-subline ${selectionClassForTarget(sublineId)} ${targetOutsideIsolation(sublineId) ? 'is-outside-isolation' : ''}`}
          style={{ opacity: slotOutsideIsolation ? 1 : isolationOpacityForTarget(sublineId) }}
          onPointerDown={(event) => startSelectionDrag(event, sublineId)}
          onDoubleClick={(event) => {
            event.stopPropagation();
            drillIntoCanvasTarget(sublineId);
          }}
          onContextMenu={(event) => openLayerMenu(event, layer, sublineId)}
        >
          {fieldValue(row[`offer${index}_sub_text`])}
        </p>
      </div>
    );
  };

  const renderLayerNode = (layer: Record<string, unknown>) => {
    if (['terms-prices', 'unit-rate-prices', 'terms-solo'].includes(layer.id)) return null;
    if (layer.id.startsWith('offer-slot-')) return renderOfferSlot(layer);

    if (layer.kind === 'shape') {
      return (
        <div
          key={layer.id}
          className={layerClass(layer)}
          id={layer.id}
          style={frameStyle(layer, layer.id)}
          onPointerDown={(event) => startSelectionDrag(event, layer.id)}
          onContextMenu={(event) => openLayerMenu(event, layer)}
        />
      );
    }

    if (layer.kind === 'image') {
      return (
        <img
          key={layer.id}
          alt=""
          draggable={false}
          className={layerClass(layer)}
          src={assetUrl(layer.asset)}
          style={frameStyle(layer, layer.id)}
          onPointerDown={(event) => startSelectionDrag(event, layer.id)}
          onContextMenu={(event) => openLayerMenu(event, layer)}
        />
      );
    }

    const isHeadline = layer.id.startsWith('headline-');
    const Tag = layer.id === 'cta' ? 'div' : 'p';
    const className = [
      layerClass(layer),
      isHeadline ? 'sse-text sse-text-bold' : '',
      /terms|unit-rate/.test(layer.id) ? 'sse-text sse-bottom-line' : '',
    ].filter(Boolean).join(' ');
    const boundField = layer.binding?.field;
    const text = boundField ? fieldValue(row[boundField])
      : layer.id === 'headline-act1' ? fieldValue(row.heading1_text)
        : layer.id === 'headline-act2' ? fieldValue(row.heading2_text)
          : layer.id === 'headline-act3' ? fieldValue(row.heading3_text)
            : layer.id === 'headline-act4' ? headlineAct4DisplayText(row, includeRoundelFrame)
            : layer.id === 'cta' ? fieldValue(row.cta_text)
              : layer.id.startsWith('plus-') ? '+'
                : '';
    return (
      <Tag
        key={layer.id}
        className={className}
        id={layer.id}
        style={frameStyle(layer, layer.id)}
        onPointerDown={(event) => startSelectionDrag(event, layer.id)}
        onContextMenu={(event) => openLayerMenu(event, layer)}
      >
        {text}
      </Tag>
    );
  };

  const offersBlockSelected = selectedTargetId === OFFERS_BLOCK_ID && isolatedGroupId !== OFFERS_BLOCK_ID && !selectionBox;
  const offersBlockIsolated = isolatedGroupId === OFFERS_BLOCK_ID;
  const showSelectionChrome = Boolean(selectionBox);
  const selectionDragHandleTargetId = selectedTarget?.members?.length === 1
    ? selectedTarget.members[0]
    : (selectedTarget?.id && !String(selectedTarget.id).startsWith('group:') ? selectedTarget.id : selectedTargetId);
  const selectionResizeHandles = (() => {
    if (!showSelectionChrome) return [];
    return resizeHandlesForSelection(selectedTarget, selectedTargetId);
  })();
  const showOffersBlock = Number(offerCount) >= 2;
  const distributeCount = selectedTarget?.kind === 'group'
    ? offerBlockLayerIds(offerCount).length
    : selectedTarget?.kind === 'multi'
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
    if (targetId === OFFERS_BLOCK_ID) selectOffersBlock();
    else selectTarget(targetId);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      layerId: layer.id,
      layerLabel: layer.label || layer.id,
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
      <div className="preview-viewport">
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
                style={{ width: sizeCreative.canvas.width, height: sizeCreative.canvas.height, transform: `scale(${scale})` }}
                onPointerDownCapture={handleStagePointerDownCapture}
                onDoubleClickCapture={handleStageDoubleClickCapture}
                onPointerDown={() => setContextMenu(null)}
              >
            <style className="layout-style">{renderCreativeCss(sizeCreative)}</style>
            <img
              alt=""
              draggable={false}
              className="stage-element bg-image"
              src={previewBackgroundSrc(row, size, sizeCreative.assets.background)}
              style={{ transform: 'none', opacity: 1 }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            />

            {nonOfferLayers.map((layer) => renderLayerNode(layer))}
            {showOffersBlock ? (
              <div
                className={`offers-block-group ${offersBlockSelected ? 'is-selected' : ''} ${offersBlockIsolated ? 'is-isolated' : ''}`}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    selectOffersBlock();
                  }
                }}
              >
                {activeOfferLayers.map((layer) => (
                  layer.id.startsWith('offer-slot-')
                    ? renderOfferSlot(layer)
                    : renderLayerNode(layer)
                ))}
              </div>
            ) : (
              offerLayers.map((layer) => renderOfferSlot(layer))
            )}

            <div
              className={`stage-static tc-prices-group ${
                targetOutsideIsolation('unit-rate-prices') && targetOutsideIsolation('terms-prices')
                  ? 'is-outside-isolation'
                  : ''
              }`}
              data-gwd-group="tc_prices"
              id="TC_Prices"
            >
              <p
                className={`gwd-grp-tc sse-text sse-bottom-line unit-rate-prices ${targetStateClass('unit-rate-prices')}`}
                style={visibleTermsFrameStyle('unit-rate-prices')}
                onPointerDown={(event) => {
                  const layer = layerById.get('unit-rate-prices');
                  if (layer) startSelectionDrag(event, layer.id);
                }}
                onContextMenu={(event) => {
                  const layer = layerById.get('unit-rate-prices');
                  if (layer) openLayerMenu(event, layer);
                }}
              >
                {fieldValue(row.tc_units_text)}
              </p>
              <p
                className={`gwd-grp-tc sse-text sse-bottom-line terms-prices ${targetStateClass('terms-prices')}`}
                style={visibleTermsFrameStyle('terms-prices')}
                onPointerDown={(event) => {
                  const layer = layerById.get('terms-prices');
                  if (layer) startSelectionDrag(event, layer.id);
                }}
                onContextMenu={(event) => {
                  const layer = layerById.get('terms-prices');
                  if (layer) openLayerMenu(event, layer);
                }}
              >
                {fieldValue(row.tc_terms_text)}
              </p>
            </div>
            <div
              className={`stage-static tc-solo-group ${targetStateClass('terms-solo')}`}
              data-gwd-group="tc_solo"
              id="TC_Solo"
            >
              <p
                className={`gwd-grp-tc sse-text sse-bottom-line terms-solo ${targetStateClass('terms-solo')}`}
                style={visibleTermsFrameStyle('terms-solo')}
                onPointerDown={(event) => {
                  const layer = layerById.get('terms-solo');
                  if (layer) startSelectionDrag(event, layer.id);
                }}
                onContextMenu={(event) => {
                  const layer = layerById.get('terms-solo');
                  if (layer) openLayerMenu(event, layer);
                }}
              >
                {fieldValue(row.tc_terms_text)}
              </p>
            </div>
            {showSelectionChrome && showRestingSelectionBox ? (
              <div
                className={`current-selection-box selection-kind-${selectionKind}`}
                style={{
                  left: selectionBox.left,
                  top: selectionBox.top,
                  width: selectionBox.width,
                  height: selectionBox.height,
                  transform: selectionBox.transform,
                }}
                aria-hidden="true"
              >
                <span className="selection-label selection-label-current">Current</span>
              </div>
            ) : null}
            {motionGuide ? (
              <svg
                className="motion-state-guide"
                style={{
                  left: motionGuide.left,
                  top: motionGuide.top,
                  width: motionGuide.width,
                  height: motionGuide.height,
                }}
                viewBox={`0 0 ${motionGuide.width} ${motionGuide.height}`}
                aria-hidden="true"
              >
                <line
                  className="motion-state-line"
                  x1={motionGuide.restX}
                  y1={motionGuide.restY}
                  x2={motionGuide.currentX}
                  y2={motionGuide.currentY}
                />
                <circle className="motion-state-point motion-state-point-rest" cx={motionGuide.restX} cy={motionGuide.restY} r="3" />
                <circle className="motion-state-point motion-state-point-current" cx={motionGuide.currentX} cy={motionGuide.currentY} r="3" />
                <text className="motion-state-label motion-state-label-rest" x={motionGuide.restX + 5} y={motionGuide.restY - 5}>Rest</text>
                <text className="motion-state-label motion-state-label-current" x={motionGuide.currentX + 5} y={motionGuide.currentY - 5}>Current</text>
              </svg>
            ) : null}
            {showSelectionChrome ? (
              <div
                className={`selection-box selection-scope-${selectionBox.scope} selection-kind-${selectionKind}`}
                data-bounds-mode={selectionBox.boundsMode}
                data-selection-kind={selectionKind}
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
      {contextMenu ? (
        <div className="canvas-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <strong>{contextMenu.layerLabel}</strong>
          {contextMenu.choices.map((choice) => (
            <button key={choice.id} type="button" onClick={() => { choice.select(); setContextMenu(null); }}>{choice.label}</button>
          ))}
          <button type="button" onClick={() => { duplicateLayer(contextMenu.layerId); setContextMenu(null); }}>Duplicate layer</button>
          <button type="button" onClick={() => { deleteLayer(contextMenu.layerId); setContextMenu(null); }}>Delete layer</button>
          <button type="button" onClick={() => { toggleLayerLock(contextMenu.layerId); setContextMenu(null); }}>
            {contextMenu.locked ? 'Unlock layer' : 'Lock layer'}
          </button>
          <button type="button" onClick={() => { toggleLayerVisibility(contextMenu.layerId); setContextMenu(null); }}>
            {contextMenu.hidden ? 'Show layer' : 'Hide layer'}
          </button>
          <button type="button" onClick={() => { moveLayerZ(contextMenu.layerId, 1); setContextMenu(null); }}>Bring forward</button>
          <button type="button" onClick={() => { moveLayerZ(contextMenu.layerId, -1); setContextMenu(null); }}>Send backward</button>
          <button type="button" onClick={() => { addShapeLayer(); setContextMenu(null); }}>Add rectangle</button>
          <button type="button" onClick={() => { addAnimationIntent(contextMenu.layerId, 'fadeIn'); setContextMenu(null); }}>Fade in here</button>
          <button type="button" onClick={() => { addAnimationIntent(contextMenu.layerId, 'fadeOut'); setContextMenu(null); }}>Fade out here</button>
        </div>
      ) : null}
    </section>
  );
}
