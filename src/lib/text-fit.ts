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
// Fit pipeline per element:  tracking squeeze -> wrap (bounded by maxLines,
// growing DOWN) -> shrink to a per-variant floor. Rules with shared: true
// equalize the final size and tracking across all visible members so pricing
// blocks stay uniform.

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
    return element.clientWidth > 0 && element.scrollWidth > element.clientWidth;
  }

  function tooTall(element, rule, cs, fontSize) {
    var maxHeight = maxTextHeight(element, rule, cs, fontSize);
    if (maxHeight === null) return false;
    return contentHeight(element) > maxHeight + 1;
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
    var cs = computedOf(element);
    var base = cssNumber(cs.fontSize, Number(rule.minFontSize) || 1);
    var ratio = Number(rule.minFontSizeRatio);
    var floor = Math.max(Number(rule.minFontSize) || 1, ratio > 0 ? base * ratio : 0);
    if (floor > base) floor = base;
    var lineRatio = base > 0 ? lineHeightPx(cs, base) / base : 1;
    if (rule.wrap) element.style.whiteSpace = 'normal';
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
    while (size > floor && overflowing(element, rule, cs, size)) {
      size = Math.max(floor, Number((size - 0.5).toFixed(3)));
      element.style.fontSize = size + 'px';
      cs = computedOf(element);
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
    }
    if (rule.wrap) {
      var lineHeight = lineHeightPx(cs, size);
      var lines = lineHeight > 0 ? Math.round(contentHeight(element) / lineHeight) : 1;
      var isFlex = cs.display && String(cs.display).indexOf('flex') !== -1;
      if (lines > 1 && isFlex && cs.alignItems === 'flex-end') {
        // Split downwards: the first line must stay put, the second line goes
        // below it, instead of a bottom-anchored box pushing line one upwards.
        element.style.alignItems = 'flex-start';
      }
    }
    if (rule.align === 'bottom' && size < fit.base) {
      var delta = (fit.base - size) * fit.lineRatio;
      if (delta > 0.25) element.style.transform = 'translateY(' + delta.toFixed(2) + 'px)';
    }
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
        applyStatic(element, resolved);
        return cssNumber(computedOf(element).fontSize, Number(resolved.minFontSize) || 1);
      });
      return Math.min.apply(null, staticSizes);
    }

    var fits = elements.map(function (element) {
      return fitMember(element, resolved);
    });
    var sizes = fits.map(function (fit) { return fit.size; });
    var trackings = fits.map(function (fit) { return fit.trackingEm; });
    if (resolved.shared) {
      var sharedSize = Math.min.apply(null, sizes);
      var sharedTracking = Math.min.apply(null, trackings);
      fits.forEach(function (fit) {
        applyFinal(fit, resolved, sharedSize, sharedTracking);
      });
      return sharedSize;
    }
    fits.forEach(function (fit) {
      applyFinal(fit, resolved, fit.size, fit.trackingEm);
    });
    return Math.min.apply(null, sizes);
  }

  function applyRules(root, rules) {
    var results = [];
    (rules || []).forEach(function (rule) {
      var size = applyRule(root, rule);
      if (size !== undefined) results.push({ cssClass: rule.cssClass, size: size });
    });
    return results;
  }

  return { applyRules: applyRules };
})`;

/** Engine source, inlined verbatim into exported Studio HTML. */
export const textFitEngineSource = () => TEXT_FIT_ENGINE_SOURCE;

/** The evaluated engine factory — the editor runs the exact exported source. */
export const createTextFitEngine = new Function(`"use strict"; return ${TEXT_FIT_ENGINE_SOURCE};`)();

/** Editor-preview entry point; returns a Map of cssClass -> final font size. */
export const applyTextFitting = (root, rules = [], options = {}) => {
  const win = options.win || (typeof window !== 'undefined' ? window : null);
  const results = new Map();
  if (!win || !root) return results;
  createTextFitEngine(win).applyRules(root, rules).forEach(({ cssClass, size }) => {
    results.set(cssClass, size);
  });
  return results;
};
