// @ts-nocheck
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';

import {TimelineTransition} from './TimelineTransition';
import {TimelineBeats} from './TimelineBeats';
import {motionTransitions} from '@/lib/motion-transitions';
import {beatLabel} from '@/lib/timeline-beats';
import {editableKeyframes,retimeClip} from '@/lib/keyframe-editing';
import { EditorIcon } from '@/components/EditorIcon';
import { animationFamilyForLayer, timelineSpanForClip } from '@/lib/animation-intents';
import { compileAnimationClips } from '@/lib/creative-compiler';
import { currentSizeCreative } from '@/lib/creative-model';
import {transitionCases,layoutSequenceCases} from '@/lib/layout-transitions';
import { clipsForProfile } from '@/lib/headline-motion';
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
import { beatsForScopes, activeFrameScope } from '@/lib/timing-profiles';
import { campaignScopes } from '@/lib/campaign-variants';
import { PlayheadReadout } from '@/components/PlayheadReadout';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';

const roundTimelinePercent = (value) => Math.round(value * 10) / 10;

const percentFromClientX = (trackEl, clientX) => {
  const rect = trackEl.getBoundingClientRect();
  if (!rect.width) return 0;
  return roundTimelinePercent(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
};

const keyframeKind = (frame,previous={scale:1,translate:[0,0],opacity:1}) => {
  if(frame.scale!==undefined&&JSON.stringify(frame.scale)!==JSON.stringify(previous.scale))return 'scale';
  if(frame.translate&&JSON.stringify(frame.translate)!==JSON.stringify(previous.translate)||['left','top','width','height'].some(k=>frame[k]!==previous[k]))return 'transform';
  if(frame.opacity!==undefined&&frame.opacity!==previous.opacity)return 'opacity';
  return 'hold';
};

const keyframeLabel = (keyframe, boundary = '') => {
  const parts = [];
  if (boundary) parts.push(boundary);
  parts.push(`${keyframe.at}%`);
  if (keyframe.translate) parts.push(`move ${keyframe.translate[0]}, ${keyframe.translate[1]}`);
  if (keyframe.scale !== undefined) parts.push(`scale ${keyframe.scale}`);
  if (keyframe.opacity !== undefined) parts.push(`opacity ${keyframe.opacity}`);
  for(const key of ['left','top','width','height'])if(keyframe[key]!==undefined)parts.push(`${key}: ${keyframe[key]}`);
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
  const document = useEditorStore(s => s.creativeDocument);
  const size = useEditorStore(s => s.size);
  const canvas = document?.sizes?.[size]?.canvas;
  const context = useMemo(()=>({ canvas, parent: canvas, durationS: document?.clock?.durationS }),[canvas,document?.clock?.durationS]);
  const transitions = useMemo(()=>motionTransitions(clip,beats,context),[clip,beats,context]);
  const span = timelineSpanForClip(clip, beats, context.durationS);
  const start = span.start;
  const end = span.end;
  const duration = Math.max(1, end - start);
  const keyframes = useMemo(()=>editableKeyframes(clip, beats, context).map(k=>({...k.frame,at:k.at,editorIndex:k.index})).filter((keyframe) => (
    keyframe.at >= start - 0.05 && keyframe.at <= end + 0.05
  )),[clip,beats,context,start,end]);
  const selectedFrame=useEditorStore(s=>s.selectedKeyframe);
  const view=useEditorStore(s=>s.motionView);
  const dragged=useRef(false);
  const [dragPreview,setDragPreview]=useState(null);
  const [clipPreview,setClipPreview]=useState(null);
  const chooseFrame=frame=>useEditorStore.getState().selectKeyframe(layer.id,clip.id,frame.editorIndex,frame.at);
  const family = animationFamilyForLayer(layer);
  const selectClip = () => onSelectClip(layer.id, clip.id);
  const updateBoundary = (field, nextValue) => {
    const bounded=field==='start'?Math.min(end-.5,Math.max(0,nextValue)):Math.max(start+.5,Math.min(100,nextValue));
    const raw=layer.clips.find(c=>c.id===clip.id)||clip;
    try{useEditorStore.getState().replaceEditorClip(layer.id,clip.id,retimeClip(raw,field==='start'?bounded:start,field==='end'?bounded:end,beats,context));}catch(error){useEditorStore.getState().setStatus(error.message,'error');}
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
    if(event.button!==0)return;event.preventDefault();event.stopPropagation();chooseFrame(keyframe);dragged.current=false;
    const trackEl=event.currentTarget.closest('.timeline-track'),startX=event.clientX;
    const all=editableKeyframes(clip,beats,context),position=all.findIndex(f=>f.index===keyframe.editorIndex);
    const lower=position>0?all[position-1].at+.01:0,upper=position<all.length-1?all[position+1].at-.01:100;
    let next=keyframe.at;
    const move=e=>{if(!trackEl)return;if(Math.abs(e.clientX-startX)>2)dragged.current=true;next=Math.max(lower,Math.min(upper,percentFromClientX(trackEl,e.clientX)));setDragPreview({index:keyframe.editorIndex,at:next});setPercent(next);};
    const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);};
    const up=()=>{cleanup();setDragPreview(null);if(dragged.current)try{useEditorStore.getState().editSelectedKeyframe({at:next});}catch(error){useEditorStore.getState().setStatus(error.message,'error');}};
    const cancel=()=>{cleanup();setDragPreview(null);setPercent(keyframe.at);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
  };

  const moveClip=event=>{
    if(event.button!==0||event.target.closest('button'))return;event.preventDefault();event.stopPropagation();selectClip();
    const track=event.currentTarget.closest('.timeline-track');if(!track)return;
    const startX=event.clientX,width=track.getBoundingClientRect().width,span=end-start;let next=start,moved=false;
    const move=e=>{if(Math.abs(e.clientX-startX)>2)moved=true;next=Math.max(0,Math.min(100-span,start+(e.clientX-startX)/width*100));setClipPreview({start:next,end:next+span});setPercent(next);};
    const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);setClipPreview(null);};
    const up=()=>{cleanup();if(moved)try{const raw=layer.clips.find(c=>c.id===clip.id)||clip;useEditorStore.getState().replaceEditorClip(layer.id,clip.id,retimeClip(raw,next,next+span,beats,context));}catch(error){useEditorStore.getState().setStatus(error.message,'error');}};
    const cancel=()=>{cleanup();setPercent(start);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});window.addEventListener('pointercancel',cancel,{once:true});
  };

  if(view!=='keyframes')return <>{transitions.map(t=><TimelineTransition key={`${clip.id}:${t.id}`} layer={layer} clip={clip} transition={t} beats={beats} context={context}/>)}</>;
  return (
    <div
      key={clip.id}
      role="button"
      tabIndex={0}
      className={[
        'clip-bar',
        `intent-${span.intentId}`,
        `family-${family.id}`,
        selectedClipId === clip.id ? 'is-selected' : '',
        dimmed ? 'is-dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: `${clipPreview?.start??start}%`,
        width: `${Math.max(2, end - start)}%`,
      }}
      title={`${clip.label || clip.id}: ${span.label}, ${start}%–${end}%`}
      aria-label={`${layer.label || layer.id} ${clip.label || clip.id}`}
      onPointerDown={moveClip}
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
        const kind = keyframeKind(keyframe,keyframes[index-1]);
        return (
          <button
            type="button"
          key={`${clip.id}-${keyframe.at}-${index}`}
            className={[
              'keyframe-dot',
              selectedFrame?.layerId===layer.id&&selectedFrame?.clipId===clip.id&&selectedFrame?.index===keyframe.editorIndex?'is-selected':'',
              `keyframe-${kind}`,
              boundary ? `keyframe-${boundary}` : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${Math.min(100, Math.max(0, (((dragPreview?.index===keyframe.editorIndex?dragPreview.at:keyframe.at) - start) / duration) * 100))}%` }}
            title={keyframeLabel(keyframe, boundary)}
            aria-label={keyframeLabel(keyframe, boundary)}
            onClick={(event) => {
              event.stopPropagation();
              if(dragged.current){dragged.current=false;return;}chooseFrame(keyframe);
            }}
            aria-pressed={selectedFrame?.layerId===layer.id&&selectedFrame?.clipId===clip.id&&selectedFrame?.index===keyframe.editorIndex}
            onKeyDown={event=>{if(['Delete','Backspace'].includes(event.key)){event.preventDefault();event.stopPropagation();chooseFrame(keyframe);try{useEditorStore.getState().removeSelectedKeyframe();}catch(error){useEditorStore.getState().setStatus(error.message,'error');}return;}if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();chooseFrame(keyframe);try{useEditorStore.getState().editSelectedKeyframe({at:keyframe.at+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?1:.1)});}catch(error){useEditorStore.getState().setStatus(error.message,'error');}}}
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
  frameScope,
  activeScopes = [],
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
  const visibleClips = clipsForProfile(layer.clips || [], frameScope, activeScopes);

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
          {visibleClips.map((clip) => (
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
  const previewRow = useEditorStore(selectPreviewFeedRow);
  const size = useEditorStore((s) => s.size);
  const percent = useEditorStore((s) => s.percent);
  const isPlaying = useEditorStore((s) => s.isPlaying);
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
  const togglePlaying = useEditorStore((s) => s.togglePlaying);
  const selectTimelineLayer = useEditorStore((s) => s.selectTimelineLayer);
  const selectOffersBlock = useEditorStore((s) => s.selectOffersBlock);
  const selectClip = useEditorStore((s) => s.selectClip);
  const updateClipValue = useEditorStore((s) => s.updateCreativeLayerClipValue);
  const moveLayerZ = useEditorStore((s) => s.moveLayerZ);
  const [showBeats,setShowBeats]=useState(false),[manageBeats,setManageBeats]=useState(false);
  const motionView=useEditorStore(s=>s.motionView);
  const [draggingLayerId, setDraggingLayerId] = useState('');
  const [dropTargetLayerId, setDropTargetLayerId] = useState('');

  const sizeCreative = currentSizeCreative(document, size);
  const activeScopes = useMemo(() => campaignScopes(document, previewRow), [document, previewRow]);
  const beats = useMemo(()=>beatsForScopes(document, activeScopes),[document,activeScopes]);
  const frameScope = activeFrameScope(activeScopes);
  const durationS = Number(document?.clock?.durationS) || 15;
  const seconds = (percent / 100) * durationS;

  useEffect(() => {
    if (!isPlaying) return undefined;
    let frameId = 0;
    let lastTs = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;
      const current = useEditorStore.getState().percent;
      const next = current + (dt / durationS) * 100;
      if (next >= 100) {
        useEditorStore.getState().setPercent(0, { pause: false });
      } else {
        useEditorStore.getState().setPercent(Math.round(next * 10) / 10, { pause: false });
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [durationS, isPlaying]);
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
          <button
            type="button"
            className="timeline-play-btn"
            aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            data-tip={isPlaying ? 'Pause' : 'Play'}
            onClick={() => togglePlaying()}
          >
            <EditorIcon name={isPlaying ? 'pause' : 'play'} size={14} />
          </button>
          <span className="panel-kicker">Timeline</span>
          <PlayheadReadout seconds={seconds} percent={percent} />
        </div>
        <div className="timeline-controls">
          <button aria-pressed={motionView==='keyframes'} onClick={()=>useEditorStore.setState({motionView:motionView==='keyframes'?'transitions':'keyframes'})} title="Switch between transition ranges and individual keyframes">Keyframes</button>
          <button aria-pressed={showBeats} onClick={()=>setShowBeats(!showBeats)}>Beats</button>
          <button onClick={()=>setManageBeats(!manageBeats)} title="Rename beats or add one at the playhead">Edit beats…</button>
        </div>
        <div className="timeline-legend" hidden aria-label="Timeline mark legend">
          <span><i className="legend-mark legend-edge" /> Edge</span>
          <span><i className="legend-mark legend-transform" /> Move</span>
          <span><i className="legend-mark legend-opacity" /> Fade</span>
          <span><i className="legend-mark legend-scale" /> Scale</span>
        </div>
      </div>
      {manageBeats&&document?.clock&&<TimelineBeats document={document} beats={beats} percent={percent} onClose={()=>setManageBeats(false)}/>}
      <div className="timeline-body"><div className="timeline-content">
        <div className="tl-grid-row timeline-scrub-row"><span className="timeline-row-label timeline-ruler-labels"><span>Seconds</span><span>Percent</span></span><div className="timeline-tracks-column">
          <div className="timeline-scrubber timeline-dual-ruler" role="slider" tabIndex={0} aria-label="Timeline scrubber" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} onPointerDown={onTrackScrubPointerDown} onKeyDown={event=>{let at=percent;if(event.key==='Home')at=0;else if(event.key==='End')at=100;else if(event.key==='ArrowLeft')at-=event.shiftKey?5:1;else if(event.key==='ArrowRight')at+=event.shiftKey?5:1;else return;event.preventDefault();setPercent(Math.max(0,Math.min(100,at)));}}>
            {Array.from({length:Math.floor(durationS)+1},(_,i)=>i).map(second=><i key={`s${second}`} className={`ruler-tick ruler-second ${second%5===0?'is-major':''}`} style={{left:`${second/durationS*100}%`}}><b>{second}s</b></i>)}
            {Array.from({length:21},(_,i)=>i*5).map(tick=><i key={`p${tick}`} className={`ruler-tick ruler-percent ${tick%25===0?'is-major':''}`} style={{left:`${tick}%`}}><b>{tick}%</b></i>)}
            <span className="scrub-thumb" style={{left:`${percent}%`}}/>
          </div>
          {showBeats&&<div className="timeline-beat-track">{Object.entries(beats).filter(([,at])=>Number.isFinite(at)&&at>=0&&at<=100).map(([id,at])=><button key={id} className="timeline-beat-marker" style={{left:`${at}%`}} title={`${beatLabel(document,id)} · ${(at*durationS/100).toFixed(2)}s`} aria-label={`Seek to beat ${beatLabel(document,id)}`} onClick={()=>setPercent(at)}>▾</button>)}</div>}
        </div></div>
        <div className="timeline-playhead-layer tl-grid-row" aria-hidden="true">
          <div />
          <div className="timeline-tracks-column">
            <div className="timeline-playhead" style={{ left: `${percent}%` }} />
          </div>
        </div>
        {(document?.layoutRules||[]).filter(rule=>rule.type==='distribute'&&rule.enabled&&(rule.transition||rule.layoutAnimations?.length)&&rule.targets.some(t=>t.size===size)&&(rule.when||[]).every(s=>activeScopes.includes(s))).map(rule=>{
          let events=[],error='';try{
            if(rule.layoutAnimations!==undefined)events=layoutSequenceCases(document,size,rule).find(t=>t.scopes.every(s=>activeScopes.includes(s)))?.events||[];
            else {const t=transitionCases(document,size,rule).find(t=>t.scopes.every(s=>activeScopes.includes(s)));if(t){events=[{id:'exit',kind:'exit',start:t.start,end:t.end}];if(t.returnMode!=='none')events.push({id:'return',kind:'return',hidden:t.returnMode==='hidden',start:t.returnStart,end:t.returnEnd});}}
          }catch(cause){error=cause.message;}
          if(!events.length&&!error)return null;
          const open=(at)=>{const target=rule.targets.find(t=>t.size===size);useEditorStore.getState().setCanvasSelection(target.targetId,[target.targetId]);useEditorStore.setState({layoutRulesOpen:true,selectedLayoutRuleId:rule.id});setPercent(at);};
          return <div key={rule.id} className="timeline-row layout-motion-row"><div className="timeline-row-label"><span className="timeline-row-name">↳ {rule.name}</span></div><div className="timeline-track">
            {error?<button className="timeline-layout-motion is-error" style={{left:0,width:'100%'}} title={error} onClick={()=>open(percent)}>Check layout timing</button>:events.map(e=><button key={e.id} className="timeline-layout-motion" style={{left:`${Math.min(99.6,e.start)}%`,width:`${Math.max(.4,e.end-e.start)}%`}} title={`${e.kind==='enter'?'Make room':e.kind==='exit'?'Rearrange':e.hidden?'Reset':'Return'} ${(e.start*durationS/100).toFixed(2)}–${(e.end*durationS/100).toFixed(2)}s`} onClick={()=>open((e.start+e.end)/2)}>{e.kind==='enter'?'Enter':e.kind==='exit'?'Exit':e.hidden?'Reset':'Return'}</button>)}
          </div></div>;
        })}
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
                      frameScope={frameScope}
                      activeScopes={activeScopes}
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
                          frameScope={frameScope}
                          activeScopes={activeScopes}
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
              frameScope={frameScope}
              activeScopes={activeScopes}
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
      </div></div>
    </section>
  );
}
