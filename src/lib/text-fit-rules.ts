// @ts-nocheck
// Single source of truth for deriving text-fit rules from the creative JSON.
// Consumed by BOTH the editor preview (editor-store) and the exported ad
// runtime (creative-exporter) so the two can never drift apart again.
//
// Normalized rule shape consumed by createTextFitEngine (text-fit.ts):
//   {
//     cssClass,             string      elements matched via `.${cssClass}`
//     shared,               boolean     equalize final size/tracking across visible members
//     wrap,                 boolean     allow wrapping (white-space: normal)
//     allowShrink,          boolean     reduce font-size until copy fits (default true)
//     static,               'clip' | 'truncate' | undefined  no wrap/shrink — overflow only
//     maxLines,             number?     line budget; with shrink, wrap is allowed when > 1
//     minFontSize,          number?     absolute px floor
//     minFontSizeRatio,     number?     floor as a fraction of the CSS base size (per variant)
//     tracking: { minEm },  object?     negative letter-spacing squeeze tried before shrinking (per box)
//     align: 'bottom',      string?     anchor glyph bottoms when the final size is below base
//     scopes,               object?     per-variant overrides keyed by scope class (offers-2 ...)
//   }
//
// Authored modes (normalizeFitConfig):
//   shrink — shrink first. maxLines <= 1 (or unset) => single line (no wrap).
//            maxLines > 1 => wrap up to that many lines, shrink until it fits.
//   wrap   — keep designed font size; wrap to maxLines; never shrink.
//   clip / truncate — static overflow only (no wrap/shrink).

import { HEADLINE_CSS_CLASS, isHeadlineLayer } from './creative-model';
import { targetIdToSelector } from './creative-css';
import { resolveTextFitRule } from './text-fit';
import { materializeCreativeOwnership, ownershipRuleSpecificity } from './creative-ownership';

const OFFER_VALUE_CLASS = 'offer-value';
const OFFER_SUBLINE_CLASS = 'offer-subline';

/** Pricing values share a final size, stay bottom-anchored; tracking is per box. */
const OFFER_VALUE_DEFAULTS = {
  shared: true,
  wrap: false,
  minFontSize: 8,
  minFontSizeRatio: 0.5,
  // Squeeze letter-spacing before shrinking type. Applied independently per
  // visible value so a tight neighbour cannot crush a comfortable one.
  tracking: { minEm: -0.05 },
  align: 'bottom',
};

const OFFER_SUBLINE_DEFAULTS = {
  shared: true,
  wrap: false,
  minFontSize: 6,
  minFontSizeRatio: 0.6,
};

const minFromBase = (baseFontSize, ratio, fallback) => (
  Number.isFinite(baseFontSize) && baseFontSize > 0
    ? Math.max(fallback, Math.round(baseFontSize * ratio))
    : fallback
);

/** Map an authored fit config ({ mode, ... }) onto engine-shape overrides. */
export const normalizeFitConfig = (fit = {}): Record<string, any> => {
  const normalized = {};
  const mode = String(fit.mode || '');
  const rawMaxLines = fit.maxLines;
  const maxLines = rawMaxLines === undefined || rawMaxLines === null || rawMaxLines === ''
    ? undefined
    : Number(rawMaxLines);
  if (Number.isFinite(maxLines)) normalized.maxLines = maxLines;

  if (mode === 'wrap') {
    // Fixed designed size — wrap only, never shrink.
    normalized.wrap = true;
    normalized.allowShrink = false;
  } else if (mode === 'shrink') {
    // Shrink to fit. Wrap only when a multi-line budget is authored.
    normalized.allowShrink = true;
    normalized.wrap = Number.isFinite(maxLines) && maxLines > 1;
  } else if (mode === 'sharedEqualizedFit') {
    normalized.shared = true;
  } else if (mode === 'clip' || mode === 'truncate') {
    normalized.static = mode;
    normalized.allowShrink = false;
  }

  // Explicit fields win over mode defaults (scope overrides use this).
  if (fit.disabled !== undefined) normalized.disabled = Boolean(fit.disabled);
  if (fit.static !== undefined) normalized.static = fit.static;
  if (fit.wrap !== undefined) normalized.wrap = Boolean(fit.wrap);
  if (fit.allowShrink !== undefined) normalized.allowShrink = Boolean(fit.allowShrink);
  if (fit.shared !== undefined) normalized.shared = Boolean(fit.shared);
  if (fit.sharedGroup !== undefined) normalized.sharedGroup = String(fit.sharedGroup);
  if (fit.minFontSize !== undefined) normalized.minFontSize = Number(fit.minFontSize);
  if (fit.minFontSizeRatio !== undefined) normalized.minFontSizeRatio = Number(fit.minFontSizeRatio);
  if (fit.tracking !== undefined) normalized.tracking = fit.tracking;
  if (fit.align !== undefined) normalized.align = fit.align;
  if (fit.frame === '') normalized.frame = '';
  if (fit.frame === 'fixed' || fit.frame === 'auto') {
    normalized.frame = fit.frame;
    if (normalized.static) {
      if (fit.allowShrink === undefined) normalized.allowShrink = false;
      normalized.overflow = normalized.static === 'truncate' ? 'ellipsis' : 'clip';
      normalized.static = undefined;
    }
  }
  if (fit.overflow !== undefined) normalized.overflow = fit.overflow;
  return normalized;
};

const baseRule = (cssClass, defaults, fit) => ({
  cssClass,
  shared: false,
  wrap: false,
  ...defaults,
  ...normalizeFitConfig(fit),
});

const headlineRule = (layer, classRuleProps = {}) => {
  const baseFontSize = Number(classRuleProps.fontSize ?? layer?.base?.fontSize);
  return baseRule(HEADLINE_CSS_CLASS, {
    shared: true,
    maxLines: 2,
    minFontSize: minFromBase(baseFontSize, 0.85, 12),
  }, layer?.fit);
};

const layerRule = (layer, classRuleProps = {}, generic = false) => {
  const cssClass = !generic && isHeadlineLayer(layer)
    ? HEADLINE_CSS_CLASS
    : (layer?.base?.cssClass || layer?.id);
  if (!cssClass || layer.kind === 'image' || layer.kind === 'shape' || layer.kind === 'group' || layer.kind === 'gradient' || layer.kind === 'blur') return null;
  if (!generic && String(layer.id || '') === 'cta') return null;
  if (!generic && isHeadlineLayer(layer)) return headlineRule(layer, classRuleProps);
  const baseFontSize = Number(layer?.base?.fontSize);
  if (layer.fit) {
    return baseRule(cssClass, {
      minFontSize: minFromBase(baseFontSize, 0.75, 6),
    }, layer.fit);
  }
  if (/terms|unit-rate/.test(String(layer.id || ''))) {
    return baseRule(cssClass, {
      maxLines: 2,
      minFontSize: minFromBase(baseFontSize, 0.75, 6),
    });
  }
  return null;
};

const classRuleFit = (rule) => {
  if (!rule?.cssClass) return null;
  const cssClass = String(rule.cssClass);
  const baseFontSize = Number(rule.properties?.fontSize);
  if (cssClass === OFFER_VALUE_CLASS) {
    return baseRule(cssClass, OFFER_VALUE_DEFAULTS, rule.fit);
  }
  if (cssClass === OFFER_SUBLINE_CLASS) {
    return baseRule(cssClass, OFFER_SUBLINE_DEFAULTS, rule.fit);
  }
  if (!rule.fit) return null;
  return baseRule(cssClass, {
    minFontSize: minFromBase(baseFontSize, 0.75, 6),
  }, rule.fit);
};

const attachScopeOverrides = (rules, variantRules = [], layers = []) => {
  const targeted = variantRules.filter(rule => rule.fit && Object.keys(rule.fit).length && (rule.targetId || String(rule.layerId || '').startsWith('headline-act')));
  variantRules = variantRules.filter(rule => !targeted.includes(rule));
  const ordered = variantRules.map((rule, index) => ({ rule, index }))
    .sort((a, b) => ownershipRuleSpecificity(a.rule) - ownershipRuleSpecificity(b.rule) || a.index - b.index);
  for (const { rule: variant } of ordered) {
    if (!variant?.fit || !Object.keys(variant.fit).length) continue;
    const cssClass = String(variant.cssClass || variant.layerId || '');
    let rule = rules.find((item) => item.cssClass === cssClass);
    if (!rule) {
      // Variant authored fit with no layer/class baseline — keep an inert host
      // rule so scoped overrides apply only when that scope class is active.
      rule = {
        cssClass,
        shared: false,
        wrap: false,
        allowShrink: false,
        scopeOnly: true,
      };
      rules.push(rule);
    }
    if (!variant.scope) {
      Object.assign(rule, normalizeFitConfig(variant.fit));
      delete rule.scopeOnly;
      continue;
    }
    rule.scopes = rule.scopes || {};
    rule.scopes[variant.scope] = {
      ...(rule.scopes[variant.scope] || {}),
      ...normalizeFitConfig(variant.fit),
    };
  }
  const targetIds = [...new Set(targeted.map(rule => rule.targetId || rule.layerId))];
  const targetRules = [];
  for (const targetId of targetIds) {
    const variants = targeted.filter(rule => (rule.targetId || rule.layerId) === targetId)
      .sort((a,b) => ownershipRuleSpecificity(a) - ownershipRuleSpecificity(b));
    const [layerId, childClass] = targetId.split('::');
    const layer = layers.find(item => item.id === layerId);
    const cssClass = childClass || (isHeadlineLayer(layer) ? HEADLINE_CSS_CLASS : layer?.base?.cssClass || layerId);
    const base = rules.find(rule => rule.cssClass === cssClass);
    const selector = targetIdToSelector(targetId);
    if (base) {
      base.excludeTargets ||= [];
      base.excludeTargets.push({ selector, scopes: variants.map(rule => rule.scope || '') });
    }
    targetRules.push({
      ...(base || { cssClass, wrap: false, shared: false }),
      excludeTargets: undefined,
      selector,
      targetId,
      targetOverrides: variants.map(rule => ({scope: rule.scope || '', ...normalizeFitConfig(rule.fit)})),
    });
  }
  return [...rules, ...targetRules];
};

export const textFitRulesForSize = (sizeCreative, generic = false) => {
  if (!sizeCreative) return [];
  const classRules = sizeCreative.classRules || [];
  const headlineClassRule = classRules.find((rule) => rule.cssClass === HEADLINE_CSS_CLASS);
  const classRuleProps = headlineClassRule?.properties || {};
  const headlineLayers = (sizeCreative.layers || []).filter(isHeadlineLayer);
  const headlineFitLayer = headlineLayers.find((layer) => layer.fit) || headlineLayers[0];

  const seen = new Set();
  const rules = [];
  const push = (rule) => {
    if (!rule || seen.has(rule.cssClass)) return;
    seen.add(rule.cssClass);
    rules.push(rule);
  };

  for (const layer of sizeCreative.layers || []) {
    if (!generic && isHeadlineLayer(layer) && layer !== headlineFitLayer) continue;
    const cssClass = !generic && isHeadlineLayer(layer) ? HEADLINE_CSS_CLASS : layer?.base?.cssClass || layer.id;
    const inheritedFit = classRules.find(rule => rule.cssClass === cssClass)?.fit;
    const effectiveLayer = inheritedFit ? { ...layer, fit: { ...inheritedFit, ...(layer.fit || {}) } } : layer;
    push(layerRule(effectiveLayer, classRuleProps, generic));
  }
  for (const rule of classRules) {
    push(classRuleFit(rule));
  }
  // Pricing blocks must always be governed even when the JSON has no explicit
  // class rule for them (identity can live on layer bases / plumbing CSS).
  push(baseRule(OFFER_VALUE_CLASS, OFFER_VALUE_DEFAULTS));
  push(baseRule(OFFER_SUBLINE_CLASS, OFFER_SUBLINE_DEFAULTS));

  return attachScopeOverrides(rules, sizeCreative.variantRules || [], sizeCreative.layers || []);
};

/** Engine-effective policy; authored fields/provenance remain on the target. */
export const effectiveTextFitForTarget = (document, size, targetId, activeScopes = []) => {
  const creative = materializeCreativeOwnership(document)?.sizes?.[size];
  if (!creative) return {};
  const [layerId, childClass] = String(targetId).split('::');
  const layer = (creative.layers || []).find(item => item.id === layerId);
  if (!layer) return {};
  const cssClass = childClass || (isHeadlineLayer(layer) ? HEADLINE_CSS_CLASS : layer.base?.cssClass || layer.id);
  const rules = textFitRulesForSize(creative, Boolean(document?.variantModel));
  const specific = rules.find(rule => rule.targetId === targetId);
  const resolved = specific && resolveTextFitRule(specific, activeScopes);
  if (resolved) return resolved;
  const base = rules.find(rule => !rule.targetId && rule.cssClass === cssClass);
  return base ? resolveTextFitRule(base, activeScopes) || {} : {};
};
