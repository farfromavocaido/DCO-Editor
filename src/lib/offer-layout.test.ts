import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { afterEach, test } from 'vitest';

import {
  OFFER_LAYOUT_MAX_GAP_RATIO,
  OFFER_SUBLINE_INK_WIDTH_RATIO,
  createLayoutOffers,
  layoutOffers,
  layoutOffersRuntime,
} from './offer-layout';

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
});

const stubRect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  x: left,
  y: top,
  toJSON() { return this; },
});

const installDom = () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const { document } = dom.window;
  // @ts-expect-error jsdom global
  globalThis.window = dom.window;
  // @ts-expect-error jsdom global
  globalThis.document = document;
  return { dom, document };
};

test('runtime keeps regex escapes intact for digit/whitespace samples', () => {
  // LAYOUT_OFFERS_SOURCE is a template literal — \\d/\\s must be double-escaped
  // or the exported ad measures "." alone for "1.5" and packs offer gaps wrong.
  assert.match(layoutOffersRuntime, /\.replace\(\/\\s\+\//);
  assert.match(layoutOffersRuntime, /\.replace\(\/\[\^\\d\]\//);
  assert.doesNotMatch(layoutOffersRuntime, /\.replace\(\/s\+\//);
  assert.doesNotMatch(layoutOffersRuntime, /\.replace\(\/\[\^d\.?\]\//);
});

test('runtime encodes ink-first helpers and per-family plus anchors', () => {
  assert.match(layoutOffersRuntime, /function resolvePlusLayoutMode\(/);
  assert.match(layoutOffersRuntime, /data-offer-plus-layout/);
  assert.match(layoutOffersRuntime, /plusLayout === 'manual'/);
  assert.match(layoutOffersRuntime, /function inkRect\(/);
  assert.match(layoutOffersRuntime, /function textInk\(/);
  assert.match(layoutOffersRuntime, /function glyphInk\(/);
  assert.match(layoutOffersRuntime, /actualBoundingBoxAscent/);
  assert.match(layoutOffersRuntime, /fontBoundingBoxAscent/);
  // Unscale Range → local CSS px before combining canvas metrics (stage zoom).
  assert.match(layoutOffersRuntime, /var localLine = clientToLocal\(line, ancestor\)/);
  assert.match(layoutOffersRuntime, /function clientToLocal\(/);
  assert.match(layoutOffersRuntime, /function withNeutralMotion\(/);
  // SVG pluses place from the layout box (skip transformed getBoundingClientRect).
  assert.match(layoutOffersRuntime, /isImg\) \{\s*[\s\S]*?alignY === 'top' \? y/);
  assert.match(layoutOffersRuntime, /setProperty\('animation', 'none', 'important'\)/);
  assert.match(layoutOffersRuntime, /function plusAnchorHorizontal\(/);
  assert.match(layoutOffersRuntime, /function plusAnchorVertical\(/);
  assert.match(layoutOffersRuntime, /function plusAnchorTriangular\(/);
  assert.match(layoutOffersRuntime, /function placePlus\(/);
  assert.match(layoutOffersRuntime, /withNeutralMotion\(plus,/);
  // Ink accepts height-only (wrapped sublines); must not require width > 0 alone.
  assert.match(layoutOffersRuntime, /rect\.width > 0 \|\| rect\.height > 0/);
  // Vertical factors subline cluster ink; triangular modes: sublineTop / midGap /
  // valueBottom. SVG pluses use box ink. Slot motion neutralized for measure.
  assert.match(layoutOffersRuntime, /sublineBottom/);
  assert.match(layoutOffersRuntime, /upperBottom \+ lowerCluster\.valueTop/);
  assert.doesNotMatch(layoutOffersRuntime, /upperCluster\.clusterBottom \+ lowerCluster\.valueTop/);
  assert.match(layoutOffersRuntime, /Math\.max\(topA\.valueBottom, topB\.valueBottom\)/);
  assert.match(layoutOffersRuntime, /sublineTop/);
  assert.match(layoutOffersRuntime, /sublineBoxTop/);
  assert.match(layoutOffersRuntime, /sizeKey === '300x250' \|\| sizeKey === '970x250'/);
  assert.match(layoutOffersRuntime, /sizeKey === '300x600'/);
  assert.match(layoutOffersRuntime, /mode === 'midGap'/);
  assert.match(layoutOffersRuntime, /withNeutralMotionAll\(slots,/);
  assert.match(layoutOffersRuntime, /placePlus\(pluses\[0\], anchor\.x, anchor\.y, anchor\.alignY/);
  assert.match(layoutOffersRuntime, /alignY === 'top'/);
  assert.match(layoutOffersRuntime, /tagName === 'IMG'/);
  assert.equal(OFFER_SUBLINE_INK_WIDTH_RATIO, 1.1);
  assert.doesNotMatch(layoutOffersRuntime, /SUBLINE_INK_RATIO/);
  assert.match(layoutOffersRuntime, new RegExp(String(OFFER_LAYOUT_MAX_GAP_RATIO).replace('.', '\\.')));
});

test('createLayoutOffers returns a callable layoutOffers', () => {
  const fn = createLayoutOffers();
  assert.equal(typeof fn, 'function');
  assert.doesNotThrow(() => fn(null));
});

test('stacked sublines keep authored width (ink×1.1 is not applied at runtime)', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 300 });
  Object.defineProperty(stage, 'offsetHeight', { value: 250 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 300, 250) as DOMRect;

  const slot = document.createElement('div');
  slot.setAttribute('data-gwd-group', 'OfferSlot');
  slot.setAttribute('data-offer-index', '1');
  slot.style.cssText = 'position:absolute;left:20px;top:40px;width:120px;height:100px';
  Object.defineProperty(slot, 'offsetWidth', { value: 120 });
  Object.defineProperty(slot, 'offsetHeight', { value: 100 });
  Object.defineProperty(slot, 'offsetLeft', { value: 20 });
  Object.defineProperty(slot, 'offsetTop', { value: 40 });
  slot.getBoundingClientRect = () => stubRect(20, 40, 120, 100) as DOMRect;

  const value = document.createElement('p');
  value.className = 'offer-value';
  value.getBoundingClientRect = () => stubRect(20, 40, 120, 50) as DOMRect;

  const run = document.createElement('span');
  run.className = 'offer-value-run';
  run.textContent = '15%';
  run.getBoundingClientRect = () => stubRect(50, 45, 60, 40) as DOMRect;

  const subline = document.createElement('p');
  subline.className = 'offer-subline';
  subline.textContent = 'OFF ELECTRICITY';
  subline.style.cssText = 'left:0px;top:55px;width:40px';
  Object.defineProperty(subline, 'offsetHeight', { value: 16 });
  subline.getBoundingClientRect = () => stubRect(20, 95, 120, 16) as DOMRect;

  document.createRange = (() => ({
    selectNodeContents() {},
    detach() {},
    getBoundingClientRect: () => stubRect(50, 45, 60, 40),
  })) as unknown as typeof document.createRange;

  value.appendChild(run);
  slot.appendChild(value);
  slot.appendChild(subline);
  stage.appendChild(slot);
  document.body.appendChild(stage);

  layoutOffers(stage);
  assert.equal(subline.style.width, '');
  assert.equal(subline.style.left, '');
});

test('320x50-like geometry (subline near value bottom) still counts as side-by-side', () => {
  const { document } = installDom();
  const sheet = document.createElement('style');
  sheet.textContent = `
    .offer-value { position: absolute; left: -10px; top: 2px; width: 69px; height: 35px; }
    .offer-subline { position: absolute; left: 61px; top: 30px; width: 65px; height: 12px; }
  `;
  document.head.appendChild(sheet);

  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 320 });
  Object.defineProperty(stage, 'offsetHeight', { value: 50 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 320, 50) as DOMRect;

  const slot = document.createElement('div');
  slot.setAttribute('data-gwd-group', 'OfferSlot');
  slot.setAttribute('data-offer-index', '1');
  slot.style.cssText = 'position:absolute;left:144px;top:4px;width:148px;height:47px';
  Object.defineProperty(slot, 'offsetWidth', { value: 148 });
  Object.defineProperty(slot, 'offsetHeight', { value: 47 });
  Object.defineProperty(slot, 'offsetLeft', { value: 144 });
  Object.defineProperty(slot, 'offsetTop', { value: 4 });
  slot.getBoundingClientRect = () => stubRect(144, 4, 148, 47) as DOMRect;

  const value = document.createElement('p');
  value.className = 'offer-value';
  value.getBoundingClientRect = () => {
    const left = 144 + (Number.parseFloat(window.getComputedStyle(value).left) || -10);
    const top = 4 + (Number.parseFloat(window.getComputedStyle(value).top) || 2);
    return stubRect(left, top, 69, 35) as DOMRect;
  };

  const run = document.createElement('span');
  run.className = 'offer-value-run';
  run.textContent = '15%';
  // Ink sits on the flex-end baseline near the bottom of the 35px value box.
  run.getBoundingClientRect = () => stubRect(154, 12, 49, 28) as DOMRect;

  const subline = document.createElement('p');
  subline.className = 'offer-subline';
  subline.textContent = 'OFF ELECTRICITY*';
  Object.defineProperty(subline, 'offsetHeight', { value: 12 });
  const subBox = () => {
    const top = Number.parseFloat(window.getComputedStyle(subline).top) || 30;
    const left = Number.parseFloat(window.getComputedStyle(subline).left) || 61;
    return stubRect(144 + left, 4 + top, 65, 12);
  };
  subline.getBoundingClientRect = () => subBox() as DOMRect;

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (el?.classList?.contains('offer-value-run')) return stubRect(154, 12, 49, 28);
        if (el?.classList?.contains('offer-subline')) return subBox();
        return stubRect(0, 0, 0, 0);
      },
    };
    return range as unknown as Range;
  };

  value.appendChild(run);
  slot.appendChild(value);
  slot.appendChild(subline);
  stage.appendChild(slot);
  document.body.appendChild(stage);

  layoutOffers(stage);

  // Horizontal re-anchor only; authored top stays (manual drag must work).
  assert.equal(subline.style.left, '61px');
  assert.equal(subline.style.top, '');
});

test('side-by-side re-anchors left to value ink without rewriting top', () => {
  const { document } = installDom();
  // Authored CSS survives clearLayoutStyles (inline was the stale runtime write).
  const sheet = document.createElement('style');
  sheet.textContent = `
    .offer-subline { position: absolute; left: 61px; top: 20px; width: 65px; height: 18px; }
  `;
  document.head.appendChild(sheet);

  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 320 });
  Object.defineProperty(stage, 'offsetHeight', { value: 50 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 320, 50) as DOMRect;

  const slot = document.createElement('div');
  slot.setAttribute('data-gwd-group', 'OfferSlot');
  slot.setAttribute('data-offer-index', '1');
  slot.style.cssText = 'position:absolute;left:144px;top:4px;width:148px;height:47px';
  Object.defineProperty(slot, 'offsetWidth', { value: 148 });
  Object.defineProperty(slot, 'offsetHeight', { value: 47 });
  Object.defineProperty(slot, 'offsetLeft', { value: 144 });
  Object.defineProperty(slot, 'offsetTop', { value: 4 });
  slot.getBoundingClientRect = () => stubRect(144, 4, 148, 47) as DOMRect;

  const value = document.createElement('p');
  value.className = 'offer-value';
  value.getBoundingClientRect = () => stubRect(134, 6, 69, 35) as DOMRect;

  const run = document.createElement('span');
  run.className = 'offer-value-run';
  run.textContent = '15%';
  run.getBoundingClientRect = () => stubRect(154, 8, 49, 30) as DOMRect;

  const subline = document.createElement('p');
  subline.className = 'offer-subline';
  subline.textContent = 'ELECTRICITY';
  // Stale inline top (will be cleared); authored CSS top:20 remains.
  subline.style.top = '99px';
  Object.defineProperty(subline, 'offsetHeight', { value: 18 });
  const sublineStageBox = () => {
    const top = Number.parseFloat(window.getComputedStyle(subline).top) || 20;
    const left = Number.parseFloat(window.getComputedStyle(subline).left) || 61;
    return stubRect(144 + left, 4 + top, 65, 18);
  };
  subline.getBoundingClientRect = () => sublineStageBox() as DOMRect;

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (el?.classList?.contains('offer-value-run')) return stubRect(154, 8, 49, 30);
        if (el?.classList?.contains('offer-subline')) return sublineStageBox();
        return stubRect(0, 0, 0, 0);
      },
    };
    return range as unknown as Range;
  };

  value.appendChild(run);
  slot.appendChild(value);
  slot.appendChild(subline);
  stage.appendChild(slot);
  document.body.appendChild(stage);

  layoutOffers(stage);

  assert.equal(subline.style.left, '61px');
  // Authored CSS top must survive — runtime only owns horizontal pairing.
  assert.equal(subline.style.top, '');
  assert.equal(subline.style.width, '');
});

test('vertical plus mid-gap uses overflowing subline text ink, not the short CSS box', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  stage.id = 'page-content';
  Object.defineProperty(stage, 'offsetWidth', { value: 160 });
  Object.defineProperty(stage, 'offsetHeight', { value: 600 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 160, 600) as DOMRect;
  // offsetParent for absolute children
  Object.defineProperty(stage, 'offsetParent', { value: null });

  const makeSlot = (index: number, top: number, valueInk: ReturnType<typeof stubRect>, subInk: ReturnType<typeof stubRect> | null) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.id = `offer${index}`;
    slot.className = `offer-slot-${index}`;
    slot.style.cssText = `position:absolute;left:10px;top:${top}px;width:140px;height:120px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 140 });
    Object.defineProperty(slot, 'offsetHeight', { value: 120 });
    Object.defineProperty(slot, 'offsetLeft', { value: 10 });
    Object.defineProperty(slot, 'offsetTop', { value: top });
    slot.getBoundingClientRect = () => stubRect(10, top, 140, 120) as DOMRect;

    const value = document.createElement('p');
    value.className = 'offer-value';
    value.getBoundingClientRect = () => stubRect(valueInk.left, valueInk.top, valueInk.width, 50) as DOMRect;

    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = index === 1 ? '15%' : '30%';
    run.getBoundingClientRect = () => valueInk as DOMRect;

    const subline = document.createElement('p');
    subline.className = 'offer-subline';
    subline.textContent = index === 1 ? 'OFF ELECTRICITY AND GAS*' : 'OFF GAS*';
    // Short authored CSS box (the bug): 16px tall while ink is taller.
    subline.style.cssText = 'left:0;top:60px;width:140px;height:16px';
    Object.defineProperty(subline, 'offsetHeight', { value: 16 });
    subline.getBoundingClientRect = () => stubRect(10, top + 60, 140, 16) as DOMRect;
    if (subInk) {
      (subline as HTMLElement & { __ink: typeof subInk }).__ink = subInk;
    }

    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(subline);
    return { slot, run, subline };
  };

  // Slot1 at y=180: value ink 40→90, subline CSS box 240→256 but ink 240→290
  const a = makeSlot(1, 180, stubRect(40, 190, 80, 50), stubRect(20, 240, 120, 50));
  // Slot2 at y=340: value ink 360→410
  const b = makeSlot(2, 340, stubRect(45, 360, 70, 50), stubRect(30, 420, 100, 20));
  stage.appendChild(a.slot);
  stage.appendChild(b.slot);

  const plus = document.createElement('p');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.textContent = '+';
  plus.style.cssText = 'position:absolute;left:60px;top:300px;width:40px;height:60px';
  Object.defineProperty(plus, 'offsetWidth', { value: 40 });
  Object.defineProperty(plus, 'offsetHeight', { value: 60 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  // Tall line-box; glyph ink only in the upper third (the other half of the bug).
  plus.getBoundingClientRect = () => {
    const top = parseFloat(plus.style.top) || 300;
    const left = parseFloat(plus.style.left) || 60;
    return stubRect(left, top, 40, 60) as DOMRect;
  };
  (plus as HTMLElement & { __glyph: ReturnType<typeof stubRect> }).__glyph = stubRect(0, 0, 0, 0);
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (!el) return stubRect(0, 0, 0, 0);
        if (el.classList?.contains('offer-value-run')) {
          return el.getBoundingClientRect();
        }
        if (el.classList?.contains('offer-subline')) {
          const ink = (el as HTMLElement & { __ink?: ReturnType<typeof stubRect> }).__ink;
          return ink || el.getBoundingClientRect();
        }
        if (el.id === 'plus-1' || el.classList?.contains('plus-1')) {
          // Glyph ink: 20×20 centred horizontally, near top of the 60px box.
          const top = parseFloat(el.style.top) || 300;
          const left = parseFloat(el.style.left) || 60;
          return stubRect(left + 10, top + 4, 20, 20);
        }
        return el.getBoundingClientRect();
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // After distribute, remeasure: upper edge = subline INK bottom (290), not CSS
  // box (256) and not a loose cluster union. Lower valueTop ≈ 360. Mid = 325.
  // placePlus centres glyph ink (top+14) on mid → style.top ≈ 325 - 14 = 311.
  const plusTop = parseFloat(plus.style.top);
  assert.ok(Number.isFinite(plusTop), 'plus top rewritten');
  // Must be well below the CSS-box midpoint (~(256+360)/2=308 with glyph nudge)
  // and near the ink-based mid (~325) after glyph centring.
  assert.ok(plusTop > 300, `plus too high (CSS-box path?): top=${plusTop}`);
  assert.ok(plusTop < 330, `plus too low: top=${plusTop}`);
});

test('vertical SVG plus centres on subline-ink → next-value-ink midpoint', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 160 });
  Object.defineProperty(stage, 'offsetHeight', { value: 600 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 160, 600) as DOMRect;

  const makeSlot = (index: number, top: number, valueInk: ReturnType<typeof stubRect>, subInk: ReturnType<typeof stubRect>) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:10px;top:${top}px;width:140px;height:100px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 140 });
    Object.defineProperty(slot, 'offsetHeight', { value: 100 });
    Object.defineProperty(slot, 'offsetLeft', { value: 10 });
    Object.defineProperty(slot, 'offsetTop', { value: top });
    slot.getBoundingClientRect = () => stubRect(10, top, 140, 100) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = `${index}5%`;
    run.getBoundingClientRect = () => valueInk as DOMRect;
    const subline = document.createElement('p');
    subline.className = 'offer-subline';
    subline.textContent = 'OFF';
    subline.style.cssText = 'left:0;top:50px;width:140px;height:40px';
    (subline as HTMLElement & { __ink: typeof subInk }).__ink = subInk;
    subline.getBoundingClientRect = () => stubRect(10, top + 50, 140, 40) as DOMRect;
    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(subline);
    return slot;
  };

  // Upper: value 20→50, subline ink 60→80 (CSS box taller). Lower: value 120→150.
  stage.appendChild(makeSlot(1, 10, stubRect(30, 20, 60, 30), stubRect(30, 60, 80, 20)));
  stage.appendChild(makeSlot(2, 110, stubRect(30, 120, 60, 30), stubRect(30, 160, 80, 16)));

  const plus = document.createElement('img');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.setAttribute('src', 'data:image/svg+xml,plus');
  plus.style.cssText = 'position:absolute;left:70px;top:90px;width:20px;height:20px';
  Object.defineProperty(plus, 'offsetWidth', { value: 20 });
  Object.defineProperty(plus, 'offsetHeight', { value: 20 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  plus.getBoundingClientRect = () => {
    const top = parseFloat(plus.style.top) || 90;
    const left = parseFloat(plus.style.left) || 70;
    return stubRect(left, top - 10, 20, 20) as DOMRect;
  };
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (!el) return stubRect(0, 0, 0, 0);
        if (el.classList?.contains('offer-subline')) {
          return (el as HTMLElement & { __ink?: ReturnType<typeof stubRect> }).__ink
            || el.getBoundingClientRect();
        }
        return el.getBoundingClientRect();
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // After vertical gap equalization, slots shift but relative ink is stable:
  // upperBottom = style.top + sublineInk.bottomRel, valueTop similarly.
  // Ink path lands ~102; CSS-box subline bottom would land ~112.
  const top = parseFloat(plus.style.top);
  assert.ok(Math.abs(top - 102) < 3, `vertical SVG plus top=${top}, expected ~102 (subline ink mid)`);
  assert.ok(top < 108, `looks like CSS-box subline bottom was used: top=${top}`);
});

test('manual offerPlusLayout keeps authored plus left/top (no placePlus)', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  stage.setAttribute('data-size', '300x250');
  stage.setAttribute('data-offer-plus-layout', 'manual');
  Object.defineProperty(stage, 'offsetWidth', { value: 300 });
  Object.defineProperty(stage, 'offsetHeight', { value: 250 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 300, 250) as DOMRect;

  const makeSlot = (index: number, left: number) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:80px;width:100px;height:80px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 100 });
    Object.defineProperty(slot, 'offsetHeight', { value: 80 });
    Object.defineProperty(slot, 'offsetParent', { get: () => stage });
    slot.getBoundingClientRect = () => stubRect(left, 80, 100, 80) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    value.textContent = '10%';
    value.style.cssText = 'left:0;top:0;width:80px;height:40px';
    value.getBoundingClientRect = () => stubRect(left + 10, 80, 60, 30) as DOMRect;
    const subline = document.createElement('p');
    subline.className = 'offer-subline';
    subline.textContent = 'OFF';
    subline.style.cssText = 'left:0;top:50px;width:80px;height:20px';
    subline.getBoundingClientRect = () => stubRect(left + 10, 130, 60, 16) as DOMRect;
    slot.appendChild(value);
    slot.appendChild(subline);
    return slot;
  };

  stage.appendChild(makeSlot(1, 20));
  stage.appendChild(makeSlot(2, 180));
  const plus = document.createElement('img');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.style.cssText = 'position:absolute;left:151px;top:94px;width:26px;height:26px';
  Object.defineProperty(plus, 'offsetWidth', { value: 26 });
  Object.defineProperty(plus, 'offsetHeight', { value: 26 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  stage.appendChild(plus);
  document.body.appendChild(stage);

  // Seed stale auto-layout inline, then clear via manual pass → CSS class would
  // win in the browser; here we assert layoutOffers clears without rewriting.
  plus.style.left = '144.578px';
  plus.style.top = '111.838px';
  layoutOffers(stage);
  assert.equal(plus.style.left, '');
  assert.equal(plus.style.top, '');
});

test('placePlus centres glyph ink, not the tall CSS line-box', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 200 });
  Object.defineProperty(stage, 'offsetHeight', { value: 200 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 200, 200) as DOMRect;

  // Single horizontal pair so distributeHorizontal runs placePlus once.
  const mk = (index: number, left: number) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:40px;width:60px;height:50px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 60 });
    Object.defineProperty(slot, 'offsetHeight', { value: 50 });
    Object.defineProperty(slot, 'offsetLeft', { value: left });
    Object.defineProperty(slot, 'offsetTop', { value: 40 });
    slot.getBoundingClientRect = () => stubRect(left, 40, 60, 50) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = '5%';
    run.getBoundingClientRect = () => stubRect(left + 10, 45, 40, 30) as DOMRect;
    const sub = document.createElement('p');
    sub.className = 'offer-subline';
    sub.textContent = 'X';
    sub.getBoundingClientRect = () => stubRect(left + 10, 80, 40, 10) as DOMRect;
    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(sub);
    return slot;
  };

  stage.appendChild(mk(1, 20));
  stage.appendChild(mk(2, 120));

  const plus = document.createElement('p');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.textContent = '+';
  plus.style.cssText = 'position:absolute;left:80px;top:50px;width:30px;height:50px';
  Object.defineProperty(plus, 'offsetWidth', { value: 30 });
  Object.defineProperty(plus, 'offsetHeight', { value: 50 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  plus.getBoundingClientRect = () => {
    const top = parseFloat(plus.style.top) || 50;
    const left = parseFloat(plus.style.left) || 80;
    return stubRect(left, top, 30, 50) as DOMRect;
  };
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (!el) return stubRect(0, 0, 0, 0);
        if (el.id === 'plus-1') {
          const top = parseFloat(el.style.top) || 50;
          const left = parseFloat(el.style.left) || 80;
          // Glyph only in top 16px of the 50px box.
          return stubRect(left + 5, top + 2, 20, 16);
        }
        return el.getBoundingClientRect();
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // Value centres Y ≈ 60. Box-centering would put top at 60-25=35.
  // Ink-centering: glyph centre at top+10 → top = 60-10 = 50.
  const top = parseFloat(plus.style.top);
  assert.ok(top > 40, `expected ink-centred plus, got top=${top} (box-centre would be ~35)`);
  assert.ok(Math.abs(top - 50) < 8, `plus top=${top}, expected ~50`);
});

test('placePlus ignores motion enter_dy while measuring glyph ink', () => {
  const { document } = installDom();
  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 200 });
  Object.defineProperty(stage, 'offsetHeight', { value: 200 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 200, 200) as DOMRect;

  const mk = (index: number, left: number) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:40px;width:60px;height:50px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 60 });
    Object.defineProperty(slot, 'offsetHeight', { value: 50 });
    Object.defineProperty(slot, 'offsetLeft', { value: left });
    Object.defineProperty(slot, 'offsetTop', { value: 40 });
    slot.getBoundingClientRect = () => stubRect(left, 40, 60, 50) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = '5%';
    run.getBoundingClientRect = () => stubRect(left + 10, 45, 40, 30) as DOMRect;
    const sub = document.createElement('p');
    sub.className = 'offer-subline';
    sub.textContent = 'X';
    sub.getBoundingClientRect = () => stubRect(left + 10, 80, 40, 10) as DOMRect;
    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(sub);
    return slot;
  };

  stage.appendChild(mk(1, 20));
  stage.appendChild(mk(2, 120));

  const plus = document.createElement('p');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.textContent = '+';
  // Simulate fadeUp enter_dy held from t=0 (Replay / editor mid-enter).
  plus.style.cssText = 'position:absolute;left:80px;top:50px;width:30px;height:50px;transform:translateY(-8px)';
  Object.defineProperty(plus, 'offsetWidth', { value: 30 });
  Object.defineProperty(plus, 'offsetHeight', { value: 50 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  const enterDy = () => {
    const t = plus.style.transform || '';
    if (!t || t === 'none') return 0;
    const match = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(t);
    return match ? Number(match[1]) : 0;
  };
  plus.getBoundingClientRect = () => {
    const top = parseFloat(plus.style.top) || 50;
    const left = parseFloat(plus.style.left) || 80;
    return stubRect(left, top + enterDy(), 30, 50) as DOMRect;
  };
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        if (!el) return stubRect(0, 0, 0, 0);
        if (el.id === 'plus-1') {
          const top = parseFloat(el.style.top) || 50;
          const left = parseFloat(el.style.left) || 80;
          const dy = (() => {
            const t = el.style.transform || '';
            if (!t || t === 'none') return 0;
            const match = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(t);
            return match ? Number(match[1]) : 0;
          })();
          return stubRect(left + 5, top + dy + 2, 20, 16);
        }
        return el.getBoundingClientRect();
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // Without neutralization, enter_dy=-8 would over-correct top downward (~58).
  // Rest-pose ink centring must still land near 50, and restore the transform.
  const top = parseFloat(plus.style.top);
  assert.ok(Math.abs(top - 50) < 8, `plus top=${top}, expected ~50 despite enter_dy`);
  assert.match(plus.style.transform, /translateY\(-8px\)/, 'motion transform restored after measure');
});

test('SVG plus images place from the layout box, ignoring animated enter_dy', () => {
  // Shared placePlus path for horizontal / vertical / triangular — regression for
  // CSS fadeUp enter_dy baking into top when getBoundingClientRect is used.
  const { document } = installDom();
  const stage = document.createElement('div');
  Object.defineProperty(stage, 'offsetWidth', { value: 320 });
  Object.defineProperty(stage, 'offsetHeight', { value: 50 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 320, 50) as DOMRect;

  const mk = (index: number, left: number) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:8px;width:60px;height:34px`;
    Object.defineProperty(slot, 'offsetWidth', { value: 60 });
    Object.defineProperty(slot, 'offsetHeight', { value: 34 });
    Object.defineProperty(slot, 'offsetLeft', { value: left });
    Object.defineProperty(slot, 'offsetTop', { value: 8 });
    slot.getBoundingClientRect = () => stubRect(left, 8, 60, 34) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = `${index}5%`;
    // Value ink centre Y = 8+5+12 = 25.
    run.getBoundingClientRect = () => stubRect(left + 8, 13, 40, 24) as DOMRect;
    const sub = document.createElement('p');
    sub.className = 'offer-subline';
    sub.textContent = 'X';
    sub.getBoundingClientRect = () => stubRect(left + 50, 20, 20, 10) as DOMRect;
    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(sub);
    return slot;
  };

  stage.appendChild(mk(1, 40));
  stage.appendChild(mk(2, 140));

  const plus = document.createElement('img');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.setAttribute('src', 'data:image/svg+xml,plus');
  plus.style.cssText = 'position:absolute;left:100px;top:20px;width:20px;height:20px';
  Object.defineProperty(plus, 'offsetWidth', { value: 20 });
  Object.defineProperty(plus, 'offsetHeight', { value: 20 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  // Simulate CSS fadeUp enter_dy=-10 (animations override inline transform:none).
  plus.getBoundingClientRect = () => {
    const top = parseFloat(plus.style.top) || 20;
    const left = parseFloat(plus.style.left) || 100;
    return stubRect(left, top - 10, 20, 20) as DOMRect;
  };
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        return el ? el.getBoundingClientRect() : stubRect(0, 0, 0, 0);
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // Horizontal: centre SVG box on value-ink Y≈25 → top = 25 - 10 = 15.
  // Transformed getBoundingClientRect path would over-correct downward to ~25.
  const top = parseFloat(plus.style.top);
  assert.ok(Math.abs(top - 15) < 2, `SVG plus top=${top}, expected 15 (box place); transformed ink would be ~25`);
});

const installTriangularStage = (opts: {
  size: string;
  width: number;
  height: number;
  slotMotionY?: number;
}) => {
  const { document } = installDom();
  const stage = document.createElement('div');
  stage.setAttribute('data-size', opts.size);
  stage.style.cssText = `position:relative;width:${opts.width}px;height:${opts.height}px`;
  Object.defineProperty(stage, 'offsetWidth', { value: opts.width });
  Object.defineProperty(stage, 'offsetHeight', { value: opts.height });
  stage.getBoundingClientRect = () => stubRect(0, 0, opts.width, opts.height) as DOMRect;

  const motionY = opts.slotMotionY || 0;
  const liveMotionY = (slot: HTMLElement) => {
    const t = slot.style.transform || '';
    // withNeutralMotionAll sets transform:none !important → treat as rest.
    if (!t || t === 'none') return 0;
    const match = /translate3d\(\s*[^,]+,\s*(-?\d+(?:\.\d+)?)px/.exec(t);
    return match ? Number(match[1]) : 0;
  };
  const mkSlot = (
    index: number,
    left: number,
    top: number,
    width: number,
    height: number,
    valueTop: number,
    valueBottom: number,
    subTop: number,
    subBottom: number,
  ) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
    if (motionY) slot.style.transform = `translate3d(0px, ${motionY}px, 0px)`;
    Object.defineProperty(slot, 'offsetWidth', { value: width });
    Object.defineProperty(slot, 'offsetHeight', { value: height });
    Object.defineProperty(slot, 'offsetLeft', { value: left });
    Object.defineProperty(slot, 'offsetTop', { value: top });
    slot.getBoundingClientRect = () => stubRect(left, top + liveMotionY(slot), width, height) as DOMRect;

    const value = document.createElement('p');
    value.className = 'offer-value';
    value.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:64px';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = `${index}5%`;
    run.getBoundingClientRect = () => stubRect(
      left + 20,
      top + liveMotionY(slot) + valueTop,
      80,
      valueBottom - valueTop,
    ) as DOMRect;

    const sub = document.createElement('p');
    sub.className = 'offer-subline';
    sub.textContent = 'OFF';
    sub.style.cssText = 'position:absolute;left:0;top:64px;width:100%;height:38px';
    Object.defineProperty(sub, 'offsetTop', { value: 64 });
    sub.getBoundingClientRect = () => stubRect(
      left + 10,
      top + liveMotionY(slot) + subTop,
      100,
      subBottom - subTop,
    ) as DOMRect;

    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(sub);
    return slot;
  };

  // Top pair at y=198, bottom at y=326 — classic offers-3 triangle.
  stage.appendChild(mkSlot(1, 6, 198, 140, 229, 0, 64, 64, 90));
  stage.appendChild(mkSlot(2, 152, 198, 140, 140, 0, 64, 64, 90));
  stage.appendChild(mkSlot(3, 76, 326, 140, 127, 0, 64, 64, 90));

  const plus = document.createElement('img');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.setAttribute('src', 'data:image/svg+xml,plus');
  plus.style.cssText = 'position:absolute;left:134px;top:281px;width:26px;height:26px';
  Object.defineProperty(plus, 'offsetWidth', { value: 26 });
  Object.defineProperty(plus, 'offsetHeight', { value: 26 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        return el ? el.getBoundingClientRect() : stubRect(0, 0, 0, 0);
      },
    };
    return range as unknown as Range;
  };

  return { stage, plus };
};

test('slot scrub transform does not change triangular plus top (rest-pose measure)', () => {
  const rest = installTriangularStage({ size: '300x250', width: 300, height: 250 });
  layoutOffers(rest.stage);
  const restTop = parseFloat(rest.plus.style.top);

  const scrubbed = installTriangularStage({
    size: '300x250',
    width: 300,
    height: 250,
    slotMotionY: -12,
  });
  layoutOffers(scrubbed.stage);
  const scrubTop = parseFloat(scrubbed.plus.style.top);

  assert.ok(Number.isFinite(restTop), `rest plus top=${restTop}`);
  assert.equal(
    scrubTop,
    restTop,
    `scrub plus top=${scrubTop} should match rest top=${restTop}`,
  );
  // Slot motion must be restored after the layout pass.
  const slot1 = scrubbed.stage.querySelector('[data-offer-index="1"]') as HTMLElement;
  assert.match(slot1.style.transform || '', /translate3d\(0px, -12px, 0px\)/);
});

test('300x600 triangular plus centres in the gap below top-row sublines', () => {
  const { stage, plus } = installTriangularStage({
    size: '300x600',
    width: 300,
    height: 600,
  });
  layoutOffers(stage);

  // Top-row value centres ≈ 198+32 = 230 → digit-centred horizontal would put
  // plus top ≈ 230 - 13 = 217. Mid-gap: sublineBottom max≈198+90=288,
  // bottom valueTop≈326 → centre Y≈307 → plus top≈307-13=294.
  const top = parseFloat(plus.style.top);
  const valueCenterTop = 230 - 13;
  assert.ok(top > valueCenterTop + 20, `plus top=${top} should sit below digit-centre (~${valueCenterTop})`);
  assert.ok(top > 270 && top < 320, `plus top=${top}, expected mid-gap ~294`);
});

test('stage zoom does not shift triangular plus Y (glyphInk local metrics)', () => {
  // Editor stage uses transform:scale(); canvas font metrics are CSS-px.
  // Mixing scaled Range rects with unscaled ascent used to inflate bottoms.
  const stubCanvasMetrics = () => {
    const proto = globalThis.HTMLCanvasElement?.prototype;
    if (!proto) return () => {};
    const prev = proto.getContext;
    proto.getContext = function getContext() {
      return {
        font: '',
        measureText() {
          return {
            actualBoundingBoxAscent: 48,
            actualBoundingBoxDescent: 12,
            fontBoundingBoxAscent: 52,
            fontBoundingBoxDescent: 14,
            width: 40,
          };
        },
      } as unknown as CanvasRenderingContext2D;
    };
    return () => { proto.getContext = prev; };
  };

  const restoreCanvas = stubCanvasMetrics();
  try {
    const at1 = installTriangularStage({ size: '300x600', width: 300, height: 600 });
    // 1× client rects (export / 100% zoom)
    layoutOffers(at1.stage);
    const top1 = parseFloat(at1.plus.style.top);

    const atZoom = installTriangularStage({ size: '300x600', width: 300, height: 600 });
    const scale = 0.7;
    // Scale every getBoundingClientRect on the stage tree (editor zoom).
    const scaleRect = (el: Element) => {
      const prev = (el as HTMLElement).getBoundingClientRect.bind(el);
      (el as HTMLElement).getBoundingClientRect = () => {
        const r = prev();
        return stubRect(r.left * scale, r.top * scale, r.width * scale, r.height * scale) as DOMRect;
      };
      for (const child of el.children) scaleRect(child);
    };
    scaleRect(atZoom.stage);
    layoutOffers(atZoom.stage);
    const topZoom = parseFloat(atZoom.plus.style.top);

    assert.ok(Number.isFinite(top1), `1× plus top=${top1}`);
    assert.ok(
      Math.abs(topZoom - top1) < 1.5,
      `zoomed plus top=${topZoom} should match 1× top=${top1}`,
    );
  } finally {
    restoreCanvas();
  }
});

test('triangular three-slot layout does not fall back to horizontal digit-centred plus', () => {
  // Bottom slot slightly outside the strict top-row x-span (old detectFamily miss).
  const { document } = installDom();
  const stage = document.createElement('div');
  stage.setAttribute('data-size', '300x600');
  stage.style.cssText = 'position:relative;width:300px;height:600px';
  Object.defineProperty(stage, 'offsetWidth', { value: 300 });
  Object.defineProperty(stage, 'offsetHeight', { value: 600 });
  stage.getBoundingClientRect = () => stubRect(0, 0, 300, 600) as DOMRect;

  const mk = (index: number, left: number, top: number, w: number, h: number) => {
    const slot = document.createElement('div');
    slot.setAttribute('data-gwd-group', 'OfferSlot');
    slot.setAttribute('data-offer-index', String(index));
    slot.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    Object.defineProperty(slot, 'offsetWidth', { value: w });
    Object.defineProperty(slot, 'offsetHeight', { value: h });
    Object.defineProperty(slot, 'offsetLeft', { value: left });
    Object.defineProperty(slot, 'offsetTop', { value: top });
    slot.getBoundingClientRect = () => stubRect(left, top, w, h) as DOMRect;
    const value = document.createElement('p');
    value.className = 'offer-value';
    const run = document.createElement('span');
    run.className = 'offer-value-run';
    run.textContent = '15%';
    run.getBoundingClientRect = () => stubRect(left + 20, top + 10, 60, 40) as DOMRect;
    const sub = document.createElement('p');
    sub.className = 'offer-subline';
    sub.textContent = 'OFF';
    sub.style.cssText = 'position:absolute;left:0;top:64px';
    Object.defineProperty(sub, 'offsetTop', { value: 64 });
    sub.getBoundingClientRect = () => stubRect(left + 10, top + 55, 80, 20) as DOMRect;
    value.appendChild(run);
    slot.appendChild(value);
    slot.appendChild(sub);
    return slot;
  };

  // Bottom centred but slightly wider than the top pair span.
  stage.appendChild(mk(1, 20, 198, 120, 200));
  stage.appendChild(mk(2, 160, 198, 120, 140));
  stage.appendChild(mk(3, 10, 340, 280, 120));

  const plus = document.createElement('img');
  plus.id = 'plus-1';
  plus.className = 'plus-1';
  plus.style.cssText = 'position:absolute;left:134px;top:281px;width:26px;height:26px';
  Object.defineProperty(plus, 'offsetWidth', { value: 26 });
  Object.defineProperty(plus, 'offsetHeight', { value: 26 });
  Object.defineProperty(plus, 'offsetParent', { get: () => stage });
  stage.appendChild(plus);
  document.body.appendChild(stage);

  document.createRange = function createRange() {
    const range = {
      target: null as Element | null,
      selectNodeContents(node: Element) { range.target = node; },
      detach() {},
      getBoundingClientRect() {
        const el = range.target as HTMLElement | null;
        return el ? el.getBoundingClientRect() : stubRect(0, 0, 0, 0);
      },
    };
    return range as unknown as Range;
  };

  layoutOffers(stage);

  // Horizontal would put all three on one row (bottom.top collapses toward 198).
  const bottom = stage.querySelector('[data-offer-index="3"]') as HTMLElement;
  const bottomTop = parseFloat(bottom.style.top || '340') || bottom.offsetTop;
  assert.ok(bottomTop > 280, `bottom slot top=${bottomTop} should stay in the lower row`);

  const plusTop = parseFloat(plus.style.top);
  assert.ok(plusTop > 240, `plus top=${plusTop} should not be digit-centred (~200)`);
});
