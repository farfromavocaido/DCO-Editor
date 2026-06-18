// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';

import { EditorIcon } from '@/components/EditorIcon';
import { editableTargetsForLayer, groupedCreativeLayers, currentSizeCreative, findCreativeTarget, targetIdForLayerChild } from '@/lib/creative-model';
import { isOfferLayerId, offerInteractionTree } from '@/lib/offer-interaction-model';
import { OFFERS_BLOCK_ID, selectionHierarchy } from '@/lib/selection-groups';
import { useEditorStore } from '@/store/editor-store';

const iconForLayer = (layer, hasChildren = false) => {
  if (hasChildren) return 'group';
  if (layer?.kind === 'image') return 'image';
  if (layer?.kind === 'text') return 'text';
  if (layer?.kind === 'shape') return 'shape';
  if (layer?.kind === 'group') return 'group';
  return 'shape';
};

function LayerBadge({ icon, label, tone = '' }) {
  return (
    <span className={`layer-badge ${tone ? `layer-badge-${tone}` : ''}`} data-tip={label} title={label} aria-hidden="true">
      <EditorIcon name={icon} size={13} />
    </span>
  );
}

export function LayerTree() {
  const [menu, setMenu] = useState(null);
  const [draggingLayerId, setDraggingLayerId] = useState('');
  const [dropTargetLayerId, setDropTargetLayerId] = useState('');
  const rowRefs = useRef(new Map());
  const document = useEditorStore((s) => s.creativeDocument);
  const size = useEditorStore((s) => s.size);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectedTargetId = useEditorStore((s) => s.selectedTargetId);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const offerCount = useEditorStore((s) => s.offerCount);
  const tcMode = useEditorStore((s) => s.tcMode);
  const ctaShape = useEditorStore((s) => s.ctaShape);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const selectTarget = useEditorStore((s) => s.selectTarget);
  const selectOffersBlock = useEditorStore((s) => s.selectOffersBlock);
  const lockedLayerIds = useEditorStore((s) => s.lockedLayerIds);
  const hiddenLayerIds = useEditorStore((s) => s.hiddenLayerIds);
  const addAnimationIntent = useEditorStore((s) => s.addAnimationIntent);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const deleteLayer = useEditorStore((s) => s.deleteLayer);
  const toggleLayerLock = useEditorStore((s) => s.toggleLayerLock);
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility);
  const addShapeLayer = useEditorStore((s) => s.addShapeLayer);
  const moveLayerZ = useEditorStore((s) => s.moveLayerZ);
  const moveLayerToZIndex = useEditorStore((s) => s.moveLayerToZIndex);
  const copySelectedClipToAnimationFamily = useEditorStore((s) => s.copySelectedClipToAnimationFamily);

  const sizeCreative = currentSizeCreative(document, size);
  const zOrderedLayers = [...(sizeCreative?.layers || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const zOrderedLayerIds = zOrderedLayers.map((layer) => layer.id);
  const groups = groupedCreativeLayers(zOrderedLayers);
  const activeTargetId = selectedTargetId || selectedLayerId;
  const activeScopes = [
    `offers-${offerCount}`,
    tcMode === 'tcs_units' ? 'tc-prices' : 'tc-solo',
    ctaShape === 'rectangle' ? 'cta-rect' : 'cta-roundel',
  ];
  const layerById = new Map((sizeCreative?.layers || []).map((layer) => [layer.id, layer]));
  const offerTree = offerInteractionTree(document, size, activeScopes);
  const activeOfferIds = new Set(offerTree.children.map((child) => child.id));

  const finishLayerDrag = () => {
    setDraggingLayerId('');
    setDropTargetLayerId('');
  };

  const targetIndexFromRect = (clientY, sourceLayerId, targetLayerId, rect) => {
    const sourceIndex = zOrderedLayerIds.indexOf(sourceLayerId);
    const targetIndex = zOrderedLayerIds.indexOf(targetLayerId);
    if (sourceIndex < 0 || targetIndex < 0) return -1;
    const dropAfter = clientY > rect.top + rect.height / 2;
    let nextIndex = targetIndex + (dropAfter ? 1 : 0);
    if (sourceIndex < nextIndex) nextIndex -= 1;
    return nextIndex;
  };

  const startLayerPointerDrag = (event, layerId) => {
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
        const nextIndex = targetIndexFromRect(latestClientY, layerId, latestTargetId, latestTargetRect);
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

  const layerDragClass = (layerId) => [
    draggingLayerId === layerId ? 'is-dragging-layer' : '',
    dropTargetLayerId === layerId ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ');

  const renderLayerDragHandle = (layerId, label) => (
    <button
      type="button"
      className="layer-drag-handle"
      aria-label={`Drag ${label} to reorder`}
      data-tip="Drag to reorder layer"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => startLayerPointerDrag(event, layerId)}
    >
      <EditorIcon name="drag" size={13} />
    </button>
  );

  const renderLayerDragSpacer = () => (
    <span className="layer-drag-spacer" aria-hidden="true" />
  );

  useEffect(() => {
    const row = rowRefs.current.get(activeTargetId);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
  }, [activeTargetId]);

  const labelForMenuTarget = (targetId) => {
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

  const menuChoicesForTarget = (targetId) => {
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

  const openMenu = (event, layer, target = null) => {
    event.preventDefault();
    event.stopPropagation();
    if (target) selectTarget(target.id);
    else selectLayer(layer.id);
    setMenu({
      x: event.clientX,
      y: event.clientY,
      layerId: layer.id,
      title: target?.label || layer.label || layer.id,
      locked: lockedLayerIds.has(String(layer.id)),
      hidden: hiddenLayerIds.has(String(layer.id)),
      choices: menuChoicesForTarget(target?.id || layer.id).slice(0, 4),
    });
  };

  const openTargetMenu = (event, targetId, title) => {
    event.preventDefault();
    event.stopPropagation();
    if (targetId === OFFERS_BLOCK_ID) selectOffersBlock();
    else if (layerById.has(targetId)) selectLayer(targetId);
    else selectTarget(targetId);
    setMenu({
      x: event.clientX,
      y: event.clientY,
      layerId: String(targetId).split('::')[0],
      title,
      locked: lockedLayerIds.has(String(targetId).split('::')[0]),
      hidden: hiddenLayerIds.has(String(targetId).split('::')[0]),
      choices: menuChoicesForTarget(targetId).slice(0, 4),
    });
  };

  const renderLayerItem = (layer) => {
    const selected = selectedTargetId === layer.id || (!selectedTargetId && selectedLayerId === layer.id);
    const clip = layer.clips?.find((item) => item.id === selectedClipId) || layer.clips?.[0];
    const childTargets = editableTargetsForLayer(layer);
    const locked = lockedLayerIds.has(String(layer.id));
    const hidden = hiddenLayerIds.has(String(layer.id));
    return (
      <div key={layer.id} className="layer-tree-item">
        <div
          className={[
            'layer-row',
            selected ? 'is-selected' : '',
            locked ? 'is-locked' : '',
            hidden ? 'is-hidden-layer' : '',
            layerDragClass(layer.id),
          ].filter(Boolean).join(' ')}
          data-layer-id={layer.id}
          ref={(node) => {
            if (node) rowRefs.current.set(layer.id, node);
            else rowRefs.current.delete(layer.id);
          }}
          onContextMenu={(event) => openMenu(event, layer)}
        >
          {renderLayerDragHandle(layer.id, layer.label || layer.id)}
          <button type="button" className="layer-row-main" aria-label={`${layer.label || layer.id} layer`} onClick={() => selectLayer(layer.id)}>
            <span className="layer-kind-icon" data-tip={layer.kind || 'Layer'}>
              <EditorIcon name={iconForLayer(layer, childTargets.length)} />
            </span>
            <span className="layer-copy">
              <span className="layer-name">{layer.label || layer.id}</span>
              <span className="layer-meta">
                {childTargets.length ? <LayerBadge icon="group" label="Contains nested editable items" /> : null}
                {clip ? <LayerBadge icon="motion" label={`Motion: ${clip.preset}`} tone="motion" /> : <LayerBadge icon="motion" label="No motion clip" />}
                {locked ? <LayerBadge icon="lock" label="Locked on canvas" tone="locked" /> : null}
                {hidden ? <LayerBadge icon="eyeOff" label="Hidden on canvas" tone="hidden" /> : null}
              </span>
            </span>
          </button>
          <div className="layer-row-actions" aria-label={`${layer.label || layer.id} actions`}>
            <button type="button" data-tip={hidden ? 'Show layer' : 'Hide layer'} aria-label={hidden ? 'Show layer' : 'Hide layer'} onClick={() => toggleLayerVisibility(layer.id)}>
              <EditorIcon name={hidden ? 'eyeOff' : 'eye'} />
            </button>
            <button type="button" data-tip={locked ? 'Unlock layer' : 'Lock layer'} aria-label={locked ? 'Unlock layer' : 'Lock layer'} onClick={() => toggleLayerLock(layer.id)}>
              <EditorIcon name={locked ? 'unlock' : 'lock'} />
            </button>
            <button type="button" data-tip="Duplicate layer" aria-label="Duplicate layer" onClick={() => duplicateLayer(layer.id)}>
              <EditorIcon name="duplicate" />
            </button>
            <button type="button" data-tip="Delete layer" aria-label="Delete layer" onClick={() => deleteLayer(layer.id)}>
              <EditorIcon name="delete" />
            </button>
          </div>
        </div>
        {childTargets.length ? (
          <div className="layer-child-list">
            {childTargets.map((target) => (
              <div
                key={target.id}
                className={`layer-row layer-row-child ${selectedTargetId === target.id ? 'is-selected' : ''}`}
                data-target-id={target.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(target.id, node);
                  else rowRefs.current.delete(target.id);
                }}
                onContextMenu={(event) => openMenu(event, layer, target)}
              >
                {renderLayerDragSpacer()}
                <button type="button" className="layer-row-main" aria-label={`${target.label} nested item`} onClick={() => selectTarget(target.id)}>
                  <span className="layer-kind-icon" data-tip="Nested text">
                    <EditorIcon name="text" />
                  </span>
                  <span className="layer-copy">
                    <span className="layer-name">{target.label}</span>
                    <span className="layer-meta">
                      <LayerBadge icon="group" label="Position is relative to the parent offer slot" />
                      <LayerBadge icon="style" label="Shared class rule unless this variant overrides it" tone="style" />
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderOfferBlockItem = (groupLayers) => {
    const hiddenOfferLayers = groupLayers.filter((layer) => (
      isOfferLayerId(layer.id) && !activeOfferIds.has(layer.id)
    ));
    return (
      <div key={OFFERS_BLOCK_ID} className="layer-tree-item">
        <div
          className={`layer-row ${selectedTargetId === OFFERS_BLOCK_ID ? 'is-selected' : ''}`}
          data-layer-id={OFFERS_BLOCK_ID}
          ref={(node) => {
            if (node) rowRefs.current.set(OFFERS_BLOCK_ID, node);
            else rowRefs.current.delete(OFFERS_BLOCK_ID);
          }}
          onContextMenu={(event) => openTargetMenu(event, OFFERS_BLOCK_ID, offerTree.label)}
        >
          {renderLayerDragSpacer()}
          <button type="button" className="layer-row-main" aria-label={`${offerTree.label} group`} onClick={() => selectOffersBlock()}>
            <span className="layer-kind-icon" data-tip="Offer group">
              <EditorIcon name="group" />
            </span>
            <span className="layer-copy">
              <span className="layer-name">{offerTree.label}</span>
              <span className="layer-meta">
                <span className="layer-count-badge" title="Visible offer members">{offerTree.children.length} active</span>
                {hiddenOfferLayers.length ? <span className="layer-count-badge" title="Hidden or alternate offer members">{hiddenOfferLayers.length} hidden</span> : null}
              </span>
            </span>
          </button>
        </div>
        <div className="layer-child-list">
          {offerTree.children.map((child) => {
            const layer = layerById.get(child.id);
            const clip = layer?.clips?.find((item) => item.id === selectedClipId) || layer?.clips?.[0];
            const locked = lockedLayerIds.has(String(child.id));
            const hidden = hiddenLayerIds.has(String(child.id));
            return (
              <div key={child.id} className="layer-tree-item">
                <div
                  className={[
                    'layer-row',
                    'layer-row-child',
                    selectedTargetId === child.id || (!selectedTargetId && selectedLayerId === child.id) ? 'is-selected' : '',
                    locked ? 'is-locked' : '',
                    hidden ? 'is-hidden-layer' : '',
                    layer ? layerDragClass(child.id) : '',
                  ].filter(Boolean).join(' ')}
                  data-layer-id={child.id}
                  ref={(node) => {
                    if (node) rowRefs.current.set(child.id, node);
                    else rowRefs.current.delete(child.id);
                  }}
                  onContextMenu={(event) => openMenu(event, layer || { id: child.id, label: child.label, kind: child.kind })}
                >
                  {layer ? renderLayerDragHandle(child.id, child.label) : renderLayerDragSpacer()}
                  <button type="button" className="layer-row-main" aria-label={`${child.label} layer`} onClick={() => selectLayer(child.id)}>
                    <span className="layer-kind-icon" data-tip={child.kind === 'offer-plus' ? 'Offer separator' : 'Offer slot'}>
                      <EditorIcon name={child.kind === 'offer-plus' ? 'add' : 'group'} />
                    </span>
                    <span className="layer-copy">
                      <span className="layer-name">{child.label}</span>
                      <span className="layer-meta">
                        {child.children.length ? <LayerBadge icon="group" label="Contains nested editable items" /> : null}
                        {clip ? <LayerBadge icon="motion" label={`Motion: ${clip.preset}`} tone="motion" /> : <LayerBadge icon="motion" label="No motion clip" />}
                        {locked ? <LayerBadge icon="lock" label="Locked on canvas" tone="locked" /> : null}
                        {hidden ? <LayerBadge icon="eyeOff" label="Hidden on canvas" tone="hidden" /> : null}
                      </span>
                    </span>
                  </button>
                  {layer ? (
                    <div className="layer-row-actions" aria-label={`${child.label} actions`}>
                      <button type="button" data-tip={hidden ? 'Show layer' : 'Hide layer'} aria-label={hidden ? 'Show layer' : 'Hide layer'} onClick={() => toggleLayerVisibility(child.id)}>
                        <EditorIcon name={hidden ? 'eyeOff' : 'eye'} />
                      </button>
                      <button type="button" data-tip={locked ? 'Unlock layer' : 'Lock layer'} aria-label={locked ? 'Unlock layer' : 'Lock layer'} onClick={() => toggleLayerLock(child.id)}>
                        <EditorIcon name={locked ? 'unlock' : 'lock'} />
                      </button>
                      <button type="button" data-tip="Duplicate layer" aria-label="Duplicate layer" onClick={() => duplicateLayer(child.id)}>
                        <EditorIcon name="duplicate" />
                      </button>
                      <button type="button" data-tip="Delete layer" aria-label="Delete layer" onClick={() => deleteLayer(child.id)}>
                        <EditorIcon name="delete" />
                      </button>
                    </div>
                  ) : null}
                </div>
                {child.children.length ? (
                  <div className="layer-child-list">
                    {child.children.map((target) => (
                      <div
                        key={target.id}
                        className={`layer-row layer-row-child ${selectedTargetId === target.id ? 'is-selected' : ''}`}
                        data-target-id={target.id}
                        ref={(node) => {
                          if (node) rowRefs.current.set(target.id, node);
                          else rowRefs.current.delete(target.id);
                        }}
                        onContextMenu={(event) => openMenu(event, layer || { id: child.id, label: child.label, kind: child.kind }, target)}
                      >
                        {renderLayerDragSpacer()}
                        <button type="button" className="layer-row-main" aria-label={`${target.label} nested item`} onClick={() => selectTarget(target.id)}>
                          <span className="layer-kind-icon" data-tip="Nested text">
                            <EditorIcon name="text" />
                          </span>
                          <span className="layer-copy">
                            <span className="layer-name">{target.label}</span>
                            <span className="layer-meta">
                              <LayerBadge icon="group" label="Position is relative to the parent offer slot" />
                              <LayerBadge icon="style" label="Shared class rule unless this variant overrides it" tone="style" />
                            </span>
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {hiddenOfferLayers.length ? (
            <details>
              <summary className="layer-row layer-row-child">
                <span className="layer-name">Hidden in this format</span>
                <span className="layer-meta"><span>{hiddenOfferLayers.length} members</span></span>
              </summary>
              <div className="layer-child-list">
                {hiddenOfferLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className={[
                      'layer-row',
                      'layer-row-child',
                      selectedTargetId === layer.id || (!selectedTargetId && selectedLayerId === layer.id) ? 'is-selected' : '',
                      layerDragClass(layer.id),
                    ].filter(Boolean).join(' ')}
                    data-layer-id={layer.id}
                    ref={(node) => {
                      if (node) rowRefs.current.set(layer.id, node);
                      else rowRefs.current.delete(layer.id);
                    }}
                    onContextMenu={(event) => openMenu(event, layer)}
                  >
                    {renderLayerDragHandle(layer.id, layer.label || layer.id)}
                    <button type="button" className="layer-row-main" aria-label={`${layer.label || layer.id} layer`} onClick={() => selectLayer(layer.id)}>
                      <span className="layer-kind-icon" data-tip={layer.kind || 'Layer'}>
                        <EditorIcon name={iconForLayer(layer)} />
                      </span>
                      <span className="layer-copy">
                        <span className="layer-name">{layer.label || layer.id}</span>
                        <span className="layer-meta">
                          <LayerBadge icon="eyeOff" label="Hidden in this format" tone="hidden" />
                          <LayerBadge icon={iconForLayer(layer)} label={`Layer type: ${layer.kind}`} />
                        </span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <aside className="layer-tree" aria-label="Layers">
      <div className="workspace-panel-head">
        <div>
          <span className="panel-kicker">Structure</span>
          <h2>Layers</h2>
        </div>
        <div className="panel-head-actions">
          <button type="button" aria-label="Add rectangle layer" data-tip="Add rectangle layer" onClick={() => addShapeLayer()}>
            <EditorIcon name="add" />
          </button>
          <span className="panel-count">{sizeCreative?.layers?.length || 0}</span>
        </div>
      </div>
      <div className="layer-group-list">
        {groups.map((group) => (
          <section className="layer-group" key={group.label}>
            <h3>{group.label}</h3>
            <div className="layer-list">
              {offerCount >= 2 && group.layers.some((layer) => isOfferLayerId(layer.id)) ? renderOfferBlockItem(group.layers) : null}
              {group.layers
                .filter((layer) => offerCount < 2 || !isOfferLayerId(layer.id))
                .map((layer) => renderLayerItem(layer))}
            </div>
          </section>
        ))}
      </div>
      {menu ? (
        <div className="canvas-menu layer-menu" style={{ left: menu.x, top: menu.y }}>
          <strong>{menu.title}</strong>
          {menu.choices.map((choice) => (
            <button key={choice.id} type="button" onClick={() => { choice.select(); setMenu(null); }}>{choice.label}</button>
          ))}
          <button type="button" onClick={() => { duplicateLayer(menu.layerId); setMenu(null); }}>Duplicate layer</button>
          <button type="button" onClick={() => { deleteLayer(menu.layerId); setMenu(null); }}>Delete layer</button>
          <button type="button" onClick={() => { toggleLayerLock(menu.layerId); setMenu(null); }}>
            {menu.locked ? 'Unlock layer' : 'Lock layer'}
          </button>
          <button type="button" onClick={() => { toggleLayerVisibility(menu.layerId); setMenu(null); }}>
            {menu.hidden ? 'Show layer' : 'Hide layer'}
          </button>
          <button type="button" onClick={() => { moveLayerZ(menu.layerId, 1); setMenu(null); }}>Bring forward</button>
          <button type="button" onClick={() => { moveLayerZ(menu.layerId, -1); setMenu(null); }}>Send backward</button>
          <button type="button" onClick={() => { addShapeLayer(); setMenu(null); }}>Add rectangle</button>
          <button type="button" onClick={() => { addAnimationIntent(menu.layerId, 'fadeIn'); setMenu(null); }}>Fade in at playhead</button>
          <button type="button" onClick={() => { addAnimationIntent(menu.layerId, 'fadeOut'); setMenu(null); }}>Fade out at playhead</button>
          <button type="button" onClick={() => { copySelectedClipToAnimationFamily(); setMenu(null); }}>Apply motion to family</button>
        </div>
      ) : null}
    </aside>
  );
}
