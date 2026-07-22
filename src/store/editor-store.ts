// @ts-nocheck
'use client';

import { create } from 'zustand';

import {
  activeScopesFromControls,
  controlsFromFeedRow,
  createFeedDraft,
  selectFeedDraftVariant,
  updateFeedDraftField,
} from '@/lib/feed-model';
import { layoutOffers } from '@/lib/offer-layout';
import { alignOfferValueSymbols } from '@/lib/offer-value-symbols';
import { applyTextFitting } from '@/lib/text-fit';
import { textFitRulesForSize } from '@/lib/text-fit-rules';
import { nextZoomLevel } from '@/lib/canvas-zoom';
import {
  alignReferenceForTarget,
  alignmentGuidesForMode,
  canvasReferenceForAlignment,
  computeAlignPosition,
  computeGroupAlignDelta,
  computeHorizontalDistribute,
  computeVerticalDistribute,
  distributeGuidesForAxis,
  getTargetCanvasBounds,
} from '@/lib/canvas-alignment';
import {
  deriveSelectedTarget,
  dragTargetIdsForSelection,
  filterActiveOfferMembers,
  filterManipulationTargetIds,
  getGroupCanvasBounds,
  offerBlockTargetIds,
  offerBlockLayerIds,
  OFFERS_BLOCK_ID,
  resolveLayerIdForSelection,
  selectionHierarchy,
} from '@/lib/selection-groups';
import {
  defaultHitPathForDrillIn,
  nextSelectionForCanvasClick,
  nextSelectionForDrillIn,
  nextSelectionForEscape,
  normalizeSelectionState,
} from '@/lib/selection-state';
import { activeOfferMemberIds, offerInteractionTree } from '@/lib/offer-interaction-model';
import { isOfferTimelineLayer } from '@/lib/timeline-rows';
import { clipsForProfile } from '@/lib/headline-motion';
import { activeFrameScope, beatsForFrameScope } from '@/lib/timing-profiles';
import {
  addAnimationIntentToLayer,
  copyClipToAnimationFamily,
} from '@/lib/animation-intents';
import {
  addCreativeShapeLayer,
  addCreativeLayerClip,
  clearCreativeTargetActiveOverride,
  copyCreativeHeadlineOfferLayout,
  currentSizeCreative,
  deleteCreativeLayer,
  deepClone,
  duplicateCreativeLayer,
  findCreativeLayer,
  findCreativeTarget,
  headlineOfferVariantRule,
  moveCreativeLayerToZIndex,
  promoteCreativeTargetToSharedStyle,
  reorderCreativeLayerZ,
  resetCreativeHeadlineOfferLayout,
  updateCreativeLayerMetadata,
  updateCreativeLayerBase,
  updateCreativeLayerClip,
  updateCreativeLayerFit,
  updateCreativeClassFit,
  updateCreativeTargetFit as updateCreativeTargetFitDocument,
  replaceCreativeLayer,
  updateCreativeTargetSharedValue,
  updateCreativeTargetValue as updateCreativeTargetDocumentValue,
} from '@/lib/creative-model';

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || payload.stderr || response.statusText);
  return payload;
};

const withCampaign = (url, campaignId) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}campaign=${encodeURIComponent(campaignId || 'sse-dco')}`;
};

const EDITOR_SESSION_KEY = 'sse-dco-editor-session';

const readEditorSession = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(EDITOR_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeEditorSession = (patch = {}) => {
  if (typeof window === 'undefined') return;
  try {
    const next = { ...readEditorSession(), ...patch };
    window.localStorage.setItem(EDITOR_SESSION_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode failures; session restore is best-effort.
  }
};

const selectedFeedRowFromState = (state) => {
  const draft = state.feedDraft;
  const row = draft.rows[draft.selectedIndex] || draft.rows[0];
  if (row) return row;
  const sampleRows = state.creativeDocument?.feed?.sampleRows || [];
  return sampleRows.find((r) => Number(r.offer_count_num) === Number(state.offerCount)
    && r.tc_type_enum === state.tcMode
    && r.cta_type_enum === state.ctaShape)
    || sampleRows.find((r) => Number(r.offer_count_num) === Number(state.offerCount))
    || sampleRows[0]
    || {};
};

// Fit rules come from the same module the exporter embeds into Studio HTML
// (src/lib/text-fit-rules.ts) so the preview always matches the served ad.
const creativeFitRules = (state) => (
  textFitRulesForSize(currentSizeCreative(state.creativeDocument, state.size))
);

const editableBeatName = (value) => (
  typeof value === 'string' && /^[a-z0-9_]+$/i.test(value) ? value : ''
);

const defaultDrillChildId = (state, targetId) => {
  const tree = offerInteractionTree(
    state.creativeDocument,
    state.size,
    state.activeScopes(),
  );
  if (targetId === tree.id) return tree.children?.[0]?.id || '';
  const childParent = tree.children?.find((child) => child.id === targetId);
  return childParent?.children?.[0]?.id || '';
};

export const useEditorStore = create<any>((set, get) => ({
  sizes: [],
  size: '',
  offerCount: 1,
  tcMode: 'tcs_only',
  ctaShape: 'roundel',
  includeRoundelFrame: false,
  frameCount: 3,
  roundelMode: 'copy-only',
  percent: 19,
  isPlaying: false,
  feedProfileName: '',
  feedFields: [],
  feedDraft: createFeedDraft([]),
  campaigns: [],
  // Always default on both SSR and first client paint — restore from localStorage in init().
  activeCampaignId: 'sse-dco',
  creativeDocument: null,
  creativeDirty: false,
  selectedLayerId: '',
  selectedTargetId: '',
  selectedTargetIds: [],
  lastSelectionClickKey: '',
  isolationPath: [],
  isolatedGroupId: '',
  selectedClipId: '',
  fitResults: new Map(),
  fitTrackings: new Map(),
  fitClipped: new Map(),
  scale: 1,
  canvasZoom: 'auto',
  lockedLayerIds: new Set(),
  hiddenLayerIds: new Set(),
  resizeMode: 'frame',
  history: [],
  historyIndex: -1,
  statusMessage: 'Loading',
  statusTone: '',
  saveFeedDisabled: true,
  htmlInspectorOpen: false,
  htmlInspectorLoading: false,
  htmlInspectorPayload: null,
  /** Inspector listens and focuses the Sample field for this name. */
  focusFeedFieldRequest: null,

  setResizeMode: (mode) => set({ resizeMode: mode === 'scale' ? 'scale' : 'frame' }),

  requestEditFeedField: (fieldName) => {
    const name = String(fieldName || '').trim();
    if (!name) return;
    set({
      focusFeedFieldRequest: { fieldName: name, token: Date.now() },
    });
    get().setStatus(`Editing ${name.replace(/_/g, ' ')}`, 'info');
  },
  setPercent: (percent, options = {}) => set({
    percent,
    ...(options.pause === false ? {} : { isPlaying: false }),
  }),
  setPlaying: (isPlaying) => set({ isPlaying: Boolean(isPlaying) }),
  togglePlaying: () => set({ isPlaying: !get().isPlaying }),

  activeScopes: () => {
    const { offerCount, tcMode, ctaShape, includeRoundelFrame, frameCount, roundelMode } = get();
    return activeScopesFromControls({
      offerCount,
      tcMode,
      ctaShape,
      includeRoundelFrame,
      frameCount,
      roundelMode,
    });
  },

  selectedFeedRow: () => selectedFeedRowFromState(get()),

  syncControlsFromFeedRow: (row) => {
    const controls = controlsFromFeedRow(row || selectedFeedRowFromState(get()));
    set({
      offerCount: controls.offerCount,
      tcMode: controls.tcMode,
      ctaShape: controls.ctaShape,
      includeRoundelFrame: controls.includeRoundelFrame,
      frameCount: controls.frameCount,
      roundelMode: controls.roundelMode,
    });
    get().reconcileOfferSelection();
  },

  setStatus: (message, tone = '') => set({ statusMessage: message, statusTone: tone }),

  currentSizeCreative: () => currentSizeCreative(get().creativeDocument, get().size),
  selectedLayer: () => findCreativeLayer(get().creativeDocument, get().size, get().selectedLayerId),
  isLayerLocked: (layerId) => get().lockedLayerIds.has(layerId),
  isLayerHidden: (layerId) => get().hiddenLayerIds.has(layerId),
  selectedTarget: () => {
    const state = get();
    return deriveSelectedTarget(
      state.creativeDocument,
      state.size,
      state.selectedTargetId,
      state.selectedLayerId,
      state.selectedTargetIds,
      state.offerCount,
      state.activeScopes(),
    );
  },

  selectionDragTargetIds: () => {
    const state = get();
    const targetIds = dragTargetIdsForSelection(
      state.selectedTargetId || state.selectedLayerId,
      state.selectedTargetIds,
      state.offerCount,
      state.creativeDocument,
      state.size,
      state.activeScopes(),
    );
    return filterManipulationTargetIds(targetIds, state.creativeDocument, state.size, state.activeScopes());
  },

  handleCanvasTargetClick: (event, deepestTargetId) => {
    const state = get();
    const activeScopes = state.activeScopes();
    const hitPath = selectionHierarchy(
      deepestTargetId,
      state.offerCount,
      state.creativeDocument,
      state.size,
      activeScopes,
    );
    if (!hitPath.length) return;

    const modifier = event.metaKey || event.ctrlKey || event.shiftKey;
    if (modifier) {
      const depth = state.isolationPath?.length || 0;
      const selectedIndex = Math.min(depth, hitPath.length - 1);
      const leafAtDepth = hitPath[selectedIndex];
      const nextIsolationPath = hitPath.slice(0, selectedIndex);
      const nextIds = new Set(state.selectedTargetIds.length ? state.selectedTargetIds : [state.selectedTargetId].filter(Boolean));
      if (nextIds.has(leafAtDepth)) nextIds.delete(leafAtDepth);
      else nextIds.add(leafAtDepth);
      get().setCanvasSelection([...nextIds].at(-1) || '', [...nextIds], nextIsolationPath);
      return;
    }

    const next = nextSelectionForCanvasClick({
      currentTargetId: state.selectedTargetId,
      isolationPath: state.isolationPath || [],
      hitPath,
      modifier: false,
    });
    if (next) get().setCanvasSelection(next.selectedTargetId, next.selectedTargetIds, next.isolationPath);
  },

  setCanvasSelection: (targetId, targetIds = [targetId], isolationPath = []) => {
    const state = get();
    const layerId = targetId ? resolveLayerIdForSelection(targetId) : '';
    const layer = layerId ? findCreativeLayer(state.creativeDocument, state.size, layerId) : null;
    const next = normalizeSelectionState({
      selectedTargetId: targetId,
      selectedTargetIds: targetIds,
      selectedLayerId: layerId,
      selectedClipId: layer?.clips?.[0]?.id || '',
      isolationPath,
    });
    set({
      ...next,
      lastSelectionClickKey: '',
    });
  },

  drillIntoCanvasTarget: (deepestTargetId) => {
    const state = get();
    const activeScopes = state.activeScopes();
    const hitPath = deepestTargetId
      ? selectionHierarchy(
        deepestTargetId,
        state.offerCount,
        state.creativeDocument,
        state.size,
        activeScopes,
      )
      : defaultHitPathForDrillIn({
        currentTargetId: state.selectedTargetId,
        isolationPath: state.isolationPath || [],
        defaultChildId: defaultDrillChildId(state, state.selectedTargetId),
      });
    const next = nextSelectionForDrillIn({
      currentTargetId: state.selectedTargetId,
      isolationPath: state.isolationPath || [],
      hitPath: hitPath || [],
    });
    if (next) get().setCanvasSelection(next.selectedTargetId, next.selectedTargetIds, next.isolationPath);
  },

  enterGroupIsolation: (groupId, targetId) => {
    const state = get();
    const nextId = targetId || state.selectedTargetId || groupId;
    const layerId = resolveLayerIdForSelection(nextId);
    const layer = findCreativeLayer(state.creativeDocument, state.size, layerId);
    const isolationPath = [groupId];
    set({
      isolatedGroupId: groupId,
      isolationPath,
      selectedTargetId: nextId,
      selectedTargetIds: [nextId],
      selectedLayerId: layerId,
      selectedClipId: layer?.clips?.[0]?.id || state.selectedClipId,
      lastSelectionClickKey: '',
    });
  },

  exitGroupIsolation: () => {
    const state = get();
    const next = nextSelectionForEscape({
      selectedTargetId: state.selectedTargetId,
      isolationPath: state.isolationPath || [],
    });
    if (next) get().setCanvasSelection(next.selectedTargetId, next.selectedTargetIds, next.isolationPath);
  },
  selectedClip: () => {
    const state = get();
    const layer = state.selectedLayer();
    if (!layer) return null;
    const profile = activeFrameScope(state.activeScopes());
    const clips = clipsForProfile(layer.clips || [], profile);
    return clips.find((clip) => clip.id === state.selectedClipId) || clips[0] || null;
  },

  pushHistory: (changes) => {
    const realChanges = changes.filter((change) => change.before !== change.after);
    if (!realChanges.length) return;
    const state = get();
    const history = state.history.slice(0, state.historyIndex + 1);
    history.push(realChanges);
    set({ history, historyIndex: history.length - 1 });
  },

  applyHistoryChange: (change, value) => {
    if (change.kind === 'creativeBase') {
      get().applyCreativeLayerBaseValue(change.size, change.layerId, change.field, value);
      return;
    }
    if (change.kind === 'creativeTarget') {
      get().applyCreativeTargetValue(change.size, change.targetId, change.activeScopes || get().activeScopes(), change.field, value);
      return;
    }
    if (change.kind === 'creativeClip') {
      get().applyCreativeLayerClipValue(change.size, change.layerId, change.clipId, change.field, value, change.target);
      return;
    }
    if (change.kind === 'creativeBeat') {
      get().applyCreativeBeatValue(change.frameScope, change.beatName, value);
      return;
    }
    if (change.kind === 'creativeFit') {
      get().applyCreativeLayerFitValue(change.size, change.layerId, change.field, value);
      return;
    }
    if (change.kind === 'creativeClassFit') {
      get().applyCreativeClassFitValue(change.size, change.cssClass, change.field, value);
      return;
    }
    if (change.kind === 'creativeTargetFit') {
      get().applyCreativeTargetFitValue(
        change.size,
        change.targetId,
        change.activeScopes || get().activeScopes(),
        change.field,
        value,
      );
      return;
    }
    if (change.kind === 'creativeLayerReplace') {
      get().replaceCreativeLayerDocument(change.size, change.layerId, value);
    }
  },

  undo: () => {
    const state = get();
    if (state.historyIndex < 0) return;
    const entry = state.history[state.historyIndex];
    set({ historyIndex: state.historyIndex - 1 });
    for (const change of [...entry].reverse()) state.applyHistoryChange(change, change.before);
  },

  redo: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const nextIndex = state.historyIndex + 1;
    const entry = state.history[nextIndex];
    set({ historyIndex: nextIndex });
    for (const change of entry) state.applyHistoryChange(change, change.after);
  },

  selectLayer: (layerId, clipId = '') => {
    const layer = findCreativeLayer(get().creativeDocument, get().size, layerId);
    set({
      selectedLayerId: layerId,
      selectedTargetId: layerId,
      selectedTargetIds: [layerId],
      isolationPath: [],
      isolatedGroupId: '',
      lastSelectionClickKey: '',
      selectedClipId: clipId || layer?.clips?.[0]?.id || '',
    });
  },

  selectTarget: (targetId, clipId = '') => {
    const target = findCreativeTarget(get().creativeDocument, get().size, targetId, get().activeScopes());
    if (!target) return;
    const layerId = target.parentLayerId || target.id;
    const layer = findCreativeLayer(get().creativeDocument, get().size, layerId);
    set({
      selectedLayerId: layerId,
      selectedTargetId: targetId,
      selectedTargetIds: [targetId],
      isolationPath: [],
      isolatedGroupId: '',
      lastSelectionClickKey: '',
      selectedClipId: clipId || layer?.clips?.[0]?.id || '',
    });
  },

  selectOffersBlock: () => {
    const state = get();
    if (state.offerCount < 2) return;
    const layerId = resolveLayerIdForSelection(OFFERS_BLOCK_ID);
    const layer = findCreativeLayer(state.creativeDocument, state.size, layerId);
    set({
      selectedTargetId: OFFERS_BLOCK_ID,
      selectedTargetIds: [OFFERS_BLOCK_ID],
      selectedLayerId: layerId,
      selectedClipId: layer?.clips?.[0]?.id || state.selectedClipId,
      isolationPath: [],
      isolatedGroupId: '',
      lastSelectionClickKey: '',
    });
  },

  selectTimelineLayer: (layerId) => {
    const state = get();
    if (layerId === OFFERS_BLOCK_ID) {
      get().selectOffersBlock();
      return;
    }
    const activeOfferIds = activeOfferMemberIds(
      state.creativeDocument,
      state.size,
      state.activeScopes(),
    );
    const offerBlockMemberIds = activeOfferIds.length
      ? activeOfferIds
      : offerBlockLayerIds(state.offerCount);
    const inactiveOffer = isOfferTimelineLayer(layerId)
      && !offerBlockMemberIds.includes(layerId);
    if (inactiveOffer) {
      get().selectLayer(layerId);
      return;
    }
    if (isOfferTimelineLayer(layerId) && state.offerCount >= 2) {
      get().enterGroupIsolation(OFFERS_BLOCK_ID, layerId);
      return;
    }
    get().selectLayer(layerId);
  },

  selectClip: (layerId, clipId) => {
    set({
      selectedLayerId: layerId,
      selectedTargetId: layerId,
      selectedTargetIds: [layerId],
      isolationPath: [],
      isolatedGroupId: '',
      lastSelectionClickKey: '',
      selectedClipId: clipId,
    });
  },

  clearCanvasSelection: () => {
    set({
      selectedLayerId: '',
      selectedTargetId: '',
      selectedTargetIds: [],
      isolationPath: [],
      isolatedGroupId: '',
      lastSelectionClickKey: '',
      selectedClipId: '',
    });
  },

  toggleLayerLock: (layerId = '') => {
    const targetId = layerId || get().selectedLayerId;
    if (!targetId) return;
    const lockedLayerIds = new Set(get().lockedLayerIds);
    if (lockedLayerIds.has(targetId)) lockedLayerIds.delete(targetId);
    else lockedLayerIds.add(targetId);
    set({ lockedLayerIds });
  },

  toggleLayerVisibility: (layerId = '') => {
    const targetId = layerId || get().selectedLayerId;
    if (!targetId) return;
    const hiddenLayerIds = new Set(get().hiddenLayerIds);
    if (hiddenLayerIds.has(targetId)) hiddenLayerIds.delete(targetId);
    else hiddenLayerIds.add(targetId);
    set({ hiddenLayerIds });
  },

  duplicateLayer: (layerId = '') => {
    const state = get();
    const targetId = layerId || state.selectedLayerId;
    if (!targetId || !state.creativeDocument) return;
    const next = duplicateCreativeLayer(state.creativeDocument, state.size, targetId);
    const layers = currentSizeCreative(next, state.size)?.layers || [];
    const copy = layers[layers.length - 1];
    set({
      creativeDocument: next,
      creativeDirty: true,
      selectedLayerId: copy?.id || targetId,
      selectedTargetId: copy?.id || targetId,
      selectedTargetIds: [copy?.id || targetId],
      selectedClipId: copy?.clips?.[0]?.id || '',
      isolationPath: [],
      isolatedGroupId: '',
    });
    get().setStatus('Duplicated layer', 'warn');
  },

  deleteLayer: (layerId = '') => {
    const state = get();
    const targetId = layerId || state.selectedLayerId;
    if (!targetId || !state.creativeDocument) return;
    if (targetId === 'bg-image') {
      get().setStatus('Background layer cannot be deleted', 'warn');
      return;
    }
    const next = deleteCreativeLayer(state.creativeDocument, state.size, targetId);
    const lockedLayerIds = new Set(state.lockedLayerIds);
    const hiddenLayerIds = new Set(state.hiddenLayerIds);
    lockedLayerIds.delete(targetId);
    hiddenLayerIds.delete(targetId);
    set({
      creativeDocument: next,
      creativeDirty: true,
      lockedLayerIds,
      hiddenLayerIds,
      selectedLayerId: '',
      selectedTargetId: '',
      selectedTargetIds: [],
      selectedClipId: '',
      isolationPath: [],
      isolatedGroupId: '',
    });
    get().setStatus('Deleted layer', 'warn');
  },

  addShapeLayer: () => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = addCreativeShapeLayer(state.creativeDocument, state.size, 'rectangle');
    const layers = currentSizeCreative(next, state.size)?.layers || [];
    const shape = layers[layers.length - 1];
    set({
      creativeDocument: next,
      creativeDirty: true,
      selectedLayerId: shape?.id || '',
      selectedTargetId: shape?.id || '',
      selectedTargetIds: [shape?.id].filter(Boolean),
      selectedClipId: '',
      isolationPath: [],
      isolatedGroupId: '',
    });
    get().setStatus('Added rectangle', 'warn');
  },

  moveLayerZ: (layerId = '', direction = 0) => {
    const state = get();
    const targetId = layerId || state.selectedLayerId;
    if (!targetId || !direction || !state.creativeDocument) return;
    const next = reorderCreativeLayerZ(state.creativeDocument, state.size, targetId, direction);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus(direction > 0 ? 'Moved layer forward' : 'Moved layer backward', 'warn');
  },

  moveLayerToZIndex: (layerId = '', targetIndex = 0) => {
    const state = get();
    const targetId = layerId || state.selectedLayerId;
    if (!targetId || !state.creativeDocument) return;
    const next = moveCreativeLayerToZIndex(state.creativeDocument, state.size, targetId, targetIndex);
    set({
      creativeDocument: next,
      creativeDirty: true,
      selectedLayerId: targetId,
      selectedTargetId: targetId,
      selectedTargetIds: [targetId],
    });
    get().setStatus('Reordered layer', 'warn');
  },

  reconcileOfferSelection: () => {
    const state = get();
    if (state.offerCount < 2) {
      if (
        state.selectedTargetId === OFFERS_BLOCK_ID
        || state.isolatedGroupId === OFFERS_BLOCK_ID
        || state.isolationPath?.length
        || state.selectedTargetIds.includes(OFFERS_BLOCK_ID)
      ) {
        get().clearCanvasSelection();
      }
      return;
    }

    const activeScopes = state.activeScopes();
    const activeMembers = filterActiveOfferMembers(
      state.selectedTargetIds,
      state.offerCount,
      state.creativeDocument,
      state.size,
      activeScopes,
    );
    if (activeMembers.length !== state.selectedTargetIds.length) {
      const selectedTargetId = activeMembers.includes(state.selectedTargetId)
        ? state.selectedTargetId
        : (activeMembers[activeMembers.length - 1] || '');
      const layerId = selectedTargetId ? resolveLayerIdForSelection(selectedTargetId) : '';
      const layer = layerId ? findCreativeLayer(state.creativeDocument, state.size, layerId) : null;
      const next = normalizeSelectionState({
        selectedTargetIds: activeMembers,
        selectedTargetId,
        selectedLayerId: layerId,
        selectedClipId: selectedTargetId ? (layer?.clips?.[0]?.id || state.selectedClipId) : '',
        isolationPath: state.isolationPath || [],
        activePathIds: [
          OFFERS_BLOCK_ID,
          ...offerBlockTargetIds(state.creativeDocument, state.size, state.offerCount, activeScopes),
        ],
      });
      set(next);
    }
  },

  loadCreativeDocument: async () => {
    const state = get();
    const document = await api(withCampaign('/api/creative', state.activeCampaignId));
    const activeSize = state.size || Object.keys(document.sizes || {})[0] || '';
    const selectedLayer = document.sizes?.[activeSize]?.layers?.[0];
    set({
      creativeDocument: document,
      creativeDirty: false,
      selectedLayerId: state.selectedLayerId || selectedLayer?.id || '',
      selectedTargetId: state.selectedTargetId || state.selectedLayerId || selectedLayer?.id || '',
      selectedTargetIds: state.selectedTargetIds?.length
        ? state.selectedTargetIds
        : [state.selectedTargetId || state.selectedLayerId || selectedLayer?.id].filter(Boolean),
      selectedClipId: state.selectedClipId || selectedLayer?.clips?.[0]?.id || '',
    });
  },

  switchCampaign: async (campaignId) => {
    const state = get();
    if (!campaignId || campaignId === state.activeCampaignId) return;
    if (state.creativeDirty || !state.saveFeedDisabled) {
      const confirmed = window.confirm('You have unsaved changes. Discard them and switch campaigns?');
      if (!confirmed) return;
    }
    set({
      activeCampaignId: campaignId,
      creativeDirty: false,
      saveFeedDisabled: true,
      history: [],
      historyIndex: -1,
      selectedLayerId: '',
      selectedTargetId: '',
      selectedTargetIds: [],
      selectedClipId: '',
      isolationPath: [],
    });
    writeEditorSession({ campaignId });
    await Promise.all([
      get().loadFeedSchema(),
      get().loadCreativeDocument(),
    ]);
    const document = get().creativeDocument;
    const sizes = Object.keys(document?.sizes || {}).sort();
    set({ sizes });
    const preferred = sizes.includes(state.size) ? state.size : (sizes.includes('300x600') ? '300x600' : sizes[0]);
    if (preferred) await get().loadSize(preferred);
    const name = (get().campaigns || []).find((entry) => entry.id === campaignId)?.name || campaignId;
    get().setStatus(`Loaded ${name}`);
  },

  applyCreativeLayerBaseValue: (size, layerId, field, value) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeLayerBase(state.creativeDocument, size, layerId, field, value);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  updateCreativeLayerBaseValue: (layerId, field, value, { record = true, before = undefined } = {}) => {
    const state = get();
    const size = state.size;
    const layer = findCreativeLayer(state.creativeDocument, size, layerId);
    if (!layer) return;
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const previous = before ?? layer.base?.[field];
    get().applyCreativeLayerBaseValue(size, layerId, field, nextValue);
    if (record) {
      get().pushHistory([{ kind: 'creativeBase', size, layerId, field, before: previous, after: nextValue }]);
    }
  },

  applyCreativeLayerFitValue: (size, layerId, field, value) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeLayerFit(state.creativeDocument, size, layerId, field, value);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  updateCreativeLayerFitValue: (layerId, field, value, { record = true, before = undefined } = {}) => {
    const state = get();
    const layer = findCreativeLayer(state.creativeDocument, state.size, layerId);
    if (!layer) return;
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const previous = before ?? layer.fit?.[field];
    get().applyCreativeLayerFitValue(state.size, layerId, field, nextValue);
    if (record) {
      get().pushHistory([{ kind: 'creativeFit', size: state.size, layerId, field, before: previous, after: nextValue }]);
    }
  },

  applyCreativeClassFitValue: (size, cssClass, field, value) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeClassFit(state.creativeDocument, size, cssClass, field, value);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  updateCreativeClassFitValue: (cssClass, field, value, { record = true, before = undefined } = {}) => {
    const state = get();
    const sizeCreative = currentSizeCreative(state.creativeDocument, state.size);
    const rule = sizeCreative?.classRules?.find((item) => item.cssClass === cssClass);
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const previous = before ?? rule?.fit?.[field];
    get().applyCreativeClassFitValue(state.size, cssClass, field, nextValue);
    if (record) {
      get().pushHistory([{
        kind: 'creativeClassFit',
        size: state.size,
        cssClass,
        field,
        before: previous,
        after: nextValue,
      }]);
    }
  },

  applyCreativeTargetFitValue: (size, targetId, activeScopes, field, value) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeTargetFitDocument(
      state.creativeDocument,
      size,
      targetId,
      activeScopes,
      field,
      value,
    );
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  updateCreativeTargetFitValue: (targetId, field, value, { record = true, before = undefined } = {}) => {
    const state = get();
    const size = state.size;
    const activeScopes = state.activeScopes();
    const target = findCreativeTarget(state.creativeDocument, size, targetId, activeScopes);
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const previous = before ?? target?.fit?.[field];
    get().applyCreativeTargetFitValue(size, targetId, activeScopes, field, nextValue);
    if (record) {
      get().pushHistory([{
        kind: 'creativeTargetFit',
        size,
        targetId,
        activeScopes,
        field,
        before: previous,
        after: nextValue,
      }]);
    }
  },

  replaceCreativeLayerDocument: (size, layerId, nextLayer) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = replaceCreativeLayer(state.creativeDocument, size, layerId, nextLayer);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  replaceSelectedLayerFromCode: (code) => {
    const state = get();
    const layer = findCreativeLayer(state.creativeDocument, state.size, state.selectedLayerId);
    if (!layer) throw new Error('No selected layer to replace.');
    const parsed = JSON.parse(code);
    get().replaceCreativeLayerDocument(state.size, layer.id, parsed);
    get().pushHistory([{ kind: 'creativeLayerReplace', size: state.size, layerId: layer.id, before: layer, after: parsed }]);
  },

  updateCreativeLayerMetadataValue: (layerId, field, value) => {
    const state = get();
    const layer = findCreativeLayer(state.creativeDocument, state.size, layerId);
    if (!layer) return;
    const previous = layer?.[field];
    const next = updateCreativeLayerMetadata(state.creativeDocument, state.size, layerId, field, value);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Updated reusable layer metadata', 'warn');
    get().pushHistory([{ kind: 'creativeLayerMetadata', size: state.size, layerId, field, before: previous, after: value }]);
  },

  applyCreativeTargetValue: (size, targetId, activeScopes, field, value) => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeTargetDocumentValue(state.creativeDocument, size, targetId, activeScopes, field, value);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  updateCreativeTargetValue: (targetId, field, value, { record = true, before = undefined } = {}) => {
    const state = get();
    const size = state.size;
    const activeScopes = state.activeScopes();
    const target = findCreativeTarget(state.creativeDocument, size, targetId, activeScopes);
    if (!target) return;
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const previous = before ?? target.values?.[field];
    get().applyCreativeTargetValue(size, targetId, activeScopes, field, nextValue);
    if (record) {
      get().pushHistory([{ kind: 'creativeTarget', size, targetId, activeScopes, field, before: previous, after: nextValue }]);
    }
  },

  updateCreativeTargetSharedValue: (targetId, field, value) => {
    const state = get();
    const size = state.size;
    const target = findCreativeTarget(state.creativeDocument, size, targetId, state.activeScopes());
    if (!target) return;
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const next = updateCreativeTargetSharedValue(state.creativeDocument, size, targetId, field, nextValue);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Updated shared reusable style', 'warn');
    get().pushHistory([{ kind: 'creativeTargetShared', size, targetId, field, before: target.values?.[field], after: nextValue }]);
  },

  clearCreativeTargetOverrides: (targetId, fields = []) => {
    const state = get();
    if (!state.creativeDocument || !targetId) return;
    const activeScopes = state.activeScopes();
    const before = findCreativeTarget(state.creativeDocument, state.size, targetId, activeScopes);
    const next = clearCreativeTargetActiveOverride(state.creativeDocument, state.size, targetId, activeScopes, fields);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Cleared active override', 'warn');
    get().pushHistory([{ kind: 'creativeTargetOverrideClear', size: state.size, targetId, activeScopes, fields, before, after: null }]);
  },

  promoteCreativeTargetToSharedStyle: (targetId, fields = []) => {
    const state = get();
    if (!state.creativeDocument || !targetId) return;
    const activeScopes = state.activeScopes();
    const before = findCreativeTarget(state.creativeDocument, state.size, targetId, activeScopes);
    const next = promoteCreativeTargetToSharedStyle(state.creativeDocument, state.size, targetId, activeScopes, fields);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Saved active values as shared style', 'warn');
    get().pushHistory([{ kind: 'creativeTargetSharedPromote', size: state.size, targetId, activeScopes, fields, before, after: null }]);
  },

  copyHeadlineOfferLayout: (sourceOfferCount, targetOfferCount = null) => {
    const state = get();
    if (!state.creativeDocument) return;
    const target = targetOfferCount || state.offerCount;
    const before = headlineOfferVariantRule(currentSizeCreative(state.creativeDocument, state.size), target);
    const next = copyCreativeHeadlineOfferLayout(
      state.creativeDocument,
      state.size,
      sourceOfferCount,
      target,
    );
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus(`Copied ${sourceOfferCount}-offer headline layout to ${target}-offer`, 'warn');
    get().pushHistory([{
      kind: 'headlineOfferLayoutCopy',
      size: state.size,
      sourceOfferCount,
      targetOfferCount: target,
      before,
      after: headlineOfferVariantRule(currentSizeCreative(next, state.size), target),
    }]);
  },

  resetHeadlineOfferLayout: (offerCount = null) => {
    const state = get();
    if (!state.creativeDocument) return;
    const target = offerCount || state.offerCount;
    const before = headlineOfferVariantRule(currentSizeCreative(state.creativeDocument, state.size), target);
    const next = resetCreativeHeadlineOfferLayout(state.creativeDocument, state.size, target);
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus(`${target}-offer headline now uses the 1-offer baseline`, 'warn');
    get().pushHistory([{
      kind: 'headlineOfferLayoutReset',
      size: state.size,
      offerCount: target,
      before,
      after: null,
    }]);
  },

  nudgeSelectedTarget: (dx, dy) => {
    const state = get();
    const activeScopes = state.activeScopes();
    const targetIds = state.selectionDragTargetIds();
    if (!targetIds.length) return;
    const changes = [];
    for (const targetId of targetIds) {
      const target = findCreativeTarget(state.creativeDocument, state.size, targetId, activeScopes);
      if (!target) continue;
      if (dx) {
        const before = Number(target.values?.left || 0);
        const after = before + dx;
        get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'left', after);
        changes.push({ kind: 'creativeTarget', size: state.size, targetId, activeScopes, field: 'left', before, after });
      }
      if (dy) {
        const fresh = findCreativeTarget(get().creativeDocument, state.size, targetId, activeScopes);
        const before = Number(fresh?.values?.top || target.values?.top || 0);
        const after = before + dy;
        get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'top', after);
        changes.push({ kind: 'creativeTarget', size: state.size, targetId, activeScopes, field: 'top', before, after });
      }
    }
    if (changes.length) get().pushHistory(changes);
  },

  alignSelectedTarget: (mode) => {
    const state = get();
    const activeScopes = state.activeScopes();
    const targetIds = state.selectionDragTargetIds();
    if (!targetIds.length) return null;

    const selected = deriveSelectedTarget(
      state.creativeDocument,
      state.size,
      state.selectedTargetId,
      state.selectedLayerId,
      state.selectedTargetIds,
      state.offerCount,
      activeScopes,
    );
    const isGroupSelection = selected?.kind === 'group'
      || selected?.kind === 'multi'
      || targetIds.length > 1;

    if (isGroupSelection) {
      const groupBounds = selected?.kind === 'multi'
        ? getGroupCanvasBounds(state.creativeDocument, state.size, targetIds, activeScopes)
        : selected?.bounds
        || getGroupCanvasBounds(state.creativeDocument, state.size, targetIds, activeScopes);
      if (!groupBounds) return null;

      const reference = alignReferenceForTarget(
        state.creativeDocument,
        state.size,
        { ...groupBounds, coordinateScope: 'canvas', parentLayerId: '' },
        activeScopes,
      );
      const { dx, dy } = computeGroupAlignDelta(groupBounds, reference, mode);
      const guides = alignmentGuidesForMode(mode, reference);
      const changes = [];

      for (const targetId of targetIds) {
        const target = findCreativeTarget(state.creativeDocument, state.size, targetId, activeScopes);
        if (!target) continue;
        if (dx) {
          const before = Number(target.values?.left || 0);
          const after = before + dx;
          get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'left', after);
          changes.push({
            kind: 'creativeTarget',
            size: state.size,
            targetId,
            activeScopes,
            field: 'left',
            before,
            after,
          });
        }
        if (dy) {
          const fresh = findCreativeTarget(get().creativeDocument, state.size, targetId, activeScopes);
          const before = Number(fresh?.values?.top || target.values?.top || 0);
          const after = before + dy;
          get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'top', after);
          changes.push({
            kind: 'creativeTarget',
            size: state.size,
            targetId,
            activeScopes,
            field: 'top',
            before,
            after,
          });
        }
      }

      if (changes.length) {
        get().pushHistory(changes);
      }
      get().setStatus(`Aligned ${selected?.label || 'selection'}`, 'info');
      return guides;
    }

    const targetId = targetIds[0];
    const bounds = getTargetCanvasBounds(state.creativeDocument, state.size, targetId, activeScopes);
    if (!bounds) return null;
    const reference = alignReferenceForTarget(state.creativeDocument, state.size, bounds, activeScopes);
    const canvasReference = canvasReferenceForAlignment(
      state.creativeDocument,
      state.size,
      bounds,
      activeScopes,
    );
    const aligned = computeAlignPosition(bounds, reference, mode);
    const target = findCreativeTarget(state.creativeDocument, state.size, targetId, activeScopes);
    if (!target) return null;
    const beforeLeft = Number(target.values?.left || 0);
    const beforeTop = Number(target.values?.top || 0);
    const changes = [];
    if (['left', 'center-h', 'right'].includes(mode)) {
      get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'left', aligned.left);
      changes.push({
        kind: 'creativeTarget',
        size: state.size,
        targetId,
        activeScopes,
        field: 'left',
        before: beforeLeft,
        after: aligned.left,
      });
    }
    if (['top', 'center-v', 'bottom'].includes(mode)) {
      get().applyCreativeTargetValue(state.size, targetId, activeScopes, 'top', aligned.top);
      changes.push({
        kind: 'creativeTarget',
        size: state.size,
        targetId,
        activeScopes,
        field: 'top',
        before: beforeTop,
        after: aligned.top,
      });
    }
    if (changes.length) {
      get().pushHistory(changes);
      get().setStatus(`Aligned ${target.label || targetId}`, 'info');
    }
    return alignmentGuidesForMode(mode, canvasReference);
  },

  distributeSelectedTarget: (axis) => {
    const state = get();
    const activeScopes = state.activeScopes();
    const selected = deriveSelectedTarget(
      state.creativeDocument,
      state.size,
      state.selectedTargetId,
      state.selectedLayerId,
      state.selectedTargetIds,
      state.offerCount,
      activeScopes,
    );

    const targetIds = state.selectionDragTargetIds().filter((targetId) => !targetId.includes('::'));
    if (state.selectedTargetId === OFFERS_BLOCK_ID) {
      get().setStatus('Enter the offer group and select peer items to distribute spacing', 'warn');
      return null;
    }

    const items = targetIds
      .map((targetId) => {
        const bounds = getTargetCanvasBounds(state.creativeDocument, state.size, targetId, activeScopes);
        if (!bounds) return null;
        return {
          targetId,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      })
      .filter(Boolean);

    if (items.length < 2) {
      get().setStatus('Select 2 or more items to distribute spacing', 'warn');
      return null;
    }

    const updates = axis === 'h'
      ? computeHorizontalDistribute(items)
      : computeVerticalDistribute(items);
    if (!updates) return null;

    const changes = [];
    for (const update of updates) {
      const target = findCreativeTarget(state.creativeDocument, state.size, update.targetId, activeScopes);
      if (!target) continue;
      if (axis === 'h') {
        const before = Number(target.values?.left || 0);
        get().applyCreativeTargetValue(state.size, update.targetId, activeScopes, 'left', update.left);
        changes.push({
          kind: 'creativeTarget',
          size: state.size,
          targetId: update.targetId,
          activeScopes,
          field: 'left',
          before,
          after: update.left,
        });
      } else {
        const before = Number(target.values?.top || 0);
        get().applyCreativeTargetValue(state.size, update.targetId, activeScopes, 'top', update.top);
        changes.push({
          kind: 'creativeTarget',
          size: state.size,
          targetId: update.targetId,
          activeScopes,
          field: 'top',
          before,
          after: update.top,
        });
      }
    }

    if (changes.length) {
      get().pushHistory(changes);
      get().setStatus(`Distributed ${selected?.label || 'selection'} ${axis === 'h' ? 'horizontally' : 'vertically'}`, 'info');
    }

    const positioned = items.map((item) => {
      const update = updates.find((entry) => entry.targetId === item.targetId);
      return axis === 'h'
        ? { ...item, left: update?.left ?? item.left }
        : { ...item, top: update?.top ?? item.top };
    });
    return distributeGuidesForAxis(axis, positioned);
  },

  applyCreativeLayerClipValue: (size, layerId, clipId, field, value, target = 'clip') => {
    const state = get();
    if (!state.creativeDocument) return;
    const next = updateCreativeLayerClip(state.creativeDocument, size, layerId, clipId, { field, value, target });
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  applyCreativeBeatValue: (frameScope, beatName, value) => {
    const state = get();
    if (!state.creativeDocument || !beatName) return;
    const next = deepClone(state.creativeDocument);
    next.clock = next.clock || {};
    next.clock.profiles = next.clock.profiles || {};
    next.clock.profiles[frameScope] = {
      ...beatsForFrameScope(next, frameScope),
      [beatName]: Number(value),
    };
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus(`Updated ${frameScope} timing`, 'warn');
  },

  updateCreativeLayerClipValue: (layerId, clipId, field, value, target = 'clip') => {
    const state = get();
    const size = state.size;
    const layer = findCreativeLayer(state.creativeDocument, size, layerId);
    const clip = (layer?.clips || []).find((item) => item.id === clipId);
    if (!clip) return;
    const previous = target === 'params' ? clip.params?.[field] : clip[field];
    const nextValue = value === '' ? '' : typeof value === 'boolean' ? value : Number.isFinite(Number(value)) ? Number(value) : value;
    const beatName = target === 'clip' && ['start', 'end'].includes(field) ? editableBeatName(previous) : '';
    if (beatName && Number.isFinite(Number(nextValue))) {
      const frameScope = activeFrameScope(state.activeScopes());
      const previousBeatValue = beatsForFrameScope(state.creativeDocument, frameScope)[beatName];
      get().applyCreativeBeatValue(frameScope, beatName, Number(nextValue));
      get().pushHistory([{
        kind: 'creativeBeat',
        frameScope,
        beatName,
        before: previousBeatValue,
        after: Number(nextValue),
      }]);
      return;
    }
    get().applyCreativeLayerClipValue(size, layerId, clipId, field, nextValue, target);
    get().pushHistory([{ kind: 'creativeClip', size, layerId, clipId, field, target, before: previous, after: nextValue }]);
  },

  addCreativeClip: (layerId, preset = 'fade') => {
    const state = get();
    const layer = findCreativeLayer(state.creativeDocument, state.size, layerId);
    if (!layer) return;
    const clipCount = (layer.clips || []).filter((clip) => clip.preset === preset).length;
    const clip = {
      id: `${layerId}-${preset}${clipCount ? `-${clipCount + 1}` : ''}`,
      label: `${layer.label || layerId} ${preset}`,
      preset,
      start: Math.round(state.percent),
      end: 100,
      params: preset === 'fade' ? { enter_duration_pct: 3, fade_pct: 3 } : {},
    };
    const next = addCreativeLayerClip(state.creativeDocument, state.size, layerId, clip);
    set({
      creativeDocument: next,
      creativeDirty: true,
      selectedLayerId: layerId,
      selectedTargetId: layerId,
      selectedTargetIds: [layerId],
      isolationPath: [],
      isolatedGroupId: '',
      selectedClipId: clip.id,
    });
    get().setStatus('Unsaved creative changes', 'warn');
  },

  addAnimationIntent: (layerId, intentId) => {
    const state = get();
    if (!state.creativeDocument) return;
    const { document, clip } = addAnimationIntentToLayer(
      state.creativeDocument,
      state.size,
      layerId,
      intentId,
      Math.round(state.percent),
    );
    set({
      creativeDocument: document,
      creativeDirty: true,
      selectedLayerId: layerId,
      selectedTargetId: layerId,
      selectedTargetIds: [layerId],
      isolationPath: [],
      isolatedGroupId: '',
      selectedClipId: clip.id,
    });
    get().setStatus(`Added ${clip.label}`, 'warn');
  },

  copySelectedClipToAnimationFamily: () => {
    const state = get();
    if (!state.creativeDocument || !state.selectedLayerId || !state.selectedClipId) return;
    const next = copyClipToAnimationFamily(
      state.creativeDocument,
      state.size,
      state.selectedLayerId,
      state.selectedClipId,
    );
    set({ creativeDocument: next, creativeDirty: true });
    get().setStatus('Applied motion to matching family', 'warn');
  },

  loadCampaigns: async () => {
    const campaigns = await api('/api/campaigns');
    set({ campaigns: Array.isArray(campaigns) ? campaigns : [] });
  },

  loadFeedSchema: async () => {
    const state = get();
    const payload = await api(withCampaign('/api/feed-schema', state.activeCampaignId));
    set({
      feedProfileName: payload.profileName,
      feedFields: payload.fields || [],
      feedDraft: createFeedDraft(payload.rows || [], {
        selectedIndex: Math.min(state.feedDraft.selectedIndex || 0, Math.max(0, (payload.rows || []).length - 1)),
      }),
    });
    get().syncControlsFromFeedRow();
  },

  loadSize: async (size) => {
    get().syncControlsFromFeedRow(selectedFeedRowFromState(get()));
    set({
      size,
      history: [],
      historyIndex: -1,
    });
    writeEditorSession({ size });
    const creativeSize = currentSizeCreative(get().creativeDocument, size);
    if (creativeSize?.layers?.length) {
      const existing = creativeSize.layers.find((layer) => layer.id === get().selectedLayerId);
      const selectedLayer = existing || creativeSize.layers[0];
      set({
        selectedLayerId: selectedLayer.id,
        selectedTargetId: selectedLayer.id,
        selectedTargetIds: [selectedLayer.id],
        isolationPath: [],
        isolatedGroupId: '',
        selectedClipId: selectedLayer.clips?.[0]?.id || '',
      });
    }
    get().setStatus(`Loaded ${size}`);
  },

  saveFeedRows: async () => {
    get().setStatus('Saving sample values');
    const state = get();
    const payload = await api(withCampaign('/api/feed-schema/rows', state.activeCampaignId), {
      method: 'POST',
      body: JSON.stringify({ rows: state.feedDraft.rows, campaign: state.activeCampaignId }),
    });
    const creativeDocument = state.creativeDocument
      ? {
          ...state.creativeDocument,
          feed: {
            ...state.creativeDocument.feed,
            sampleRows: payload.rows || [],
          },
        }
      : state.creativeDocument;
    set({
      feedProfileName: payload.profileName,
      feedFields: payload.fields || state.feedFields,
      feedDraft: createFeedDraft(payload.rows || [], {
        selectedIndex: Math.min(state.feedDraft.selectedIndex || 0, Math.max(0, (payload.rows || []).length - 1)),
      }),
      creativeDocument,
      creativeDirty: false,
      saveFeedDisabled: true,
    });
    get().syncControlsFromFeedRow();
    get().setStatus('Saved sample values');
  },

  exportSlug: () => {
    const state = get();
    const fromList = (state.campaigns || []).find((entry) => entry.id === state.activeCampaignId)?.exportSlug;
    return fromList || 'SSE_DCO';
  },

  buildHtml: async ({ renderMode = 'font' } = {}) => {
    const state = get();
    get().setStatus(renderMode === 'outline'
      ? 'Exporting outlined SVG HTML for all sizes'
      : 'Exporting Studio-ready HTML for all sizes');
    const creativeDocument = state.creativeDocument
      ? {
          ...state.creativeDocument,
          feed: {
            ...state.creativeDocument.feed,
            sampleRows: state.feedDraft.rows?.length
              ? state.feedDraft.rows
              : state.creativeDocument.feed.sampleRows,
          },
        }
      : null;
    const response = await fetch(withCampaign('/api/creative/export', state.activeCampaignId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaign: state.activeCampaignId,
        renderMode,
        download: true,
        ...(creativeDocument ? { document: creativeDocument } : {}),
      }),
    });
    if (!response.ok) {
      let message = response.statusText || 'Failed to export HTML';
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // keep fallback
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('HTML export ZIP was empty');
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    const slug = get().exportSlug();
    const filename = renderMode === 'outline'
      ? `${slug}_html_outlines.zip`
      : `${slug}_html.zip`;
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    get().setStatus(`Downloaded ${filename} (also written to output/)`);
  },

  exportClientPackage: async ({ includeValidator = true, renderMode = 'font' } = {}) => {
    get().setStatus(
      renderMode === 'outline'
        ? 'Building outlined client ZIP'
        : (includeValidator ? 'Building validated client preview ZIP' : 'Building client preview ZIP'),
    );
    const state = get();
    const creativeDocument = state.creativeDocument
      ? {
          ...state.creativeDocument,
          feed: {
            ...state.creativeDocument.feed,
            sampleRows: state.feedDraft.rows?.length
              ? state.feedDraft.rows
              : state.creativeDocument.feed.sampleRows,
          },
        }
      : null;
    const response = await fetch(withCampaign('/api/creative/client-package', state.activeCampaignId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaign: state.activeCampaignId,
        ...(creativeDocument ? { document: creativeDocument } : {}),
        includeValidator: renderMode === 'font' ? includeValidator : false,
        renderMode,
      }),
    });
    if (!response.ok) {
      let message = response.statusText || 'Failed to export client preview ZIP';
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // ZIP route errors are JSON, but keep a useful fallback for network failures.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('Client preview ZIP was empty');
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    const slug = get().exportSlug();
    anchor.href = url;
    anchor.download = renderMode === 'outline'
      ? `${slug}_client_preview_package_outlines.zip`
      : (includeValidator
        ? `${slug}_client_preview_package_validated.zip`
        : `${slug}_client_preview_package.zip`);
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    get().setStatus(renderMode === 'outline'
      ? 'Downloaded outlined client ZIP'
      : (includeValidator ? 'Downloaded validated client preview ZIP' : 'Downloaded client preview ZIP'));
  },

  exportBasePackage: async ({ assetMode = 'packaged', renderMode = 'font' } = {}) => {
    const statusLabel = renderMode === 'outline'
      ? 'Building outlined base ZIP'
      : assetMode === 'cdn'
        ? 'Building agency CDN ZIP'
        : assetMode === 'embed'
          ? 'Building agency embed ZIP'
          : 'Building agency base ZIP';
    get().setStatus(statusLabel);
    const state = get();
    const creativeDocument = state.creativeDocument
      ? {
          ...state.creativeDocument,
          feed: {
            ...state.creativeDocument.feed,
            sampleRows: state.feedDraft.rows?.length
              ? state.feedDraft.rows
              : state.creativeDocument.feed.sampleRows,
          },
        }
      : null;
    const response = await fetch(withCampaign('/api/creative/base-package', state.activeCampaignId), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaign: state.activeCampaignId,
        ...(creativeDocument ? { document: creativeDocument } : {}),
        ...(assetMode !== 'packaged' ? { assetMode } : {}),
        renderMode,
      }),
    });
    if (!response.ok) {
      let message = response.statusText || 'Failed to export base ZIP';
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // ZIP route errors are JSON, but keep a useful fallback for network failures.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    if (!blob.size) throw new Error('Base ZIP was empty');
    const url = window.URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    const slug = get().exportSlug();
    anchor.href = url;
    anchor.download = assetMode === 'cdn'
      ? `${slug}_base_cdn_zip.zip`
      : assetMode === 'embed'
        ? `${slug}_base_embed_zip.zip`
        : `${slug}_base_zip${renderMode === 'outline' ? '_outlines' : ''}.zip`;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    get().setStatus(
      renderMode === 'outline'
        ? 'Downloaded outlined base ZIP'
        : assetMode === 'cdn'
          ? 'Downloaded agency CDN ZIP'
          : assetMode === 'embed'
            ? 'Downloaded agency embed ZIP'
            : 'Downloaded agency base ZIP',
    );
  },

  viewHtml: () => {
    const state = get();
    if (!state.size) return;
    const url = withCampaign(`/api/creative/${encodeURIComponent(state.size)}/view`, state.activeCampaignId);
    if (!state.creativeDocument) {
      window.open(url, '_blank', 'noopener,noreferrer');
      get().setStatus(`Opened exported ${state.size} HTML preview`);
      return;
    }

    const creativeDocument = {
      ...state.creativeDocument,
      feed: {
        ...state.creativeDocument.feed,
        sampleRows: state.feedDraft.rows?.length ? state.feedDraft.rows : state.creativeDocument.feed.sampleRows,
      },
    };
    const targetName = `sse-dco-html-preview-${Date.now()}`;
    const previewWindow = window.open('about:blank', targetName);
    const form = window.document.createElement('form');
    const input = window.document.createElement('input');
    form.method = 'POST';
    form.action = url;
    form.target = previewWindow ? targetName : '_blank';
    form.style.display = 'none';
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify({
      document: creativeDocument,
      row: selectedFeedRowFromState(state),
    });
    form.appendChild(input);
    window.document.body.appendChild(form);
    form.submit();
    form.remove();
    get().setStatus(`Opened ${state.size} HTML preview from current editor state`);
  },

  fetchHtmlInspectorSource: async () => {
    const state = get();
    if (!state.size) throw new Error('No ad size selected');
    const url = withCampaign(`/api/creative/${encodeURIComponent(state.size)}/source`, state.activeCampaignId);
    if (!state.creativeDocument) {
      return api(url);
    }
    const creativeDocument = {
      ...state.creativeDocument,
      feed: {
        ...state.creativeDocument.feed,
        sampleRows: state.feedDraft.rows?.length ? state.feedDraft.rows : state.creativeDocument.feed.sampleRows,
      },
    };
    return api(url, {
      method: 'POST',
      body: JSON.stringify({ document: creativeDocument, campaign: state.activeCampaignId }),
    });
  },

  openHtmlInspector: async () => {
    set({ htmlInspectorOpen: true, htmlInspectorLoading: true, htmlInspectorPayload: null });
    try {
      const payload = await get().fetchHtmlInspectorSource();
      set({ htmlInspectorPayload: payload, htmlInspectorLoading: false });
      get().setStatus(`Loaded ${payload.lineCount?.toLocaleString?.() || payload.lineCount} lines of HTML`);
    } catch (error) {
      set({ htmlInspectorOpen: false, htmlInspectorLoading: false, htmlInspectorPayload: null });
      throw error;
    }
  },

  refreshHtmlInspector: async () => {
    set({ htmlInspectorLoading: true });
    try {
      const payload = await get().fetchHtmlInspectorSource();
      set({ htmlInspectorPayload: payload, htmlInspectorLoading: false });
      get().setStatus('Refreshed HTML source');
    } catch (error) {
      set({ htmlInspectorLoading: false });
      throw error;
    }
  },

  closeHtmlInspector: () => set({
    htmlInspectorOpen: false,
    htmlInspectorLoading: false,
  }),

  copyHtmlInspector: async () => {
    const html = get().htmlInspectorPayload?.html;
    if (!html) throw new Error('No HTML source loaded');
    await navigator.clipboard.writeText(html);
    get().setStatus('Copied HTML to clipboard');
  },

  saveCreativeDocument: async () => {
    const state = get();
    if (!state.creativeDocument) return;
    get().setStatus('Saving creative document');
    const document = {
      ...state.creativeDocument,
      feed: {
        ...state.creativeDocument.feed,
        sampleRows: state.feedDraft.rows?.length ? state.feedDraft.rows : state.creativeDocument.feed.sampleRows,
      },
    };
    const payload = await api(withCampaign('/api/creative', state.activeCampaignId), {
      method: 'POST',
      body: JSON.stringify(document),
    });
    set({ creativeDocument: payload, creativeDirty: false });
    get().setStatus('Saved creative document');
  },

  updateSelectedFeedField: (fieldName, value) => {
    const state = get();
    const feedDraft = updateFeedDraftField(state.feedDraft, state.feedFields, fieldName, value);
    set({ feedDraft, saveFeedDisabled: false });
    get().syncControlsFromFeedRow();
    get().setStatus('Unsaved sample values', 'warn');
  },

  clearFocusFeedFieldRequest: () => set({ focusFeedFieldRequest: null }),

  setFeedRowIndex: (index) => {
    set((state) => ({
      feedDraft: { ...state.feedDraft, selectedIndex: index },
    }));
    get().syncControlsFromFeedRow();
  },

  setVariantControl: (field, value) => {
    const state = get();
    const feedDraft = selectFeedDraftVariant(state.feedDraft, state.feedFields, field, value);
    const selectedExistingRow = feedDraft.rows === state.feedDraft.rows;
    set({
      feedDraft,
      saveFeedDisabled: selectedExistingRow ? state.saveFeedDisabled : false,
    });
    get().syncControlsFromFeedRow();
    get().setStatus(selectedExistingRow ? 'Loaded sample row' : 'Unsaved sample values', selectedExistingRow ? '' : 'warn');
  },

  setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),

  stepCanvasZoom: (direction) => {
    const state = get();
    set({ canvasZoom: nextZoomLevel(state.canvasZoom, direction) });
  },

  applyPreviewTextFitting: (stageEl) => {
    const state = get();
    if (!stageEl || !state.creativeDocument) return;
    // Fit against authored boxes → symbol ink-align → gap/plus layout.
    // Layout must not rewrite subline width (that is the fit constraint).
    // placePlus measures at motion rest, so the playhead (default ~19% / fadeUp
    // enter) cannot bake enter_dy into durable plus left/top.
    const { sizes, trackings, clipped } = applyTextFitting(stageEl, creativeFitRules(state));
    alignOfferValueSymbols(stageEl);
    layoutOffers(stageEl);
    set({ fitResults: sizes, fitTrackings: trackings, fitClipped: clipped });
  },

  init: async () => {
    const session = readEditorSession();
    await get().loadCampaigns();
    const campaigns = get().campaigns || [];
    const campaignIds = new Set(campaigns.map((entry) => entry.id));
    const campaignId = campaignIds.has(session.campaignId)
      ? session.campaignId
      : (campaignIds.has(get().activeCampaignId) ? get().activeCampaignId : 'sse-dco');
    if (campaignId !== get().activeCampaignId) {
      set({ activeCampaignId: campaignId });
    }
    writeEditorSession({ campaignId });
    await Promise.all([
      get().loadFeedSchema(),
      get().loadCreativeDocument(),
    ]);
    const document = get().creativeDocument;
    const sizes = Object.keys(document?.sizes || {}).sort();
    set({ sizes });
    const preferred = sizes.includes(session.size)
      ? session.size
      : (sizes.includes(get().size) ? get().size : (sizes.includes('300x600') ? '300x600' : sizes[0]));
    if (preferred) await get().loadSize(preferred);
    get().setStatus('Ready');
  },
}));
