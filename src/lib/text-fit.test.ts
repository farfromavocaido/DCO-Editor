import { test } from 'vitest';
import assert from 'node:assert/strict';

import { applyTextFitting, createTextFitEngine } from './text-fit';

type FitsAt = (size: number, trackingEm: number, whiteSpace: string) => boolean;

const makeElement = ({
  className = 'target',
  text = 'copy',
  fontSize = 40,
  lineHeightRatio = 1.1,
  clientWidth = 100,
  clientHeight = 44,
  fitsAt = ((size) => size <= 34) as FitsAt,
  linesAt = null as null | ((size: number, whiteSpace: string) => number),
  display = 'block',
  alignItems = '',
  visible = true,
} = {}) => {
  const attrs: Record<string, string> = {};
  const element: Record<string, unknown> = {
    className,
    textContent: text,
    style: {} as Record<string, string>,
    parentElement: null,
    matches: (selector: string) => selector === `.${className}`,
    setAttribute: (name: string, value: string) => { attrs[name] = String(value); },
    getAttribute: (name: string) => (attrs[name] === undefined ? null : attrs[name]),
    removeAttribute: (name: string) => { delete attrs[name]; },
  };
  const style = element.style as Record<string, string>;
  const currentSize = () => Number.parseFloat(style.fontSize) || fontSize;
  const currentTracking = () => {
    const value = style.letterSpacing || '';
    return value.endsWith('em') ? Number.parseFloat(value) : 0;
  };
  const currentWhiteSpace = () => style.whiteSpace || 'nowrap';
  const lineCount = () => (linesAt ? linesAt(currentSize(), currentWhiteSpace()) : 1);
  const contentHeight = () => lineCount() * currentSize() * lineHeightRatio;
  Object.defineProperty(element, 'clientWidth', { get: () => clientWidth });
  Object.defineProperty(element, 'clientHeight', { get: () => clientHeight });
  Object.defineProperty(element, 'scrollWidth', {
    get: () => (fitsAt(currentSize(), currentTracking(), currentWhiteSpace()) ? clientWidth : clientWidth + 1),
  });
  Object.defineProperty(element, 'scrollHeight', {
    get: () => Math.max(clientHeight, contentHeight()),
  });
  element.ownerDocument = {
    createRange: () => ({
      selectNodeContents: () => {},
      detach: () => {},
      getBoundingClientRect: () => ({ height: contentHeight(), width: clientWidth }),
    }),
  };
  element.computed = () => ({
    fontSize: `${currentSize()}px`,
    lineHeight: `${currentSize() * lineHeightRatio}px`,
    letterSpacing: style.letterSpacing || 'normal',
    whiteSpace: currentWhiteSpace(),
    visibility: visible ? 'visible' : 'hidden',
    display,
    alignItems: style.alignItems || alignItems,
  });
  return element;
};

const makeRoot = (elements: Array<Record<string, unknown>>, className = 'stage page-content offers-1') => ({
  className,
  querySelectorAll: (selector: string) => elements.filter(
    (element) => (element.matches as (s: string) => boolean)(selector),
  ),
});

const fakeWindow = {
  getComputedStyle: (element: Record<string, unknown>) => (element.computed as () => unknown)(),
};

const engine = () => createTextFitEngine(fakeWindow);

test('shrinks an overflowing element until it fits', () => {
  const element = makeElement({ fontSize: 40, fitsAt: (size) => size <= 34 });

  engine().applyRules(makeRoot([element]), [{ cssClass: 'target', minFontSize: 8 }]);

  assert.equal((element.style as Record<string, string>).fontSize, '34px');
});

test('the floor scales with the base size instead of being a global constant', () => {
  const element = makeElement({ fontSize: 40, fitsAt: () => false });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8, minFontSizeRatio: 0.5 },
  ]);

  assert.equal((element.style as Record<string, string>).fontSize, '20px');
});

test('the absolute floor still wins when the ratio floor is lower', () => {
  const element = makeElement({ fontSize: 10, fitsAt: () => false });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8, minFontSizeRatio: 0.5 },
  ]);

  assert.equal((element.style as Record<string, string>).fontSize, '8px');
});

test('a slight tracking squeeze is tried before any size reduction', () => {
  const element = makeElement({
    fontSize: 40,
    fitsAt: (size, trackingEm) => size <= 40 && trackingEm <= -0.0099,
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8, tracking: { minEm: -0.02 } },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.fontSize, '40px', 'font size must be preserved when tracking is enough');
  assert.equal(style.letterSpacing, '-0.01em');
});

test('tracking is bounded and shrinking takes over beyond the bound', () => {
  const element = makeElement({
    fontSize: 40,
    fitsAt: (size, trackingEm) => size + trackingEm * 100 <= 31.8,
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8, tracking: { minEm: -0.02 } },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.letterSpacing, '-0.02em');
  assert.equal(style.fontSize, '33.5px');
});

test('shared rules equalize the final size across all visible members', () => {
  const wide = makeElement({ className: 'offer-value', fontSize: 40, fitsAt: (size) => size <= 30 });
  const narrow = makeElement({ className: 'offer-value', fontSize: 40, fitsAt: (size) => size <= 40 });

  engine().applyRules(makeRoot([wide, narrow]), [
    { cssClass: 'offer-value', shared: true, minFontSize: 8 },
  ]);

  assert.equal((wide.style as Record<string, string>).fontSize, '30px');
  assert.equal((narrow.style as Record<string, string>).fontSize, '30px');
});

test('tracking applied to one member of a shared group is applied to all', () => {
  const squeezed = makeElement({
    className: 'offer-value',
    fontSize: 40,
    fitsAt: (size, trackingEm) => size <= 40 && trackingEm <= -0.0099,
  });
  const comfortable = makeElement({ className: 'offer-value', fontSize: 40, fitsAt: (size) => size <= 40 });

  engine().applyRules(makeRoot([squeezed, comfortable]), [
    { cssClass: 'offer-value', shared: true, minFontSize: 8, tracking: { minEm: -0.02 } },
  ]);

  assert.equal((squeezed.style as Record<string, string>).letterSpacing, '-0.01em');
  assert.equal((comfortable.style as Record<string, string>).letterSpacing, '-0.01em');
  assert.equal((squeezed.style as Record<string, string>).fontSize, '40px');
  assert.equal((comfortable.style as Record<string, string>).fontSize, '40px');
});

test('hidden members do not drag a shared group down', () => {
  const hidden = makeElement({ className: 'offer-value', fontSize: 40, fitsAt: (size) => size <= 10, visible: false });
  const shown = makeElement({ className: 'offer-value', fontSize: 40, fitsAt: (size) => size <= 40 });

  engine().applyRules(makeRoot([hidden, shown]), [
    { cssClass: 'offer-value', shared: true, minFontSize: 8 },
  ]);

  assert.equal((shown.style as Record<string, string>).fontSize, '40px');
  assert.equal((hidden.style as Record<string, string>).fontSize, undefined);
});

test('a member inside a hidden slot is skipped via its ancestors', () => {
  const inHiddenSlot = makeElement({ className: 'offer-subline', fontSize: 26, fitsAt: (size) => size <= 10 });
  const shown = makeElement({ className: 'offer-subline', fontSize: 26, fitsAt: (size) => size <= 18 });
  (inHiddenSlot as Record<string, unknown>).parentElement = { computed: () => ({ visibility: 'hidden' }), parentElement: null };
  (shown as Record<string, unknown>).parentElement = { computed: () => ({ visibility: 'visible' }), parentElement: null };

  engine().applyRules(makeRoot([inHiddenSlot, shown]), [
    { cssClass: 'offer-subline', shared: true, minFontSize: 6 },
  ]);

  assert.equal((shown.style as Record<string, string>).fontSize, '18px');
  assert.equal((inHiddenSlot.style as Record<string, string>).fontSize, undefined);
});

test('shrink with maxLines > 1 wraps and shrinks until the line budget fits', () => {
  const element = makeElement({
    fontSize: 24,
    clientHeight: 44,
    fitsAt: (_size, _tracking, whiteSpace) => whiteSpace === 'normal',
    linesAt: (size, whiteSpace) => (whiteSpace === 'normal' ? (size > 20 ? 3 : 2) : 1),
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', wrap: true, allowShrink: true, maxLines: 2, minFontSize: 10 },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.whiteSpace, 'normal');
  assert.equal(style.fontSize, '20px');
  assert.equal(element.getAttribute('data-fit-clipped'), null);
});

test('wrap mode keeps the designed size and does not shrink', () => {
  const element = makeElement({
    fontSize: 24,
    clientHeight: 44,
    fitsAt: (_size, _tracking, whiteSpace) => whiteSpace === 'normal',
    linesAt: (_size, whiteSpace) => (whiteSpace === 'normal' ? 3 : 1),
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', wrap: true, allowShrink: false, maxLines: 2, minFontSize: 10 },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.whiteSpace, 'normal');
  assert.equal(style.fontSize, '24px');
  assert.equal(element.getAttribute('data-fit-clipped'), 'true');
});

test('copy that measures a hair over N line-heights is not false-flagged as clipped', () => {
  // Real browsers often report ~2.2 line-boxes for visually 2-line Museo copy.
  const element = makeElement({
    fontSize: 20,
    lineHeightRatio: 1.1,
    clientHeight: 100,
    fitsAt: (_size, _tracking, whiteSpace) => whiteSpace === 'normal',
    linesAt: (_size, whiteSpace) => (whiteSpace === 'normal' ? 2.2 : 1),
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', wrap: true, allowShrink: true, maxLines: 2, minFontSize: 10 },
  ]);

  assert.equal(element.getAttribute('data-fit-clipped'), null);
});

test('shrink with maxLines 1 forces a single line (no wrap)', () => {
  const element = makeElement({
    fontSize: 24,
    fitsAt: (size, _tracking, whiteSpace) => whiteSpace === 'nowrap' && size <= 18,
    linesAt: (_size, whiteSpace) => (whiteSpace === 'normal' ? 2 : 1),
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', wrap: false, allowShrink: true, maxLines: 1, minFontSize: 10 },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.whiteSpace, 'nowrap');
  assert.equal(style.fontSize, '18px');
});

test('wrapped multi-line content keeps bottom flex alignment (wraps upward)', () => {
  const wrapped = makeElement({
    fontSize: 18,
    clientHeight: 44,
    display: 'flex',
    alignItems: 'flex-end',
    fitsAt: (_size, _tracking, whiteSpace) => whiteSpace === 'normal',
    linesAt: (_size, whiteSpace) => (whiteSpace === 'normal' ? 2 : 1),
  });
  const singleLine = makeElement({
    className: 'single',
    fontSize: 18,
    display: 'flex',
    alignItems: 'flex-end',
    fitsAt: () => true,
    linesAt: () => 1,
  });

  engine().applyRules(makeRoot([wrapped, singleLine]), [
    { cssClass: 'target', wrap: true, maxLines: 2, minFontSize: 8 },
    { cssClass: 'single', wrap: true, maxLines: 2, minFontSize: 8 },
  ]);

  // Engine must not override authored flex-end — last line stays on the
  // baseline, earlier lines stack upward when maxLines allows wrap.
  assert.equal((wrapped.style as Record<string, string>).alignItems || '', '');
  assert.equal((singleLine.style as Record<string, string>).alignItems || '', '');
});

test('bottom-aligned members keep their glyph bottoms when shrunk', () => {
  const element = makeElement({
    className: 'offer-value',
    fontSize: 40,
    lineHeightRatio: 0.85,
    fitsAt: (size) => size <= 30,
  });

  engine().applyRules(makeRoot([element]), [
    { cssClass: 'offer-value', shared: true, align: 'bottom', minFontSize: 8 },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.fontSize, '30px');
  assert.equal(style.transform, 'translateY(8.50px)');
});

test('scope overrides win when the root carries the scope class', () => {
  const element = makeElement({
    fontSize: 24,
    fitsAt: (size, _tracking, whiteSpace) => (whiteSpace === 'normal' ? true : size <= 20),
    linesAt: (_size, whiteSpace) => (whiteSpace === 'normal' ? 2 : 1),
  });

  engine().applyRules(
    makeRoot([element], 'stage page-content offers-3'),
    [{
      cssClass: 'target',
      wrap: true,
      maxLines: 2,
      minFontSize: 8,
      scopes: { 'offers-3': { wrap: false } },
    }],
  );

  const style = element.style as Record<string, string>;
  assert.notEqual(style.whiteSpace, 'normal', 'offers-3 override must disable wrapping');
  assert.equal(style.fontSize, '20px');
});

test('re-running the fit is idempotent so a post-font-load refit is safe', () => {
  const element = makeElement({
    className: 'offer-value',
    fontSize: 40,
    lineHeightRatio: 0.85,
    fitsAt: (size, trackingEm) => size + trackingEm * 100 <= 30,
  });
  const rules = [{
    cssClass: 'offer-value',
    shared: true,
    align: 'bottom',
    minFontSize: 8,
    tracking: { minEm: -0.02 },
  }];

  const run = () => engine().applyRules(makeRoot([element]), rules);
  run();
  const style = element.style as Record<string, string>;
  const first = { fontSize: style.fontSize, letterSpacing: style.letterSpacing, transform: style.transform };
  run();

  assert.deepEqual(
    { fontSize: style.fontSize, letterSpacing: style.letterSpacing, transform: style.transform },
    first,
  );
});

test('static truncate mode is applied without shrinking', () => {
  const element = makeElement({ fontSize: 40, fitsAt: () => false });

  const results = engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', static: 'truncate' },
  ]);

  const style = element.style as Record<string, string>;
  assert.equal(style.whiteSpace, 'nowrap');
  assert.equal(style.overflow, 'hidden');
  assert.equal(style.textOverflow, 'ellipsis');
  assert.equal(style.fontSize, '');
  // Width overflow in truncate mode still counts as clipped.
  assert.deepEqual(results, [{ cssClass: 'target', size: 40, clipped: true }]);
});

test('empty elements are skipped entirely', () => {
  const element = makeElement({ text: '   ' });

  const results = engine().applyRules(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8 },
  ]);

  assert.deepEqual(results, []);
  assert.equal((element.style as Record<string, string>).fontSize, undefined);
});

test('applyTextFitting returns size and clipped maps per css class', () => {
  const element = makeElement({ fontSize: 40, fitsAt: (size) => size <= 34 });

  const results = applyTextFitting(makeRoot([element]), [
    { cssClass: 'target', minFontSize: 8 },
  ], { win: fakeWindow });

  assert.ok(results.sizes instanceof Map);
  assert.ok(results.clipped instanceof Map);
  assert.equal(results.sizes.get('target'), 34);
  assert.equal(results.clipped.get('target'), false);
});
