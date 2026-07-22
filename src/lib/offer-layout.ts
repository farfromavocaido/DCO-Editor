/**
 * Post-fit offer layout: equalize gaps, place pluses, side-by-side bottom lock.
 *
 * Authored as ES5 so the editor evaluates the exact function exported ads inline.
 *
 * ## Ink-first invariant (do not regress)
 * All *content* geometry — value runs, sublines, cluster bounds used for
 * gaps/plus anchors — uses canvas `actualBoundingBoxAscent/Descent` (true
 * Museo glyph ink) with the DOM Range only to locate the line + alphabetic
 * baseline. Plain Range rects are line-box-ish and put vertical pluses too
 * high (half-leading above big digits). Fall back to Range → CSS box when
 * canvas metrics are unavailable. Never use `offsetHeight` of the authored box.
 *
 * CSS boxes (`boxOf` / computed left/top/width/height) are used only for:
 *   - authored slot envelopes (where the block may sit)
 *   - layout-family detection (horizontal / vertical / triangular)
 *   - writing `element.style.left|top` (motion `transform` left alone)
 *
 * ## Transform-neutral placement (do not regress)
 * Durable `left`/`top` must not bake motion enter poses. SVG plus *images*
 * place from the CSS layout box (offset size + style left/top) — never
 * `getBoundingClientRect`, because CSS animations override inline
 * `transform:none` and would bake fadeUp `enter_dy` into top. Legacy text
 * pluses still neutralize via temporary `animation:none` + measure Range ink.
 * Fit-time `translateY` on offer-values is intentionally left alone.
 *
 * Authored subline width stays the fit constraint (ink×1.10 is design-guide only).
 *
 * Pipeline (after text-fit + symbol align):
 *   1. Clear prior slot/plus/(side-by-side) layout writes
 *   2. Side-by-side: re-anchor subline to value-ink right + ink bottoms
 *   3. Detect family from slot CSS geometry
 *   4. Equalize ink-cluster gaps in the authored envelope; place pluses
 */

/** Design guide only — not written to the DOM at runtime. */
export const OFFER_SUBLINE_INK_WIDTH_RATIO = 1.1;

/** Cap equalized inter-cluster gap as a fraction of the authored envelope. */
export const OFFER_LAYOUT_MAX_GAP_RATIO = 0.28;

const LAYOUT_OFFERS_SOURCE = `(function createLayoutOffers() {
  var MAX_GAP_RATIO = ${OFFER_LAYOUT_MAX_GAP_RATIO};
  var MIN_GAP_PX = 4;
  var SIDE_BY_SIDE_GAP_PX = 2;

  function cssNumber(value, fallback) {
    var n = parseFloat(value);
    return isFinite(n) ? n : (fallback || 0);
  }

  function emptyRect() {
    return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
  }

  function isVisible(element) {
    var node = element;
    while (node) {
      if (window.getComputedStyle(node).visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  function clearLayoutStyles(element) {
    if (!element || !element.style) return;
    element.style.left = '';
    element.style.top = '';
    element.style.width = '';
  }

  /** Map a client rect into ancestor-local px, correcting stage scale(). */
  function clientToLocal(rect, ancestor) {
    if (!rect || !ancestor) return emptyRect();
    var ar = ancestor.getBoundingClientRect();
    var sx = ar.width > 0 ? ancestor.offsetWidth / ar.width : 1;
    var sy = ar.height > 0 ? ancestor.offsetHeight / ar.height : 1;
    var left = (rect.left - ar.left) * sx;
    var top = (rect.top - ar.top) * sy;
    var width = rect.width * sx;
    var height = rect.height * sy;
    return {
      left: left,
      top: top,
      width: width,
      height: height,
      right: left + width,
      bottom: top + height,
    };
  }

  /** CSS border-box of el in ancestor space (NOT for content geometry). */
  function localRect(el, ancestor) {
    if (!el || !ancestor) return emptyRect();
    return clientToLocal(el.getBoundingClientRect(), ancestor);
  }

  var _inkCtx = null;
  var _inkCtxFailed = false;

  function inkMeasureCtx() {
    if (_inkCtxFailed) return null;
    if (_inkCtx) return _inkCtx;
    if (typeof document === 'undefined' || !document.createElement) {
      _inkCtxFailed = true;
      return null;
    }
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || ctx.measureText('5').actualBoundingBoxAscent === undefined) {
      _inkCtxFailed = true;
      return null;
    }
    _inkCtx = ctx;
    return _inkCtx;
  }

  /**
   * Line-box-ish rect via Range (fallback / horizontal span).
   * Accepts height-only rects (wrapped lines can be narrow).
   */
  function inkRect(el, ancestor) {
    if (!el || !ancestor) return emptyRect();
    var doc = el.ownerDocument;
    if (doc && doc.createRange) {
      var range = doc.createRange();
      try {
        range.selectNodeContents(el);
        var rect = range.getBoundingClientRect();
        if (rect && (rect.width > 0 || rect.height > 0)) {
          return clientToLocal(rect, ancestor);
        }
      } finally {
        if (range.detach) range.detach();
      }
    }
    return localRect(el, ancestor);
  }

  /** Prefer Range ink; if empty, CSS box. */
  function textInk(el, ancestor) {
    var ink = inkRect(el, ancestor);
    if (ink.width > 0 || ink.height > 0) return ink;
    return localRect(el, ancestor);
  }

  /**
   * True glyph ink in ancestor space (canvas actualBoundingBox* + Range line).
   * Baseline = Range line top + half-leading + fontBoundingBoxAscent when
   * available — strips CSS half-leading that made vertical pluses sit high.
   * Value runs measure digit samples so %/€ symbol size does not skew ascent.
   */
  function glyphInk(el, ancestor) {
    var fallback = textInk(el, ancestor);
    if (!el || !ancestor) return fallback;
    var ctx = inkMeasureCtx();
    if (!ctx) return fallback;
    var sample = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!sample) return fallback;
    var cs = window.getComputedStyle(el);
    ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var measureSample = sample;
    if (el.classList && el.classList.contains('offer-value-run')) {
      var digits = sample.replace(/[^\d.]/g, '');
      if (digits) measureSample = digits;
    }
    var metrics = ctx.measureText(measureSample);
    var ascent = metrics.actualBoundingBoxAscent;
    var descent = metrics.actualBoundingBoxDescent;
    if (!isFinite(ascent) || !isFinite(descent)) return fallback;

    var doc = el.ownerDocument;
    if (!(doc && doc.createRange)) return fallback;
    var range = doc.createRange();
    var line;
    try {
      range.selectNodeContents(el);
      line = range.getBoundingClientRect();
    } finally {
      if (range.detach) range.detach();
    }
    if (!(line && (line.width > 0 || line.height > 0))) return fallback;

    var fontAscent = metrics.fontBoundingBoxAscent;
    var fontDescent = metrics.fontBoundingBoxDescent;
    var baseline;
    if (isFinite(fontAscent) && isFinite(fontDescent) && (fontAscent + fontDescent) > 0.5) {
      var leading = line.height - (fontAscent + fontDescent);
      if (!(leading > 0)) leading = 0;
      baseline = line.top + leading / 2 + fontAscent;
    } else {
      var inkH = ascent + descent;
      baseline = line.top + (line.height - inkH) / 2 + ascent;
    }
    var inkTop = baseline - ascent;
    var inkBottom = baseline + descent;
    return clientToLocal({
      left: line.left,
      top: inkTop,
      width: Math.max(line.width, 1),
      height: Math.max(inkBottom - inkTop, 1),
    }, ancestor);
  }

  function unionRect(a, b) {
    if (!a || !(a.width > 0 || a.height > 0)) return b || emptyRect();
    if (!b || !(b.width > 0 || b.height > 0)) return a;
    var left = Math.min(a.left, b.left);
    var top = Math.min(a.top, b.top);
    var right = Math.max(a.right, b.right);
    var bottom = Math.max(a.bottom, b.bottom);
    return {
      left: left,
      top: top,
      width: right - left,
      height: bottom - top,
      right: right,
      bottom: bottom,
    };
  }

  /** Authored slot/plus position from computed CSS (ignores motion transform). */
  function boxOf(element) {
    var cs = window.getComputedStyle(element);
    var left = cssNumber(cs.left, element.offsetLeft || 0);
    var top = cssNumber(cs.top, element.offsetTop || 0);
    var width = cssNumber(cs.width, element.offsetWidth || 0);
    var height = cssNumber(cs.height, element.offsetHeight || 0);
    if (!(width > 0)) width = element.offsetWidth || 0;
    if (!(height > 0)) height = element.offsetHeight || 0;
    return {
      el: element,
      left: left,
      top: top,
      width: width,
      height: height,
      right: left + width,
      bottom: top + height,
      cx: left + width / 2,
      cy: top + height / 2,
    };
  }

  function isSideBySide(value, subline, slot) {
    if (!value || !subline) return false;
    // Family detection uses authored CSS boxes (stable before ink reflow).
    var v = localRect(value, slot);
    var s = localRect(subline, slot);
    if (!(v.width > 0) || !(s.width > 0)) return false;
    // Beside = starts to the right of the value column. Do NOT use a mid-box
    // "mostly below" threshold — banner singles (320x50) author the subline
    // near the value's bottom edge on purpose for baseline pairing; that used
    // to false-negative as stacked and skip the ink-bottom lock.
    var toTheRight = s.left >= v.left + v.width * 0.35;
    var startsBelowValue = s.top >= v.top + v.height;
    return toTheRight && !startsBelowValue;
  }

  function layoutSideBySide(slot, run, subline) {
    var ink = glyphInk(run, slot);
    if (!(ink.width > 0 || ink.height > 0)) return;
    // Horizontal only: keep the subline on the value’s right edge as copy
    // width changes. Do NOT rewrite top — authored Y (flex-end in a real
    // height box) owns baseline pairing, and rewriting top every fit pass
    // made inspector drags look broken.
    subline.style.left = (ink.right + SIDE_BY_SIDE_GAP_PX) + 'px';
    if (window.getComputedStyle(subline).display === 'flex') {
      subline.style.alignItems = 'flex-end';
    }
  }

  function layoutSlotChildren(slot) {
    var value = slot.querySelector('.offer-value');
    var subline = slot.querySelector('.offer-subline');
    if (!value || !subline) return;
    var run = value.querySelector('.offer-value-run') || value;
    if (isSideBySide(value, subline, slot)) {
      subline.style.width = '';
      layoutSideBySide(slot, run, subline);
    }
  }

  /**
   * Per-slot content cluster in stage space.
   * value* / subline* = canvas glyph ink (not CSS box, not Range line-box);
   * cluster* = value ∪ subline glyph ink (gap equalization + plus anchors).
   */
  function clusterForSlot(slot) {
    var value = slot.querySelector('.offer-value');
    var subline = slot.querySelector('.offer-subline');
    var run = value ? (value.querySelector('.offer-value-run') || value) : null;
    var box = boxOf(slot);
    var ink = run ? glyphInk(run, slot) : emptyRect();
    var sub = null;
    if (subline && isVisible(subline) && (subline.textContent || '').trim()) {
      sub = glyphInk(subline, slot);
    }
    var bounds = unionRect(ink, sub);
    if (!(bounds.width > 0 || bounds.height > 0)) {
      bounds = { left: 0, top: 0, width: box.width, height: box.height, right: box.width, bottom: box.height };
    }
    return {
      slot: slot,
      box: box,
      insetLeft: bounds.left,
      insetTop: bounds.top,
      width: bounds.width,
      height: bounds.height,
      clusterTop: box.top + bounds.top,
      clusterBottom: box.top + bounds.bottom,
      clusterCenterX: box.left + (bounds.left + bounds.right) / 2,
      clusterCenterY: box.top + (bounds.top + bounds.bottom) / 2,
      valueLeft: box.left + ink.left,
      valueRight: box.left + ink.right,
      valueTop: box.top + ink.top,
      valueBottom: box.top + ink.bottom,
      valueCenterY: box.top + (ink.top + ink.bottom) / 2,
      valueCenterX: box.left + (ink.left + ink.right) / 2,
      // null when no visible subline copy — vertical plus falls back to valueBottom.
      sublineTop: sub ? (box.top + sub.top) : null,
      sublineBottom: sub ? (box.top + sub.bottom) : null,
      // Authored/CSS box top (stable if Range ink is short/low).
      sublineBoxTop: subline && isVisible(subline)
        ? (box.top + cssNumber(window.getComputedStyle(subline).top, subline.offsetTop || 0))
        : null,
    };
  }

  /** Stage size key from data-size, authored style, or layout box. */
  function resolveSizeKey(scope) {
    if (!scope) return '';
    if (scope.getAttribute) {
      var ds = scope.getAttribute('data-size');
      if (ds) return ds;
    }
    if (scope.querySelector) {
      var marked = scope.querySelector('[data-size]');
      if (marked) {
        var markedSize = marked.getAttribute('data-size');
        if (markedSize) return markedSize;
      }
    }
    // Prefer explicit style width/height (editor stage) over client box —
    // transforms/zoom can make offset metrics less obvious.
    if (scope.style) {
      var sw = cssNumber(scope.style.width, 0);
      var sh = cssNumber(scope.style.height, 0);
      if (sw > 0 && sh > 0) return Math.round(sw) + 'x' + Math.round(sh);
    }
    var w = scope.clientWidth || scope.offsetWidth || 0;
    var h = scope.clientHeight || scope.offsetHeight || 0;
    if (w > 0 && h > 0) return Math.round(w) + 'x' + Math.round(h);
    return '';
  }

  function detectFamily(slots) {
    var n = slots.length;
    if (n <= 1) return 'single';
    var boxes = slots.map(boxOf);
    if (n === 2) {
      var dx = Math.abs(boxes[0].cx - boxes[1].cx);
      var dy = Math.abs(boxes[0].cy - boxes[1].cy);
      return dy > dx * 1.15 ? 'vertical' : 'horizontal';
    }
    var byTop = boxes.slice().sort(function(a, b) { return a.top - b.top; });
    var rowTol = Math.max(8, Math.min(boxes[0].height, boxes[1].height, boxes[2].height) * 0.35);
    var topRow = [byTop[0]];
    for (var i = 1; i < byTop.length; i += 1) {
      if (Math.abs(byTop[i].top - byTop[0].top) <= rowTol) topRow.push(byTop[i]);
    }
    if (topRow.length === 2) {
      var bottom = null;
      for (var j = 0; j < boxes.length; j += 1) {
        if (topRow.indexOf(boxes[j]) === -1) bottom = boxes[j];
      }
      if (bottom && bottom.top > topRow[0].top + rowTol) {
        var left = Math.min(topRow[0].left, topRow[1].left);
        var right = Math.max(topRow[0].right, topRow[1].right);
        if (bottom.cx >= left && bottom.cx <= right) return 'triangular';
      }
    }
    var lefts = boxes.map(function(b) { return b.left; });
    var leftSpan = Math.max.apply(null, lefts) - Math.min.apply(null, lefts);
    var tops = boxes.map(function(b) { return b.top; });
    var topSpan = Math.max.apply(null, tops) - Math.min.apply(null, tops);
    return topSpan > leftSpan * 1.15 ? 'vertical' : 'horizontal';
  }

  function clampGap(rawGap, envelopeSpan) {
    var maxGap = Math.max(MIN_GAP_PX, envelopeSpan * MAX_GAP_RATIO);
    if (!(rawGap > 0)) return MIN_GAP_PX;
    if (rawGap > maxGap) return maxGap;
    return rawGap;
  }

  /**
   * Run fn while el is at motion rest (legacy text pluses). CSS animations
   * override plain inline transform:none, so we must clear the animation with
   * !important for the measure. Callers should prefer layout while the stage
   * clock is still held (.motion-ready not set) so restoring the animation
   * does not desync a running timeline.
   */
  function withNeutralMotion(el, fn) {
    if (!el || !el.style) return fn();
    var style = el.style;
    var prevTransform = style.transform;
    var prevWebkitTransform = style.webkitTransform;
    var prevAnimation = style.animation;
    var prevWebkitAnimation = style.webkitAnimation;
    var prevTransition = style.transition;
    style.setProperty('animation', 'none', 'important');
    style.setProperty('-webkit-animation', 'none', 'important');
    style.setProperty('transform', 'none', 'important');
    style.setProperty('-webkit-transform', 'none', 'important');
    style.transition = 'none';
    // Force style flush before measuring.
    void el.offsetWidth;
    try {
      return fn();
    } finally {
      style.removeProperty('animation');
      style.removeProperty('-webkit-animation');
      style.removeProperty('transform');
      style.removeProperty('-webkit-transform');
      style.transform = prevTransform;
      style.webkitTransform = prevWebkitTransform;
      style.animation = prevAnimation;
      style.webkitAnimation = prevWebkitAnimation;
      style.transition = prevTransition;
    }
  }

  /**
   * Place plus relative to stage (x, y).
   * - alignY 'center' (default): ink/box centre on (x, y)
   * - alignY 'top': ink/box top on y, centre on x
   * SVG plus images fill a square box — place from layout box only (CSS
   * animation transforms must not affect durable left/top).
   * Legacy text pluses still use Range ink under withNeutralMotion.
   */
  function placePlus(plus, x, y, alignY) {
    if (!plus || !isVisible(plus)) return;
    var pw = plus.offsetWidth || cssNumber(window.getComputedStyle(plus).width, 16);
    var ph = plus.offsetHeight || cssNumber(window.getComputedStyle(plus).height, 16);
    var isImg = plus.tagName === 'IMG' || plus.tagName === 'img';
    if (isImg) {
      // Layout box ignores CSS animation transforms (unlike getBoundingClientRect).
      plus.style.left = (x - pw / 2) + 'px';
      plus.style.top = (alignY === 'top' ? y : (y - ph / 2)) + 'px';
      return;
    }
    var parent = plus.offsetParent || plus.parentElement;
    plus.style.left = (x - pw / 2) + 'px';
    plus.style.top = (y - ph / 2) + 'px';
    if (!parent) return;
    withNeutralMotion(plus, function() {
      var ink = textInk(plus, parent);
      if (!(ink.width > 0 || ink.height > 0)) return;
      var inkCx = (ink.left + ink.right) / 2;
      var inkCy = (ink.top + ink.bottom) / 2;
      var curLeft = cssNumber(plus.style.left, 0);
      var curTop = cssNumber(plus.style.top, 0);
      plus.style.left = (curLeft + (x - inkCx)) + 'px';
      if (alignY === 'top') {
        plus.style.top = (curTop + (y - ink.top)) + 'px';
      } else {
        plus.style.top = (curTop + (y - inkCy)) + 'px';
      }
    });
  }

  /** Horizontal: plus between adjacent *value* inks (X + Y). */
  function plusAnchorHorizontal(leftCluster, rightCluster) {
    return {
      x: (leftCluster.valueRight + rightCluster.valueLeft) / 2,
      y: (leftCluster.valueCenterY + rightCluster.valueCenterY) / 2,
    };
  }

  /**
   * Vertical: plus centred in the gap below the upper subline’s glyph-ink
   * bottom (fallback: value glyph bottom when no subline) and above the next
   * value glyph top. Edges come from canvas actualBoundingBox* (see glyphInk).
   */
  function plusAnchorVertical(upperCluster, lowerCluster, blockCx) {
    var upperBottom = upperCluster.sublineBottom != null
      ? upperCluster.sublineBottom
      : upperCluster.valueBottom;
    return {
      x: blockCx,
      y: (upperBottom + lowerCluster.valueTop) / 2,
    };
  }

  /**
   * Triangular: X between the top pair’s value inks.
   * Default Y = lower of the two top-row value bottoms (plus top-aligned).
   * On MPU / 970×250: plus top meets top-row subline caps (SVG fills its box).
   */
  function plusAnchorTriangular(topA, topB, _bottomCluster, alignToSublineTop) {
    var valueY = Math.max(topA.valueBottom, topB.valueBottom);
    var y = valueY;
    if (alignToSublineTop) {
      var tops = [];
      if (topA.sublineTop != null) tops.push(topA.sublineTop);
      if (topB.sublineTop != null) tops.push(topB.sublineTop);
      if (topA.sublineBoxTop != null) tops.push(topA.sublineBoxTop);
      if (topB.sublineBoxTop != null) tops.push(topB.sublineBoxTop);
      if (tops.length) {
        // Prefer subline caps when they raise the plus; never drop below
        // the value-bottom junction (stacked sublines sit lower).
        y = Math.min(valueY, Math.min.apply(null, tops));
      }
    }
    return {
      x: (topA.valueRight + topB.valueLeft) / 2,
      y: y,
    };
  }

  function remeasureSorted(slots, axis) {
    var clusters = slots.map(clusterForSlot);
    if (axis === 'x') {
      return clusters.sort(function(a, b) { return a.box.left - b.box.left; });
    }
    return clusters.sort(function(a, b) { return a.box.top - b.box.top; });
  }

  function distributeHorizontal(slots, pluses) {
    var clusters = remeasureSorted(slots, 'x');
    var envelopeLeft = Math.min.apply(null, clusters.map(function(c) { return c.box.left; }));
    var envelopeRight = Math.max.apply(null, clusters.map(function(c) { return c.box.right; }));
    var span = envelopeRight - envelopeLeft;
    var totalW = clusters.reduce(function(sum, c) { return sum + c.width; }, 0);
    var gaps = clusters.length - 1;
    var rawGap = gaps > 0 ? (span - totalW) / gaps : 0;
    var gap = gaps > 0 ? clampGap(rawGap, span) : 0;
    if (totalW + gap * gaps > span && gaps > 0) {
      gap = Math.max(MIN_GAP_PX, (span - totalW) / gaps);
      if (gap < 0) gap = 0;
    }
    var blockW = totalW + gap * gaps;
    var blockLeft = (envelopeLeft + envelopeRight) / 2 - blockW / 2;
    if (blockLeft < envelopeLeft) blockLeft = envelopeLeft;
    if (blockLeft + blockW > envelopeRight) blockLeft = envelopeRight - blockW;

    var cursor = blockLeft;
    for (var i = 0; i < clusters.length; i += 1) {
      clusters[i].slot.style.left = (cursor - clusters[i].insetLeft) + 'px';
      cursor += clusters[i].width + gap;
    }
    clusters = remeasureSorted(slots, 'x');
    for (var p = 0; p < gaps; p += 1) {
      var anchor = plusAnchorHorizontal(clusters[p], clusters[p + 1]);
      placePlus(pluses[p], anchor.x, anchor.y);
    }
  }

  function distributeVertical(slots, pluses) {
    var clusters = remeasureSorted(slots, 'y');
    var envelopeTop = Math.min.apply(null, clusters.map(function(c) { return c.box.top; }));
    var envelopeBottom = Math.max.apply(null, clusters.map(function(c) { return c.box.bottom; }));
    var span = envelopeBottom - envelopeTop;
    var totalH = clusters.reduce(function(sum, c) { return sum + c.height; }, 0);
    var gaps = clusters.length - 1;
    var rawGap = gaps > 0 ? (span - totalH) / gaps : 0;
    var gap = gaps > 0 ? clampGap(rawGap, span) : 0;
    if (totalH + gap * gaps > span && gaps > 0) {
      gap = Math.max(0, (span - totalH) / gaps);
    }
    var blockH = totalH + gap * gaps;
    var blockTop = (envelopeTop + envelopeBottom) / 2 - blockH / 2;
    if (blockTop < envelopeTop) blockTop = envelopeTop;
    if (blockTop + blockH > envelopeBottom) blockTop = envelopeBottom - blockH;

    var cursor = blockTop;
    for (var i = 0; i < clusters.length; i += 1) {
      clusters[i].slot.style.top = (cursor - clusters[i].insetTop) + 'px';
      cursor += clusters[i].height + gap;
    }
    clusters = remeasureSorted(slots, 'y');
    var blockCx = clusters.reduce(function(sum, c) { return sum + c.valueCenterX; }, 0) / clusters.length;
    for (var p = 0; p < gaps; p += 1) {
      var anchor = plusAnchorVertical(clusters[p], clusters[p + 1], blockCx);
      placePlus(pluses[p], anchor.x, anchor.y);
    }
  }

  function distributeTriangular(slots, pluses, sizeKey) {
    var boxes = slots.map(function(slot) {
      return { slot: slot, box: boxOf(slot), cluster: clusterForSlot(slot) };
    });
    var rowTol = Math.max(8, Math.min.apply(null, boxes.map(function(b) { return b.box.height; })) * 0.35);
    var byTop = boxes.slice().sort(function(a, b) { return a.box.top - b.box.top; });
    var topRow = [];
    var bottom = null;
    for (var i = 0; i < byTop.length; i += 1) {
      if (!topRow.length || Math.abs(byTop[i].box.top - byTop[0].box.top) <= rowTol) {
        topRow.push(byTop[i]);
      } else {
        bottom = byTop[i];
      }
    }
    if (topRow.length !== 2 || !bottom) {
      distributeHorizontal(slots, pluses);
      return;
    }
    topRow.sort(function(a, b) { return a.box.left - b.box.left; });

    var envelopeLeft = Math.min(topRow[0].box.left, topRow[1].box.left, bottom.box.left);
    var envelopeRight = Math.max(topRow[0].box.right, topRow[1].box.right, bottom.box.right);
    var span = envelopeRight - envelopeLeft;
    var topW = topRow[0].cluster.width + topRow[1].cluster.width;
    var authoredGap = (topRow[1].box.left + topRow[1].cluster.insetLeft)
      - (topRow[0].box.left + topRow[0].cluster.insetLeft + topRow[0].cluster.width);
    var gap = clampGap(authoredGap > 0 ? authoredGap : (span - topW) / 3, span);
    var topBlockW = topW + gap;
    var topBlockLeft = (envelopeLeft + envelopeRight) / 2 - topBlockW / 2;
    if (topBlockLeft < envelopeLeft) topBlockLeft = envelopeLeft;

    var cursor = topBlockLeft;
    for (var t = 0; t < 2; t += 1) {
      var tr = topRow[t];
      tr.slot.style.left = (cursor - tr.cluster.insetLeft) + 'px';
      cursor += tr.cluster.width + gap;
    }

    topRow = topRow.map(function(item) {
      return { slot: item.slot, box: boxOf(item.slot), cluster: clusterForSlot(item.slot) };
    });
    var topCentroidX = (topRow[0].cluster.valueCenterX + topRow[1].cluster.valueCenterX) / 2;
    bottom = { slot: bottom.slot, box: boxOf(bottom.slot), cluster: clusterForSlot(bottom.slot) };
    bottom.slot.style.left = (topCentroidX - bottom.cluster.width / 2 - bottom.cluster.insetLeft) + 'px';
    bottom = { slot: bottom.slot, box: boxOf(bottom.slot), cluster: clusterForSlot(bottom.slot) };

    // MPU + 970×250: raise plus so glyph top meets top-row subline tops.
    // 300×600 (and anything else triangular) keeps value-bottom alignment.
    var alignToSublineTop = sizeKey === '300x250' || sizeKey === '970x250';
    var anchor = plusAnchorTriangular(
      topRow[0].cluster,
      topRow[1].cluster,
      bottom.cluster,
      alignToSublineTop,
    );
    placePlus(pluses[0], anchor.x, anchor.y, 'top');
  }

  return function layoutOffers(root) {
    var scope = root;
    if (!scope) {
      if (typeof document === 'undefined') return;
      scope = document;
    }
    if (!scope || !scope.querySelectorAll) return;
    var sizeKey = resolveSizeKey(scope);

    var slotNodes = scope.querySelectorAll('[data-gwd-group="OfferSlot"]');
    var slots = [];
    Array.prototype.forEach.call(slotNodes, function(slot) {
      if (!isVisible(slot)) return;
      slots.push(slot);
    });
    if (!slots.length) return;

    slots.sort(function(a, b) {
      var ai = parseInt(a.getAttribute('data-offer-index') || '0', 10);
      var bi = parseInt(b.getAttribute('data-offer-index') || '0', 10);
      return ai - bi;
    });

    var pluses = [];
    for (var p = 1; p <= 2; p += 1) {
      var plus = scope.querySelector
        ? (scope.querySelector('#plus-' + p) || scope.querySelector('.plus-' + p))
        : null;
      if (!plus && scope.ownerDocument) {
        plus = scope.ownerDocument.getElementById('plus-' + p);
      }
      pluses.push(plus && isVisible(plus) ? plus : null);
    }

    for (var i = 0; i < slots.length; i += 1) {
      clearLayoutStyles(slots[i]);
      var sub = slots[i].querySelector('.offer-subline');
      if (sub) {
        clearLayoutStyles(sub);
        sub.style.alignItems = '';
      }
    }
    for (var j = 0; j < pluses.length; j += 1) {
      if (pluses[j]) clearLayoutStyles(pluses[j]);
    }

    for (var s = 0; s < slots.length; s += 1) {
      layoutSlotChildren(slots[s]);
    }

    var family = detectFamily(slots);
    if (family === 'horizontal') distributeHorizontal(slots, pluses);
    else if (family === 'vertical') distributeVertical(slots, pluses);
    else if (family === 'triangular') distributeTriangular(slots, pluses, sizeKey);
  };
})`;

/** Factory matching the inlined export runtime — editor and ads share one body. */
export const createLayoutOffers = new Function(
  `"use strict"; return ${LAYOUT_OFFERS_SOURCE};`,
)();

/** Editor-preview entry point; pass the stage root when available. */
export const layoutOffers = (root?: ParentNode | Document | null) => {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope) return;
  createLayoutOffers()(scope);
};

/** Inlined into exported Studio HTML (defines layoutOffers). */
export const layoutOffersRuntime = `
        var layoutOffers = ${LAYOUT_OFFERS_SOURCE}();
`.trim();
