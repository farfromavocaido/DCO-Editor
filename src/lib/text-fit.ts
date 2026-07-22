// @ts-nocheck
// The single text-fit engine shared by the editor preview and the exported
// Studio HTML.
//
// The engine is authored as a SOURCE STRING, not a function: exported ads
// inline it verbatim, and the editor evaluates the very same string below.
// (Serializing a compiled function with Function.prototype.toString() is not
// safe — bundlers inject helpers like esbuild's __name into compiled bodies,
// which then crash inside the exported ad. A string can't be transformed.)
//
// RULES for the source string:
//  - ES5 only (var/function; no arrows, spreads, template literals, optional
//    chaining) so it runs in any ad-serving context.
//  - Fully self-contained: no references to anything outside the factory.
//  - No backticks or ${ sequences (it lives in a template literal).
//
// Rule shape is documented in text-fit-rules.ts (the only producer of rules).
//
// Fit pipeline per element:
//   1) set white-space (pre-line when wrap, else nowrap)
//   2) tracking squeeze (offer values)
//   3) if allowShrink: reduce font-size until width + maxLines fit
//   4) clip leftover overflow; mark data-fit-clipped when still overflowing
// Modes come from normalizeFitConfig (text-fit-rules.ts). shared: true
// equalizes final font size across visible members; tracking stays per-box.

const TEXT_FIT_ENGINE_SOURCE = `(function createTextFitEngine(win) {
  function computedOf(element) {
    return win.getComputedStyle(element);
  }

  function cssNumber(value, fallback) {
    var numeric = parseFloat(value);
    return isFinite(numeric) ? numeric : (fallback || 0);
  }

  function isVisible(element) {
    var node = element;
    while (node) {
      if (computedOf(node).visibility === 'hidden') return false;
      node = node.parentElement;
    }
    return true;
  }

  function resetStyles(element) {
    element.style.fontSize = '';
    element.style.letterSpacing = '';
    element.style.whiteSpace = '';
    element.style.overflow = '';
    element.style.textOverflow = '';
    element.style.maxHeight = '';
    element.style.transform = '';
    element.style.alignItems = '';
  }

  function lineHeightPx(cs, fontSize) {
    var parsed = cssNumber(cs.lineHeight, 0);
    return parsed > 0 ? parsed : fontSize * 1.15;
  }

  function contentHeight(element) {
    var doc = element.ownerDocument;
    if (doc && doc.createRange) {
      var range = doc.createRange();
      try {
        range.selectNodeContents(element);
        var rect = range.getBoundingClientRect();
        if (rect && rect.height > 0) return rect.height;
      } finally {
        if (range.detach) range.detach();
      }
    }
    return element.scrollHeight;
  }

  function maxTextHeight(element, rule, cs, fontSize) {
    var maxLines = Number(rule.maxLines);
    if (!isFinite(maxLines) || maxLines <= 0) return null;
    var lineHeight = lineHeightPx(cs, fontSize);
    var maxHeight = lineHeight * maxLines;
    var boxHeight = Number(element.clientHeight) || 0;
    if (boxHeight <= maxHeight) return maxHeight;
    var browserLineBoxSlack = Math.max(2, lineHeight * 0.15);
    return Math.min(boxHeight, maxHeight + browserLineBoxSlack);
  }

  function overflowsWidth(element) {
    // Ignore sub-pixel noise (common with fractional layout), but treat a
    // full extra CSS pixel as real overflow.
    return element.clientWidth > 0 && (element.scrollWidth - element.clientWidth) > 0.5;
  }

  function exceedsMaxLines(element, rule, cs, fontSize) {
    var maxLines = Number(rule.maxLines);
    if (!isFinite(maxLines) || maxLines <= 0) return false;
    var lineHeight = lineHeightPx(cs, fontSize);
    if (lineHeight <= 0) return false;
    // Range/line-box measurements often land a hair over N * line-height for
    // copy that clearly fits in N lines. Require more than half an extra line
    // before treating it as over budget (avoids the maxLines→n+1 false clip).
    var lines = contentHeight(element) / lineHeight;
    return lines > maxLines + 0.5;
  }

  function tooTall(element, rule, cs, fontSize) {
    return exceedsMaxLines(element, rule, cs, fontSize);
  }

  function overflowing(element, rule, cs, fontSize) {
    return overflowsWidth(element) || tooTall(element, rule, cs, fontSize);
  }

  function resolveRule(rule, root) {
    if (!rule.scopes) return rule;
    var resolved = {};
    var key;
    for (key in rule) {
      if (key !== 'scopes') resolved[key] = rule[key];
    }
    var className = ' ' + String((root && root.className) || '') + ' ';
    for (var scope in rule.scopes) {
      if (className.indexOf(' ' + scope + ' ') === -1) continue;
      var overrides = rule.scopes[scope];
      for (key in overrides) {
        resolved[key] = overrides[key];
      }
    }
    return resolved;
  }

  function applyStatic(element, rule) {
    if (rule.static === 'clip') {
      element.style.overflow = 'hidden';
      return;
    }
    element.style.whiteSpace = 'nowrap';
    element.style.overflow = 'hidden';
    element.style.textOverflow = 'ellipsis';
  }

  function fitMember(element, rule) {
    resetStyles(element);
    element.removeAttribute('data-fit-clipped');
    var cs = computedOf(element);
    var base = cssNumber(cs.fontSize, Number(rule.minFontSize) || 1);
    var ratio = Number(rule.minFontSizeRatio);
    var floor = Math.max(Number(rule.minFontSize) || 1, ratio > 0 ? base * ratio : 0);
    if (floor > base) floor = base;
    var lineRatio = base > 0 ? lineHeightPx(cs, base) / base : 1;
    // Explicit white-space so CSS cannot fight the mode.
    // pre-line keeps authored newlines and still wraps at word boundaries.
    element.style.whiteSpace = rule.wrap ? 'pre-line' : 'nowrap';
    element.style.fontSize = base + 'px';
    var trackingEm = 0;
    if (rule.tracking && overflowsWidth(element)) {
      var minEm = Number(rule.tracking.minEm) || 0;
      while (trackingEm > minEm && overflowsWidth(element)) {
        trackingEm = Math.max(minEm, Number((trackingEm - 0.005).toFixed(3)));
        element.style.letterSpacing = trackingEm + 'em';
      }
    }
    var size = base;
    cs = computedOf(element);
    // allowShrink defaults true for engine-level rules; mode "wrap" sets false.
    var allowShrink = rule.allowShrink !== false;
    if (allowShrink) {
      while (size > floor && overflowing(element, rule, cs, size)) {
        size = Math.max(floor, Number((size - 0.5).toFixed(3)));
        element.style.fontSize = size + 'px';
        cs = computedOf(element);
      }
    }
    return { element: element, base: base, size: size, trackingEm: trackingEm, lineRatio: lineRatio };
  }

  function applyFinal(fit, rule, size, trackingEm) {
    var element = fit.element;
    element.style.fontSize = size + 'px';
    if (trackingEm !== 0) element.style.letterSpacing = trackingEm + 'em';
    var cs = computedOf(element);
    var maxHeight = maxTextHeight(element, rule, cs, size);
    if (maxHeight !== null) {
      element.style.maxHeight = maxHeight + 'px';
      element.style.overflow = 'hidden';
    } else if (overflowsWidth(element)) {
      element.style.overflow = 'hidden';
    }
    // Bottom-aligned flex boxes (align-items: flex-end) keep that alignment
    // when copy wraps: the last line stays on the baseline and earlier lines
    // stack upward. Do not flip to flex-start — that was fighting Text Y = Bottom.
    if (rule.align === 'bottom' && size < fit.base) {
      var delta = (fit.base - size) * fit.lineRatio;
      if (delta > 0.25) element.style.transform = 'translateY(' + delta.toFixed(2) + 'px)';
    }
    cs = computedOf(element);
    var widthClip = overflowsWidth(element);
    var linesClip = exceedsMaxLines(element, rule, cs, size);
    var clipped = widthClip || linesClip;
    if (clipped) {
      element.setAttribute('data-fit-clipped', 'true');
      var reasons = [];
      if (widthClip) reasons.push('width');
      if (linesClip) {
        var maxLines = Number(rule.maxLines);
        reasons.push(
          isFinite(maxLines) && maxLines > 0
            ? ('max lines (' + maxLines + ')')
            : 'height',
        );
      }
      element.setAttribute(
        'title',
        'Clipped: still overflows ' + reasons.join(' and ') + ' after fitting',
      );
      element.setAttribute('data-fit-clip-reason', reasons.join(','));
    } else {
      element.removeAttribute('data-fit-clipped');
      element.removeAttribute('data-fit-clip-reason');
      if (element.getAttribute('title') && String(element.getAttribute('title')).indexOf('Clipped:') === 0) {
        element.removeAttribute('title');
      }
    }
    return clipped;
  }

  function applyRule(root, rule) {
    var resolved = resolveRule(rule, root);
    var elements = [];
    root.querySelectorAll('.' + resolved.cssClass).forEach(function (element) {
      if (!element.textContent || !String(element.textContent).trim()) return;
      if (!isVisible(element)) return;
      elements.push(element);
    });
    if (!elements.length) return undefined;

    if (resolved.static) {
      var staticSizes = elements.map(function (element) {
        resetStyles(element);
        element.removeAttribute('data-fit-clipped');
        applyStatic(element, resolved);
        var cs = computedOf(element);
        var size = cssNumber(cs.fontSize, Number(resolved.minFontSize) || 1);
        if (overflowing(element, resolved, cs, size)) {
          element.setAttribute('data-fit-clipped', 'true');
          element.setAttribute('title', 'Clipped: overflow hidden (clip/truncate mode)');
          element.setAttribute('data-fit-clip-reason', 'static');
        }
        return size;
      });
      var anyClipped = elements.some(function (element) {
        return element.getAttribute('data-fit-clipped') === 'true';
      });
      return { size: Math.min.apply(null, staticSizes), trackingEm: 0, clipped: anyClipped };
    }

    var fits = elements.map(function (element) {
      return fitMember(element, resolved);
    });
    var sizes = fits.map(function (fit) { return fit.size; });
    var clipped = false;
    if (resolved.shared) {
      // Size stays locked across the group; tracking is recomputed per box at
      // that shared size so a tight value cannot crush a comfortable neighbour.
      var sharedSize = Math.min.apply(null, sizes);
      fits.forEach(function (fit) {
        var element = fit.element;
        element.style.fontSize = sharedSize + 'px';
        element.style.letterSpacing = '';
        var trackingEm = 0;
        if (resolved.tracking && overflowsWidth(element)) {
          var minEm = Number(resolved.tracking.minEm) || 0;
          while (trackingEm > minEm && overflowsWidth(element)) {
            trackingEm = Math.max(minEm, Number((trackingEm - 0.005).toFixed(3)));
            element.style.letterSpacing = trackingEm + 'em';
          }
        }
        fit.size = sharedSize;
        fit.trackingEm = trackingEm;
        if (applyFinal(fit, resolved, sharedSize, trackingEm)) clipped = true;
      });
      return {
        size: sharedSize,
        trackingEm: Math.min.apply(null, fits.map(function (fit) { return fit.trackingEm; })),
        clipped: clipped,
      };
    }
    fits.forEach(function (fit) {
      if (applyFinal(fit, resolved, fit.size, fit.trackingEm)) clipped = true;
    });
    return {
      size: Math.min.apply(null, sizes),
      trackingEm: Math.min.apply(null, fits.map(function (fit) { return fit.trackingEm; })),
      clipped: clipped,
    };
  }

  function applyRules(root, rules) {
    var results = [];
    (rules || []).forEach(function (rule) {
      var result = applyRule(root, rule);
      if (result !== undefined) {
        results.push({
          cssClass: rule.cssClass,
          size: result.size,
          trackingEm: Number(result.trackingEm) || 0,
          clipped: Boolean(result.clipped),
        });
      }
    });
    return results;
  }

  return { applyRules: applyRules };
})`;

/** Engine source, inlined verbatim into exported Studio HTML. */
export const textFitEngineSource = () => TEXT_FIT_ENGINE_SOURCE;

/** The evaluated engine factory — the editor runs the exact exported source. */
export const createTextFitEngine = new Function(`"use strict"; return ${TEXT_FIT_ENGINE_SOURCE};`)();

/** Editor-preview entry point; returns { sizes, trackings, clipped } Maps by cssClass. */
export const applyTextFitting = (root, rules = [], options = {}) => {
  const win = options.win || (typeof window !== 'undefined' ? window : null);
  const sizes = new Map();
  const trackings = new Map();
  const clipped = new Map();
  if (!win || !root) return { sizes, trackings, clipped };
  createTextFitEngine(win).applyRules(root, rules).forEach((result) => {
    sizes.set(result.cssClass, result.size);
    trackings.set(result.cssClass, Number(result.trackingEm) || 0);
    clipped.set(result.cssClass, Boolean(result.clipped));
  });
  return { sizes, trackings, clipped };
};
