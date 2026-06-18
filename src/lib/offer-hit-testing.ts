// @ts-nocheck

import { targetIdForLayerChild } from '@/lib/creative-model';

const OFFER_CAPTURE_BYPASS_SELECTOR = '.selection-box, .resize-handle';

type OfferHitLayer = {
  id: string;
};

type OfferHitInput = {
  stage: Element | null;
  activeOfferLayers: OfferHitLayer[];
  clientX: number;
  clientY: number;
};

const cssEscape = (stage: Element, value: string) => (
  stage.ownerDocument.defaultView?.CSS?.escape?.(value)
  || globalThis.CSS?.escape?.(value)
  || value.replace(/["\\]/g, '\\$&')
);

const elementById = (stage: Element, id: string) => (
  stage.querySelector(`#${cssEscape(stage, id)}`)
  || [...stage.querySelectorAll('[id]')].find((element) => element.id === id)
  || null
);

const visibleElementContainsPoint = (element: Element | null, clientX: number, clientY: number) => {
  if (!element) return false;
  const view = element.ownerDocument.defaultView || window;
  const style = view.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
  const opacity = Number.parseFloat(style.opacity || '1');
  if (Number.isFinite(opacity) && opacity <= 0.05) return false;
  const rect = element.getBoundingClientRect();
  return clientX >= rect.left
    && clientX <= rect.right
    && clientY >= rect.top
    && clientY <= rect.bottom;
};

export const shouldBypassOfferCapture = (target: EventTarget | null) => {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean((target as Element).closest(OFFER_CAPTURE_BYPASS_SELECTOR));
};

export const offerTargetAtPoint = ({
  stage,
  activeOfferLayers,
  clientX,
  clientY,
}: OfferHitInput) => {
  if (!stage) return '';

  for (const layer of [...activeOfferLayers].reverse()) {
    if (String(layer.id).startsWith('offer-slot-')) {
      const slot = elementById(stage, `offer${String(layer.id).match(/(\d)$/)?.[1] || ''}`);
      const valueId = targetIdForLayerChild(layer.id, 'offer-value');
      const sublineId = targetIdForLayerChild(layer.id, 'offer-subline');
      if (visibleElementContainsPoint(slot?.querySelector('.offer-value'), clientX, clientY)) return valueId;
      if (visibleElementContainsPoint(slot?.querySelector('.offer-subline'), clientX, clientY)) return sublineId;
      if (visibleElementContainsPoint(slot, clientX, clientY)) return layer.id;
      continue;
    }

    const element = elementById(stage, String(layer.id));
    if (visibleElementContainsPoint(element, clientX, clientY)) return String(layer.id);
  }

  return '';
};
