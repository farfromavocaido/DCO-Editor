// @ts-nocheck
import { materializeCreativeOwnership } from './creative-ownership';
import { findCreativeTarget } from './creative-model';

export const OFFER_ARRANGEMENT_PROPERTY = '--offer-layout-mode';
export type OfferArrangementPosition = { targetId: string; kind: 'slot'|'plus'|'subline'; left: number; top: number };

/** Capture real rest-layout coordinates, including automatic inline positioning. */
export const productionOfferArrangementSource = `(function captureOfferArrangement(stage, layerIds) {
  var win = stage.ownerDocument.defaultView;
  var positions = [];
  function active(element) {
    if (!element || win.getComputedStyle(element).visibility === 'hidden') return false;
    var node = element;
    while (node) {
      if (win.getComputedStyle(node).display === 'none') return false;
      node = node.parentElement;
    }
    return true;
  }
  function record(element, targetId, kind) {
    if (!active(element)) return;
    var style = win.getComputedStyle(element);
    var left = parseFloat(style.left), top = parseFloat(style.top);
    if (!isFinite(left) || !isFinite(top)) throw new Error('Offer arrangement requires measurable rest coordinates for ' + targetId);
    positions.push({ targetId: targetId, kind: kind, left: left, top: top });
  }
  (layerIds || []).forEach(function(id) {
    if (/^offer-slot-\\d+$/.test(id)) {
      var slot = stage.ownerDocument.getElementById(id.replace('offer-slot-', 'offer'));
      if (!active(slot)) return;
      record(slot, id, 'slot');
      record(slot.querySelector('.offer-subline'), id + '::offer-subline', 'subline');
    } else if (/^plus-\\d+$/.test(id)) record(stage.ownerDocument.getElementById(id), id, 'plus');
  });
  return positions;
})`;
export const captureProductionOfferArrangement: (stage: HTMLElement, layerIds: string[]) => OfferArrangementPosition[] = new Function(`return ${productionOfferArrangementSource}`)();

export const offerArrangementMode = (document, size, scopes) => {
  const slots = (document?.sizes?.[size]?.layers || []).filter(layer => /^offer-slot-\d+$/.test(layer.id));
  return slots.some(layer => {
    const values = findCreativeTarget(document,size,layer.id,scopes)?.values;
    return values && values.visibility !== 'hidden' && values.display !== 'none' && values[OFFER_ARRANGEMENT_PROPERTY] === 'manual';
  }) ? 'manual' : 'auto';
};

/** One document transaction: freeze active geometry and explicitly choose ownership. */
export const setOfferArrangementMode = (document, size, scopes, mode, positions: OfferArrangementPosition[]) => {
  if (mode !== 'auto' && mode !== 'manual') throw new Error('Unknown offer arrangement mode');
  if (!positions.some(item=>item.kind==='slot')) throw new Error('No active offer arrangement is available in this preview state.');
  const scope = [...new Set(scopes)].sort().join('.');
  if (!scope) throw new Error('Choose a preview state before changing offer arrangement.');
  const next = JSON.parse(JSON.stringify(document));
  const creative = next.sizes?.[size];
  if (!creative) throw new Error(`Unknown size: ${size}`);
  creative.localOverrides ||= [];
  const localFor = (targetId) => {
    let local = creative.localOverrides.find(item=>!item.detached && item.targetId===targetId && (item.scope || '')===scope);
    if (!local) {local={targetId,scope,values:{},fit:{}};creative.localOverrides.push(local);}
    local.values ||= {};
    return local;
  };
  if (mode === 'auto') {
    for (const local of creative.localOverrides) {
      if (local.offerArrangementSeed?.scope !== scope) continue;
      for (const [field,before] of Object.entries(local.offerArrangementSeed.fields)) {
        if (before.present) local.values[field]=before.value;
        else delete local.values[field];
      }
      delete local.offerArrangementSeed;
    }
  } else {
    for (const position of positions) {
      const local = localFor(position.targetId);
      local.offerArrangementSeed ||= {scope,fields:{}};
      for (const field of ['left','top']) {
        if (!Object.hasOwn(local.offerArrangementSeed.fields,field)) local.offerArrangementSeed.fields[field]={present:Object.hasOwn(local.values,field),value:local.values[field]};
        local.values[field]=position[field];
      }
    }
  }
  for (const position of positions) if (position.kind==='slot'||position.kind==='plus') localFor(position.targetId).values[OFFER_ARRANGEMENT_PROPERTY]=mode;
  materializeCreativeOwnership(next);
  return next;
};
