// @vitest-environment jsdom

import { test } from 'vitest';
import assert from 'node:assert/strict';

import { targetIdForLayerChild } from './creative-model';
import { offerTargetAtPoint, shouldBypassOfferCapture } from './offer-hit-testing';

const setRect = (element: Element, rect: Partial<DOMRect>) => {
  const fullRect = {
    left: rect.left || 0,
    top: rect.top || 0,
    right: rect.right || (rect.left || 0) + (rect.width || 0),
    bottom: rect.bottom || (rect.top || 0) + (rect.height || 0),
    width: rect.width || 0,
    height: rect.height || 0,
    x: rect.left || 0,
    y: rect.top || 0,
    toJSON: () => ({}),
  };
  element.getBoundingClientRect = () => fullRect as DOMRect;
};

const makeElement = (tag: string, className: string, rect: Partial<DOMRect>) => {
  const element = document.createElement(tag);
  element.className = className;
  element.setAttribute('style', 'display:block;visibility:visible;pointer-events:auto;opacity:1;');
  setRect(element, rect);
  return element;
};

test('resolves offer text under an overlapping non-offer element', () => {
  document.body.innerHTML = '';
  const stage = makeElement('div', 'stage', { left: 0, top: 0, width: 320, height: 50 });
  const slot = makeElement('div', 'stage-element offer-slot-1', { left: 30, top: 8, width: 120, height: 36 });
  slot.id = 'offer1';
  const value = makeElement('p', 'gwd-grp-offer offer-value', { left: 36, top: 10, width: 60, height: 24 });
  const subline = makeElement('p', 'gwd-grp-offer offer-subline', { left: 36, top: 34, width: 90, height: 10 });
  const overlay = makeElement('p', 'gwd-grp-tc unit-rate-prices', { left: 32, top: 8, width: 80, height: 28 });

  slot.append(value, subline);
  stage.append(slot, overlay);
  document.body.append(stage);

  assert.equal(offerTargetAtPoint({
    stage,
    activeOfferLayers: [{ id: 'offer-slot-1' }],
    clientX: 50,
    clientY: 16,
  }), targetIdForLayerChild('offer-slot-1', 'offer-value'));
});

test('skips invisible or non-interactive offer members', () => {
  document.body.innerHTML = '';
  const stage = makeElement('div', 'stage', { left: 0, top: 0, width: 320, height: 50 });
  const plus = makeElement('p', 'stage-element plus-1', { left: 100, top: 10, width: 20, height: 20 });
  plus.id = 'plus-1';
  plus.style.visibility = 'hidden';
  stage.append(plus);
  document.body.append(stage);

  assert.equal(offerTargetAtPoint({
    stage,
    activeOfferLayers: [{ id: 'plus-1' }],
    clientX: 110,
    clientY: 20,
  }), '');
});

test('bypasses editor chrome without bypassing offer descendants', () => {
  document.body.innerHTML = `
    <div class="offers-block-group">
      <p class="gwd-grp-offer offer-value"></p>
    </div>
    <div class="selection-box">
      <button class="resize-handle resize-se"></button>
    </div>
  `;

  assert.equal(shouldBypassOfferCapture(document.querySelector('.offer-value')), false);
  assert.equal(shouldBypassOfferCapture(document.querySelector('.selection-box')), true);
  assert.equal(shouldBypassOfferCapture(document.querySelector('.resize-handle')), true);
});
