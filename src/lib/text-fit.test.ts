import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  applyTextFitting,
  fitElementToBox,
} from './text-fit';

const makeElement = ({
  className,
  text = 'copy',
  fontSize = 40,
  clientWidth = 100,
  clientHeight = 20,
  overflowUntil = 34,
  scrollHeight = clientHeight,
  heightOverflowUntil = 0,
  textRectHeight = null,
  visible = true,
} = {}) => {
  const element = {
    className,
    textContent: text,
    style: {},
    parentElement: null,
    querySelector: () => null,
    querySelectorAll: () => [],
    matches: (selector) => selector === `.${className}`,
  };
  Object.defineProperty(element, 'clientWidth', { get: () => clientWidth });
  Object.defineProperty(element, 'clientHeight', { get: () => clientHeight });
  Object.defineProperty(element, 'scrollWidth', {
    get: () => {
      const size = Number.parseFloat(element.style.fontSize || `${fontSize}px`);
      return size > overflowUntil ? clientWidth + 1 : clientWidth;
    },
  });
  Object.defineProperty(element, 'scrollHeight', {
    get: () => {
      const size = Number.parseFloat(element.style.fontSize || `${fontSize}px`);
      if (heightOverflowUntil && size > heightOverflowUntil) return clientHeight + 12;
      return scrollHeight;
    },
  });
  element.computed = { fontSize: `${fontSize}px`, visibility: visible ? 'visible' : 'hidden' };
  if (textRectHeight !== null) {
    element.ownerDocument = {
      createRange: () => ({
        selectNodeContents: () => {},
        detach: () => {},
        getBoundingClientRect: () => ({
          height: textRectHeight,
          width: clientWidth,
        }),
      }),
    };
  }
  return element;
};

const makeRoot = (elements) => ({
  querySelectorAll: (selector) => elements.filter((element) => element.matches(selector)),
});

const getComputedStyle = (element) => element.computed;

test('fits a GWD text element down to its minimum font size', () => {
  const element = makeElement({ className: 'offer-value', fontSize: 40, overflowUntil: 20 });

  const size = fitElementToBox(element, { minFontSize: 32 }, { getComputedStyle });

  assert.equal(size, 32);
  assert.equal(element.style.fontSize, '32px');
});

test('does not shrink when only natural text height overflows', () => {
  const element = makeElement({
    className: 'offer-value',
    fontSize: 130,
    overflowUntil: 130,
    clientHeight: 20,
    scrollHeight: 130,
  });

  const size = fitElementToBox(element, { minFontSize: 32 }, { getComputedStyle });

  assert.equal(size, 130);
  assert.equal(element.style.fontSize, '130px');
});

test('shrinks text until a max line count fits', () => {
  const element = makeElement({
    className: 'headline-act2',
    fontSize: 24,
    overflowUntil: 24,
    clientWidth: 270,
    clientHeight: 60,
    heightOverflowUntil: 22,
  });
  element.computed = { fontSize: '24px', lineHeight: '28px', visibility: 'visible' };

  const size = fitElementToBox(element, { minFontSize: 22, maxLines: 2 }, { getComputedStyle });

  assert.equal(size, 22);
  assert.equal(element.style.fontSize, '22px');
  assert.equal(element.style.maxHeight, '60px');
  assert.equal(element.style.overflow, 'hidden');
});

test('keeps requested size when wrapped text fits the explicit box height', () => {
  const element = makeElement({
    className: 'headline-act3',
    fontSize: 20,
    clientWidth: 309,
    clientHeight: 49,
    overflowUntil: 20,
    scrollHeight: 48,
  });
  element.computed = { fontSize: '20px', lineHeight: '23px', visibility: 'visible' };

  const size = fitElementToBox(element, { minFontSize: 17, maxLines: 2 }, { getComputedStyle });

  assert.equal(size, 20);
  assert.equal(element.style.fontSize, '20px');
  assert.equal(element.style.maxHeight, '49px');
  assert.equal(element.style.overflow, 'hidden');
});

test('keeps requested size when centred flex text fits inside a taller frame', () => {
  const element = makeElement({
    className: 'headline-act3',
    fontSize: 20,
    clientWidth: 309,
    clientHeight: 58,
    overflowUntil: 20,
    scrollHeight: 58,
    textRectHeight: 31.5,
  });
  element.computed = {
    fontSize: '20px',
    lineHeight: '23px',
    display: 'flex',
    alignItems: 'center',
    visibility: 'visible',
  };

  const size = fitElementToBox(element, { minFontSize: 17, maxLines: 2 }, { getComputedStyle });

  assert.equal(size, 20);
  assert.equal(element.style.fontSize, '20px');
  assert.equal(element.style.maxHeight, '49.45px');
  assert.equal(element.style.overflow, 'hidden');
});

test('wrap mode keeps the requested font size and allows normal wrapping', () => {
  const element = makeElement({ className: 'headline-act2', fontSize: 24, overflowUntil: 1 });
  element.computed = { fontSize: '24px', lineHeight: '28px', visibility: 'visible' };

  const size = fitElementToBox(element, { mode: 'wrap', minFontSize: 22, maxLines: 2 }, { getComputedStyle });

  assert.equal(size, 24);
  assert.equal(element.style.fontSize, '');
  assert.equal(element.style.whiteSpace, 'normal');
});

test('equalises visible offer sublines to the smallest fitted size', () => {
  const sublineA = makeElement({ className: 'offer-subline', fontSize: 26, overflowUntil: 21 });
  const sublineB = makeElement({ className: 'offer-subline', fontSize: 26, overflowUntil: 18 });
  const hiddenSubline = makeElement({ className: 'offer-subline', fontSize: 26, overflowUntil: 10 });
  const visibleSlotA = { computed: { visibility: 'visible' } };
  const visibleSlotB = { computed: { visibility: 'visible' } };
  const hiddenSlot = { computed: { visibility: 'hidden' } };
  sublineA.parentElement = visibleSlotA;
  sublineB.parentElement = visibleSlotB;
  hiddenSubline.parentElement = hiddenSlot;

  const results = applyTextFitting(makeRoot([sublineA, sublineB, hiddenSubline]), [
    {
      cssClass: 'offer-subline',
      mode: 'sharedEqualizedFit',
      minFontSize: 10,
      sharedFitGroup: 'visible offer sublines',
    },
  ], { getComputedStyle });

  assert.equal(results.get('offer-subline'), 18);
  assert.equal(sublineA.style.fontSize, '18px');
  assert.equal(sublineB.style.fontSize, '18px');
  assert.equal(hiddenSubline.style.fontSize, undefined);
});
