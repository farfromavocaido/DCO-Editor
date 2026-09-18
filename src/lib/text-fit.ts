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
//   3) if allowShrink: reduce font-size until width fits; when wrap is on,
//      also until the maxLines budget fits (single-line nowrap is width-only)
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

  function isPolicyMemberVisible(element) {
    // Visibility is inherited but a child may explicitly override hidden.
    if (computedOf(element).visibility === 'hidden') return false;
    var node = element;
    while (node) {
      if (computedOf(node).display === 'none') return false;
      node = node.parentElement;
    }
    return true;
  }

  var fitStyleKeys = ['fontSize', 'letterSpacing', 'whiteSpace', 'overflow', 'textOverflow', 'maxHeight', 'transform', 'alignItems', 'height'];
  var fitAttributeKeys = ['data-fit-clipped', 'data-fit-clip-reason', 'data-fit-status', 'data-fit-requested-size', 'data-fit-rendered-size'];

  function cssStyleName(key) {
    return key.replace(/[A-Z]/g, function (letter) { return '-' + letter.toLowerCase(); });
  }

  function rememberAuthoredFitStyles(element) {
    if (element.__dcoFitAuthored) return;
    var authored = { values: {}, priorities: {}, title: element.getAttribute('title') };
    fitStyleKeys.forEach(function (key) {
      authored.values[key] = element.style[key];
      authored.priorities[key] = element.style.getPropertyPriority ? element.style.getPropertyPriority(cssStyleName(key)) : '';
    });
    element.__dcoFitAuthored = authored;
  }

  function restoreAuthoredFitStyles(element) {
    var authored = element.__dcoFitAuthored;
    if (!authored) return;
    fitStyleKeys.forEach(function (key) {
      if (element.style.setProperty) element.style.setProperty(cssStyleName(key), authored.values[key] || '', authored.priorities[key]);
      else element.style[key] = authored.values[key];
    });
    fitAttributeKeys.forEach(function (key) { element.removeAttribute(key); });
    if (authored.title === null) element.removeAttribute('title');
    else element.setAttribute('title', authored.title);
  }

  function resetStyles(element) {
    rememberAuthoredFitStyles(element);
    if (element.__dcoExplicitFitStyles) element.style.height = element.__dcoExplicitFitStyles.height;
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
    // Single-line nowrap: authored box height is the frame. Do not clamp
    // maxHeight to 1×line-height (Museo ink + that clamp shrunk chrome below
    // the purple selection box while false line-budget shrink hit the floor).
    if (!rule.wrap) return null;
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
    // Single-line nowrap shrinks on width only. Range ink for Museo at
    // line-height:1 often measures ~1.6 line-boxes — treating that as a
    // maxLines:1 overflow walked every size down to minFontSize.
    if (!rule.wrap) return false;
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

  function scopeTokensOnRoot(scope, className) {
    var parts = String(scope || '').split('.');
    var scopeActive = false;
    var partIndex;
    for (partIndex = 0; partIndex < parts.length; partIndex += 1) {
      if (!parts[partIndex]) continue;
      if (className.indexOf(' ' + parts[partIndex] + ' ') === -1) return false;
      scopeActive = true;
    }
    return scopeActive;
  }

  function explicitPolicyRule(rule) {
    if (!rule.frame || !rule.static) return rule;
    var resolved = {};
    for (var key in rule) resolved[key] = rule[key];
    // A scoped legacy mode may arrive after the frame policy. Resolve the
    // final merged policy so explicit sizing remains independent of overflow.
    if (resolved.allowShrink === undefined) resolved.allowShrink = false;
    if (!resolved.overflow) resolved.overflow = resolved.static === 'truncate' ? 'ellipsis' : 'clip';
    delete resolved.static;
    return resolved;
  }

  function resolveRule(rule, root) {
    if (!rule.scopes && !rule.targetOverrides) return explicitPolicyRule(rule);
    var resolved = {};
    var key;
    for (key in rule) {
      if (key !== 'scopes' && key !== 'scopeOnly') resolved[key] = rule[key];
    }
    var className = ' ' + String((root && root.className) || '') + ' ';
    var matchedScope = false;
    for (var scope in rule.scopes) {
      if (!scopeTokensOnRoot(scope, className)) continue;
      matchedScope = true;
      var overrides = rule.scopes[scope];
      for (key in overrides) {
        resolved[key] = overrides[key];
      }
    }
    // Host rules created only to carry variant fit must not run when idle.
    if (rule.targetOverrides) {
      var targetActive = false;
      rule.targetOverrides.forEach(function (override) {
        if (override.scope && !scopeTokensOnRoot(override.scope, className)) return;
        targetActive = true;
        for (var property in override) if (property !== 'scope') resolved[property] = override[property];
      });
      if (!targetActive) return null;
    } else if (rule.scopeOnly && !matchedScope) return null;
    return explicitPolicyRule(resolved);
  }

  function excludedFromRule(element, rule, root) {
    var className = ' ' + String((root && root.className) || '') + ' ';
    return (rule.excludeTargets || []).some(function (target) {
      return element.matches(target.selector) && target.scopes.some(function (scope) {
        return !scope || scopeTokensOnRoot(scope, className);
      });
    });
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
    if (rule.align === 'bottom' && size < fit.base && !rule.anchor) {
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

  // Explicit policy measures the entire browser-shaped text. It does not
  // rewrite frame geometry or transform, and never treats clipping as a fit.
  function measurePolicy(element, rule, size, minimum) {
    var cs = computedOf(element);
    var reasons = [];
    var lines = 0;
    var range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    var rects = Array.prototype.slice.call(range.getClientRects());
    var frame = element.getBoundingClientRect();
    var scaleX = element.offsetWidth ? frame.width / element.offsetWidth : 1;
    var scaleY = element.offsetHeight ? frame.height / element.offsetHeight : 1;
    if (!scaleX || !scaleY || !rects.length || !element.clientWidth) {
      reasons.push('unmeasurable');
    } else {
      var tops = [];
      var widthOverflow = overflowsWidth(element);
      var heightOverflow = false;
      var left = frame.left + (element.clientLeft + cssNumber(cs.paddingLeft)) * scaleX;
      var right = frame.left + (element.clientLeft + element.clientWidth - cssNumber(cs.paddingRight)) * scaleX;
      var top = frame.top + (element.clientTop + cssNumber(cs.paddingTop)) * scaleY;
      var bottom = frame.top + (element.clientTop + element.clientHeight - cssNumber(cs.paddingBottom)) * scaleY;
      rects.forEach(function (rect) {
        if (!rect.width && !rect.height) return;
        var center = (rect.top + rect.bottom) / 2;
        if (!tops.some(function (value) { return Math.abs(value - center) < lineHeightPx(cs, size) * scaleY * 0.45; })) tops.push(center);
        if (rect.left < left - 0.5 * scaleX || rect.right > right + 0.5 * scaleX) widthOverflow = true;
        if (rect.top < top - 0.5 * scaleY || rect.bottom > bottom + 0.5 * scaleY) heightOverflow = true;
      });
      lines = tops.length;
      if (widthOverflow) reasons.push('width');
      if (rule.frame === 'fixed' && heightOverflow) reasons.push('height');
      if (Number(rule.maxLines) > 0 && lines > Number(rule.maxLines)) reasons.push('max-lines');
    }
    if (size < minimum) reasons.push('minimum-size');
    if (range.detach) range.detach();
    return { reasons: reasons, lines: lines };
  }

  function fitPolicyMember(element, rule) {
    rememberAuthoredFitStyles(element);
    var keys = ['fontSize', 'letterSpacing', 'whiteSpace', 'overflow', 'textOverflow', 'height'];
    // Preserve authored inline values, including font size. Repeated font-load
    // fitting starts from authored styles rather than the previous fitted size.
    if (!element.__dcoExplicitFitStyles) {
      element.__dcoExplicitFitStyles = {};
      keys.forEach(function (key) { element.__dcoExplicitFitStyles[key] = element.style[key]; });
    }
    keys.forEach(function (key) { element.style[key] = element.__dcoExplicitFitStyles[key]; });
    var cs = computedOf(element);
    var base = cssNumber(cs.fontSize, 1);
    // A fixed font has one permitted size; dormant shrink floors do not apply.
    var minimum = rule.allowShrink === false || rule.static
      ? base
      : Math.max(Number(rule.minFontSize) || 1, base * (Number(rule.minFontSizeRatio) || 0));
    var floor = Math.min(base, minimum);
    var size = base;
    var trackingEm = 0;
    element.style.whiteSpace = rule.wrap ? 'pre-line' : 'nowrap';
    if (rule.frame === 'auto') element.style.height = 'auto';
    element.style.overflow = 'visible';
    element.style.textOverflow = 'clip';
    if (rule.tracking) {
      var minEm = Number(rule.tracking.minEm) || 0;
      while (trackingEm > minEm && overflowsWidth(element)) {
        trackingEm = Math.max(minEm, Number((trackingEm - 0.005).toFixed(3)));
        element.style.letterSpacing = trackingEm + 'em';
      }
    }
    var measurement = measurePolicy(element, rule, size, minimum);
    if (rule.allowShrink !== false && !rule.static) {
      while (size > floor && measurement.reasons.some(function (reason) { return reason !== 'minimum-size'; })) {
        size = Math.max(floor, Number((size - 0.5).toFixed(3)));
        element.style.fontSize = size + 'px';
        measurement = measurePolicy(element, rule, size, minimum);
      }
    }
    return { element: element, base: base, minimum: minimum, size: size, trackingEm: trackingEm };
  }

  function applyPolicy(root, rule) {
    var elements = Array.prototype.slice.call(root.querySelectorAll(rule.selector || '.' + rule.cssClass)).filter(function (element) {
      // Supported motion changes opacity, never visibility/display. Those
      // authored CSS properties identify state-inactive text and wrappers.
      return element.textContent && String(element.textContent).trim() && isPolicyMemberVisible(element) && !excludedFromRule(element, rule, root);
    });
    if (!elements.length) return undefined;
    var fits = elements.map(function (element) { return fitPolicyMember(element, rule); });
    var sharedSize = Math.min.apply(null, fits.map(function (fit) { return fit.size; }));
    if (rule.shared) {
      // Respect every member's floor. Conflicts are diagnosed below, not hidden
      // by forcing one member below its minimum for another member's copy.
      sharedSize = Math.min(Math.min.apply(null, fits.map(function (fit) { return fit.base; })),
        Math.max(sharedSize, Math.max.apply(null, fits.map(function (fit) { return fit.minimum; }))));
    }
    var diagnostics = fits.map(function (fit) {
      var size = rule.allowShrink === false ? fit.base : (rule.shared ? sharedSize : fit.size);
      var element = fit.element;
      element.style.fontSize = size + 'px';
      var measurement = measurePolicy(element, rule, size, fit.minimum);
      var overflow = rule.overflow || (rule.static === 'truncate' ? 'ellipsis' : 'clip');
      element.style.overflow = overflow === 'visible' ? 'visible' : 'hidden';
      element.style.textOverflow = overflow === 'ellipsis' ? 'ellipsis' : 'clip';
      if(rule.frame==='auto'&&overflow!=='visible'&&Number(rule.maxLines)>0)element.style.maxHeight=(lineHeightPx(computedOf(element),size)*Number(rule.maxLines))+'px';
      var failed = measurement.reasons.length > 0;
      element.setAttribute('data-fit-status', failed ? 'failed' : 'fitted');
      element.setAttribute('data-fit-requested-size', String(fit.base));
      element.setAttribute('data-fit-rendered-size', String(size));
      if (failed) {
        element.setAttribute('data-fit-clipped', 'true');
        element.setAttribute('data-fit-clip-reason', measurement.reasons.join(','));
      } else {
        element.removeAttribute('data-fit-clipped');
        element.removeAttribute('data-fit-clip-reason');
      }
      fit.rule = rule;
      fit.diagnostic = { targetId: element.id || null, requestedSize: fit.base, renderedSize: size, reasons: measurement.reasons, lines: measurement.lines };
      return fit.diagnostic;
    });
    return {
      size: Math.min.apply(null, diagnostics.map(function (item) { return item.renderedSize; })),
      trackingEm: Math.min.apply(null, fits.map(function (fit) { return fit.trackingEm; })),
      clipped: diagnostics.some(function (item) { return item.reasons.length > 0; }),
      diagnostics: diagnostics,
      members: fits,
    };
  }

  function applyRule(root, rule) {
    var resolved = resolveRule(rule, root);
    if (resolved && resolved.disabled) return;
    if (!resolved) return undefined;
    if (resolved.frame) return applyPolicy(root, resolved);
    var elements = [];
    root.querySelectorAll(resolved.selector || '.' + resolved.cssClass).forEach(function (element) {
      if (!element.textContent || !String(element.textContent).trim()) return;
      if (excludedFromRule(element, resolved, root)) return;
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
    // A feed update can empty or hide a previously fitted node. Restore every
    // candidate before membership checks, including now-inactive scoped rules,
    // so prior rows cannot leave font sizes, clipping or transforms behind.
    (rules || []).forEach(function (rule) {
      root.querySelectorAll(rule.selector || '.' + rule.cssClass).forEach(restoreAuthoredFitStyles);
    });
    var results = [];
    var policyGroups = {};
    (rules || []).forEach(function (rule) {
      var result = applyRule(root, rule);
      if (result !== undefined) {
        (result.members || []).forEach(function (member) {
          if (!member.rule.shared) return;
          var key = member.rule.sharedGroup || member.rule.cssClass;
          if (!policyGroups[key]) policyGroups[key] = [];
          policyGroups[key].push(member);
        });
        var entry = {
          cssClass: rule.cssClass,
          size: result.size,
          trackingEm: Number(result.trackingEm) || 0,
          clipped: Boolean(result.clipped),
        };
        if (result.diagnostics) entry.diagnostics = result.diagnostics;
        results.push(entry);
      }
    });
    // A local text policy does not detach a member from its fit relationship.
    // Equalise across resolved target rules as well as within each selector.
    Object.keys(policyGroups).forEach(function (key) {
      var members = policyGroups[key];
      if (members.length < 2) return;
      var size = Math.min.apply(null, members.map(function (member) { return member.diagnostic.renderedSize; }));
      var floor = Math.max.apply(null, members.map(function (member) { return member.minimum; }));
      var ceiling = Math.min.apply(null, members.map(function (member) { return member.base; }));
      size = Math.min(ceiling, Math.max(size, floor));
      var renderedSizes = members.map(function (member) { return member.rule.allowShrink === false ? member.base : size; });
      var conflict = renderedSizes.some(function (rendered) { return rendered !== renderedSizes[0]; });
      members.forEach(function (member, index) {
        var element = member.element;
        var renderedSize = renderedSizes[index];
        element.style.fontSize = renderedSize + 'px';
        if(member.rule.frame==='auto'&&member.rule.overflow!=='visible'&&Number(member.rule.maxLines)>0)element.style.maxHeight=(lineHeightPx(computedOf(element),renderedSize)*Number(member.rule.maxLines))+'px';
        var measurement = measurePolicy(element, member.rule, renderedSize, member.minimum);
        if (conflict) measurement.reasons.push('shared-size-conflict');
        member.diagnostic.renderedSize = renderedSize;
        member.diagnostic.reasons = measurement.reasons;
        member.diagnostic.lines = measurement.lines;
        element.setAttribute('data-fit-rendered-size', String(renderedSize));
        element.setAttribute('data-fit-status', measurement.reasons.length ? 'failed' : 'fitted');
        if (measurement.reasons.length) {
          element.setAttribute('data-fit-clipped', 'true');
          element.setAttribute('data-fit-clip-reason', measurement.reasons.join(','));
        } else {
          element.removeAttribute('data-fit-clipped');
          element.removeAttribute('data-fit-clip-reason');
        }
      });
    });
    results.forEach(function (entry) {
      if (!entry.diagnostics) return;
      entry.size = Math.min.apply(null, entry.diagnostics.map(function (item) { return item.renderedSize; }));
      entry.clipped = entry.diagnostics.some(function (item) { return item.reasons.length > 0; });
    });
    return results;
  }

  return { applyRules: applyRules, resolveRule: resolveRule };
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

/** Resolve the same final rule for authoring controls without measuring DOM. */
export const resolveTextFitRule = (rule, scopes = []) => createTextFitEngine({}).resolveRule(rule, { className: scopes.join(' ') });
