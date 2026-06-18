// @ts-nocheck
'use client';

import { useMemo, useState } from 'react';

import { EditorIcon } from '@/components/EditorIcon';
import { animationFamilyForLayer, timelineSpanForClip } from '@/lib/animation-intents';
import { compileAnimationClips } from '@/lib/creative-compiler';
import { currentSizeCreative } from '@/lib/creative-model';
import { activeOfferMemberIds } from '@/lib/offer-interaction-model';
import {
  OFFERS_BLOCK_ID,
  targetMatchesSelection,
} from '@/lib/selection-groups';
import {
  buildTimelineEntries,
  offerLayerVariantState,
  timelineLayerLabel,
} from '@/lib/timeline-rows';
import { beatsForScopes } from '@/lib/timing-profiles';
import { activeScopesFromControls } from '@/lib/feed-model';
import { PlayheadReadout } from '@/components/PlayheadReadout';
import { useEditorStore } from '@/store/editor-store';

const roundTimelinePercent = (value) => Math.round(value * 10) / 10;

const percentFromClientX = (trackEl, clientX) => {
  const rect = trackEl.getBoundingClientRect();
  if (!rect.width) return 0;
  return roundTimelinePercent(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
};

const keyframeKind = (keyframe) => {
  if (keyframe.scale !== undefined) return 'scale';
  if (keyframe.translate) return 'transform';
  if (keyframe.opacity !== undefined) return 'opacity';
  return 'hold';
};

const keyframeLabel = (keyframe, boundary = '') => {
  const parts = [];
  if (boundary) parts.push(boundary);
  parts.push(`${keyframe.at}%`);
  if (keyframe.translate) parts.push(`move ${keyframe.translate[0]}, ${keyframe.translate[1]}`);
  if (keyframe.scale !== undefined) parts.push(`scale ${keyframe.scale}`);
  if (keyframe.opacity !== undefined) parts.push(`opacity ${keyframe.opacity}`);
  return parts.join(' · ');
};

function TimelineClipBar({
  layer,
  clip,
  beats,
  selectedClipId,
  setPercent,
  onSelectClip,
  onUpdateClipValue,
  dimmed = false,
}) {
  const span = timelineSpanForClip(clip, beats);
  const start = span.start;
  const end = span.end;
  const duration = Math.max(1, end - start);
  const keyframes = compileAnimationClips([clip], beats).filter((keyframe) => (
    keyframe.at >= start - 0.05 && keyframe.at <= end + 0.05
  ));
  const family = animationFamilyForLayer(layer);
  const selectClip = () => onSelectClip(layer.id, clip.id);
  const updateBoundary = (field, nextValue) => {
    const bounded = field === 'start'
      ? Math.min(end - 0.5, Math.max(0, nextValue))
      : Math.max(start + 0.5, Math.min(100, nextValue));
    onUpdateClipValue(layer.id, clip.id, field, roundTimelinePercent(bounded));
  };

  const onBoundaryPointerDown = (field, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectClip();
    const trackEl = event.currentTarget.closest('.timeline-track');
    if (!trackEl) return;
    let nextValue = field === 'start' ? start : end;
    setPercent(nextValue);

    const onMove = (moveEvent) => {
      const raw = percentFromClientX(trackEl, moveEvent.clientX);
      nextValue = field === 'start'
        ? Math.min(end - 0.5, Math.max(0, raw))
        : Math.max(start + 0.5, Math.min(100, raw));
      setPercent(nextValue);
    };
    const onUp = () => {
      updateBoundary(field, nextValue);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };

  const onKeyframePointerDown = (keyframe, boundary, event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectClip();
    const trackEl = event.currentTarget.closest('.timeline-track');
    let nextValue = roundTimelinePercent(keyframe.at);
    setPercent(nextValue);

    const onMove = (moveEvent) => {
      if (!trackEl) return;
      nextValue = percentFromClientX(trackEl, moveEvent.clientX);
      setPercent(nextValue);
    };
    const onUp = () => {
      if (boundary === 'start') updateBoundary('start', nextValue);
      if (boundary === 'end') updateBoundary('end', nextValue);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };

  return (
    <div
      key={clip.id}
      role="button"
      tabIndex={0}
      className={[
        'clip-bar',
        `intent-${span.intentId}`,
        `family-${family.id}`,
        span.linked ? 'is-linked-motion' : 'is-unlinked-motion',
        selectedClipId === clip.id ? 'is-selected' : '',
        dimmed ? 'is-dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: `${start}%`,
        width: `${Math.max(2, end - start)}%`,
      }}
      data-tip={`${clip.label || clip.id}: ${span.label}, ${start}%–${end}%`}
      aria-label={`${layer.label || layer.id} ${clip.label || clip.id}`}
      onClick={(event) => {
        event.stopPropagation();
        selectClip();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectClip();
      }}
    >
      <button
        type="button"
        className="clip-edge clip-edge-start"
        aria-label={`Drag start of ${clip.label || clip.id}`}
        data-tip={`Drag start: ${start}%`}
        onPointerDown={(event) => onBoundaryPointerDown('start', event)}
      />
      <span>{span.label}</span>
      {keyframes.map((keyframe, index) => {
        const boundary = Math.abs(keyframe.at - start) < 0.05
          ? 'start'
          : Math.abs(keyframe.at - end) < 0.05
            ? 'end'
            : '';
        const kind = keyframeKind(keyframe);
        return (
          <button
            type="button"
          key={`${clip.id}-${keyframe.at}-${index}`}
            className={[
              'keyframe-dot',
              `keyframe-${kind}`,
              boundary ? `keyframe-${boundary}` : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${Math.min(100, Math.max(0, ((keyframe.at - start) / duration) * 100))}%` }}
            data-tip={keyframeLabel(keyframe, boundary)}
            aria-label={keyframeLabel(keyframe, boundary)}
            onClick={(event) => {
              event.stopPropagation();
              selectClip();
              setPercent(roundTimelinePercent(keyframe.at));
            }}
            onPointerDown={(event) => onKeyframePointerDown(keyframe, boundary, event)}
          />
        );
      })}
      <button
        type="button"
        className="clip-edge clip-edge-end"
        aria-label={`Drag end of ${clip.label || clip.id}`}
        data-tip={`Drag end: ${end}%`}
        onPointerDown={(event) => onBoundaryPointerDown('end', event)}
      />
    </div>
  );
}

function TimelineLayerRow({
  layer,
  offerCount,
  beats,
  selectedLayerId,
  selectedTargetId,
  selectedTargetIds,
  selectedClipId,
  isolatedGroupId,
  nested = false,
  setPercent,
  onSelectLayer,
  onSelectClip,
  onUpdateClipValue,
  onMoveLayerZ,
  onMoveLayerPointerDragStart,
  draggingLayerId = '',
  dropTargetLayerId = '',
  activeOfferIds = null,
}) {
  const layerId = layer.id;
  const variantState = offerLayerVariantState(layerId, offerCount, activeOfferIds);
  const dimmed = variantState === 'inactive';
  const selected = targetMatchesSelection(
    layerId,
    selectedTargetId,
    selectedTargetIds,
    offerCount,
    isolatedGroupId,
  ) || (selectedLayerId === layerId && selectedTargetId === layerId);
  const label = timelineLayerLabel(layer, offerCount, activeOfferIds);

  return (
    <div
      className={[
        'timeline-row',
        nested ? 'timeline-row-nested' : '',
        selected ? 'is-selected' : '',
        dimmed ? 'is-variant-inactive' : '',
        variantState === 'active' ? 'is-variant-active' : '',
        draggingLayerId === layerId ? 'is-dragging-layer' : '',
        dropTargetLayerId === layerId ? 'is-drop-target' : '',
      ].filter(Boolean).join(' ')}
      data-layer-id={layerId}
      onClick={() => onSelectLayer(layerId)}
    >
      <div className="timeline-row-label">
        {!dimmed ? (
          <button
            type="button"
            className="timeline-drag-handle"
            aria-label={`Drag ${label} to reorder`}
            data-tip="Drag to reorder layer"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => onMoveLayerPointerDragStart(event, layerId)}
          >
            <EditorIcon name="drag" size={12} />
          </button>
        ) : null}
        <span className="timeline-row-name">{label}</span>
        {!dimmed ? (
          <span className="timeline-sort-controls" aria-label={`${label} z-order controls`}>
            <button
              type="button"
              aria-label={`Send ${label} backward`}
              data-tip={`Send ${label} backward`}
              onClick={(event) => {
                event.stopPropagation();
                onMoveLayerZ(layerId, -1);
              }}
            >
              <EditorIcon name="layerDown" size={12} />
            </button>
            <button
              type="button"
              aria-label={`Bring ${label} forward`}
              data-tip={`Bring ${label} forward`}
              onClick={(event) => {
                event.stopPropagation();
                onMoveLayerZ(layerId, 1);
              }}
            >
              <EditorIcon name="layerUp" size={12} />
            </button>
          </span>
        ) : null}
      </div>
      {!dimmed ? (
        <div className="timeline-track">
          {(layer.clips || []).map((clip) => (
            <TimelineClipBar
              key={clip.id}
              layer={layer}
              clip={clip}
              beats={beats}
              selectedClipId={selectedClipId}
              setPercent={setPercent}
              onSelectClip={onSelectClip}
              onUpdateClipValue={onUpdateClipValue}
              dimmed={false}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TimelinePanel() {
  const document = useEditorStore((s) => s.creativeDocument);
  const size = useEditorStore((s) => s.size);
  const percent = useEditorStore((s) => s.percent);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const includeRoundelFrame = useEditorStore((s) => s.includeRoundelFrame);
  const frameCount = useEditorStore((s) => s.frameCount);
  const roundelMode = useEditorStore((s) => s.roundelMode);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedTargetIds = useEditorStore((s) => s.selectedTargetIds);
  const isolatedGroupId = useEditorStore((s) => s.isolatedGroupId);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const moveLayerToZIndex = useEditorStore((s) => s.moveLayerToZIndex);
  const setPercent = useEditorStore((s) => s.setPercent);
  const selectTimelineLayer = useEditorStore((s) => s.selectTimelineLayer);
  const selectOffersBlock = useEditorStore((s) => s.selectOffersBlock);
  const selectClip = useEditorStore((s) => s.selectClip);
  const updateClipValue = useEditorStore((s) => s.updateCreativeLayerClipValue);
  const moveLayerZ = useEditorStore((s) => s.moveLayerZ);
  const [draggingLayerId, setDraggingLayerId] = useState('');
  const [dropTargetLayerId, setDropTargetLayerId] = useState('');

  const sizeCreative = currentSizeCreative(document, size);
  const activeScopes = useMemo(() => activeScopesFromControls({
    offerCount,
    tcMode,
    ctaShape,
    includeRoundelFrame,
    frameCount,
    roundelMode,
  }), [ctaShape, frameCount, includeRoundelFrame, offerCount, roundelMode, tcMode]);
  const beats = beatsForScopes(document, activeScopes);
  const seconds = document?.clock?.durationS ? (percent / 100) * document.clock.durationS : 0;
  const activeOfferIds = activeOfferMemberIds(document, size, activeScopes);
  const timelineActiveOfferIds = activeOfferIds.length ? activeOfferIds : null;
  const zOrderedLayers = [...(sizeCreative?.layers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const zOrderedLayerIds = zOrderedLayers.map((layer) => layer.id);
  const entries = buildTimelineEntries(zOrderedLayers, Number(offerCount), {
    activeOfferMemberIds: timelineActiveOfferIds,
  });
  const offersGroupSelected = selectedTargetId === OFFERS_BLOCK_ID && isolatedGroupId !== OFFERS_BLOCK_ID;

  const onSelectLayer = (layerId) => selectTimelineLayer(layerId);
  const onSelectClip = (layerId, clipId) => selectClip(layerId, clipId);
  const onMoveLayerZ = (layerId, direction) => moveLayerZ(layerId, direction);
  const finishLayerDrag = () => {
    setDraggingLayerId('');
    setDropTargetLayerId('');
  };
  const targetIndexFromLayerRect = (clientY, sourceLayerId, targetLayerId, rect) => {
    const sourceIndex = zOrderedLayerIds.indexOf(sourceLayerId);
    const targetIndex = zOrderedLayerIds.indexOf(targetLayerId);
    if (sourceIndex < 0 || targetIndex < 0) return -1;
    const dropAfter = clientY > rect.top + rect.height / 2;
    let nextIndex = targetIndex + (dropAfter ? 1 : 0);
    if (sourceIndex < nextIndex) nextIndex -= 1;
    return nextIndex;
  };
  const onMoveLayerPointerDragStart = (event, layerId) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setDraggingLayerId(layerId);
    setDropTargetLayerId('');
    let latestTargetId = '';
    let latestTargetRect = null;
    let latestClientY = event.clientY;

    const onMove = (moveEvent) => {
      latestClientY = moveEvent.clientY;
      const row = window.document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest('.layer-row[data-layer-id], .timeline-row[data-layer-id]');
      const targetLayerId = row?.getAttribute('data-layer-id') || '';
      if (!targetLayerId || targetLayerId === layerId || !zOrderedLayerIds.includes(targetLayerId)) {
        latestTargetId = '';
        latestTargetRect = null;
        setDropTargetLayerId('');
        return;
      }
      latestTargetId = targetLayerId;
      latestTargetRect = row.getBoundingClientRect();
      setDropTargetLayerId(targetLayerId);
    };

    const onUp = () => {
      if (latestTargetId && latestTargetRect) {
        const nextIndex = targetIndexFromLayerRect(latestClientY, layerId, latestTargetId, latestTargetRect);
        if (nextIndex >= 0) moveLayerToZIndex(layerId, nextIndex);
      }
      finishLayerDrag();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onUp, { once: true });
  };
  const scrubToClientX = (trackEl, clientX) => {
    const rect = trackEl.getBoundingClientRect();
    if (!rect.width) return;
    const next = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPercent(Math.round(next * 10) / 10);
  };

  const onTrackScrubPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const trackEl = event.currentTarget;
    scrubToClientX(trackEl, event.clientX);

    const onMove = (moveEvent) => {
      scrubToClientX(trackEl, moveEvent.clientX);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <section className="timeline-panel" aria-label="Timeline">
      <div className="timeline-head">
        <div className="timeline-head-readout">
          <span className="panel-kicker">Timeline</span>
          <PlayheadReadout seconds={seconds} percent={percent} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percent}
          aria-label="Timeline scrubber"
          onChange={(event) => setPercent(Number(event.target.value))}
        />
        <div className="timeline-legend" aria-label="Timeline mark legend">
          <span><i className="legend-mark legend-edge" /> Edge</span>
          <span><i className="legend-mark legend-transform" /> Move</span>
          <span><i className="legend-mark legend-opacity" /> Fade</span>
          <span><i className="legend-mark legend-scale" /> Scale</span>
        </div>
      </div>
      <div className="timeline-body">
        <div className="tl-grid-row timeline-ruler-row">
          <div className="timeline-row-label timeline-ruler-spacer">Timeline</div>
          <div className="timeline-tracks-column">
            <div
              className="timeline-ruler"
              onPointerDown={onTrackScrubPointerDown}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label="Timeline ruler"
            >
              {[0, 25, 50, 75, 100].map((tick) => (
                <span key={tick} style={{ left: `${tick}%` }}>{tick}%</span>
              ))}
            </div>
          </div>
        </div>
        <div className="timeline-playhead-layer tl-grid-row" aria-hidden="true">
          <div />
          <div className="timeline-tracks-column">
            <div className="timeline-playhead" style={{ left: `${percent}%` }} />
          </div>
        </div>
        {entries.map((entry) => {
          if (entry.kind === 'offers-group') {
            return (
              <div key={entry.id} className="timeline-group">
                <div
                  className={[
                    'timeline-row',
                    'timeline-row-group',
                    offersGroupSelected ? 'is-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => selectOffersBlock()}
                >
                  <div className="timeline-row-label">{entry.label}</div>
                  <div className="timeline-track timeline-track-group" aria-hidden="true" />
                </div>
                <div className="timeline-group-children">
                  {entry.layers.map((layer) => (
                    <TimelineLayerRow
                      key={layer.id}
                      layer={layer}
                      offerCount={Number(offerCount)}
                      activeOfferIds={timelineActiveOfferIds}
                      beats={beats}
                      selectedLayerId={selectedLayerId}
                      selectedTargetId={selectedTargetId}
                      selectedTargetIds={selectedTargetIds}
                      selectedClipId={selectedClipId}
                      isolatedGroupId={isolatedGroupId}
                      nested
                      setPercent={setPercent}
                      onSelectLayer={onSelectLayer}
                      onSelectClip={onSelectClip}
                      onUpdateClipValue={updateClipValue}
                      onMoveLayerZ={onMoveLayerZ}
                      onMoveLayerPointerDragStart={onMoveLayerPointerDragStart}
                      draggingLayerId={draggingLayerId}
                      dropTargetLayerId={dropTargetLayerId}
                    />
                  ))}
                </div>
                {entry.hiddenLayers?.length ? (
                  <details className="timeline-group-inactive">
                    <summary>Alt / hidden</summary>
                    {entry.hiddenLayers.map((layer) => (
                        <TimelineLayerRow
                          key={layer.id}
                          layer={layer}
                          offerCount={Number(offerCount)}
                          activeOfferIds={timelineActiveOfferIds}
                          beats={beats}
                          selectedLayerId={selectedLayerId}
                          selectedTargetId={selectedTargetId}
                          selectedTargetIds={selectedTargetIds}
                         selectedClipId={selectedClipId}
                          isolatedGroupId={isolatedGroupId}
                          nested
                          setPercent={setPercent}
                          onSelectLayer={onSelectLayer}
                          onSelectClip={onSelectClip}
                          onUpdateClipValue={updateClipValue}
                          onMoveLayerZ={onMoveLayerZ}
                          onMoveLayerPointerDragStart={onMoveLayerPointerDragStart}
                          draggingLayerId={draggingLayerId}
                          dropTargetLayerId={dropTargetLayerId}
                        />
                      ))}
                  </details>
                ) : null}
              </div>
            );
          }

          const layer = entry.layer;
          return (
            <TimelineLayerRow
              key={layer.id}
              layer={layer}
              offerCount={Number(offerCount)}
              activeOfferIds={timelineActiveOfferIds}
              beats={beats}
              selectedLayerId={selectedLayerId}
              selectedTargetId={selectedTargetId}
              selectedTargetIds={selectedTargetIds}
              selectedClipId={selectedClipId}
              isolatedGroupId={isolatedGroupId}
              setPercent={setPercent}
              onSelectLayer={onSelectLayer}
              onSelectClip={onSelectClip}
              onUpdateClipValue={updateClipValue}
              onMoveLayerZ={onMoveLayerZ}
              onMoveLayerPointerDragStart={onMoveLayerPointerDragStart}
              draggingLayerId={draggingLayerId}
              dropTargetLayerId={dropTargetLayerId}
            />
          );
        })}
      </div>
    </section>
  );
}
