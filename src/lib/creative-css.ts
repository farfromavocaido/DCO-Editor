// @ts-nocheck

import { propsWithFitBudget } from '@/lib/fit-box';

const pxFields = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'fontSize',
  'borderRadius',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
]);

export const cssName = (key: string) => key.replace(/([A-Z])/g, '-$1').toLowerCase();

export const cssValue = (key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  if (pxFields.has(key)) {
    if (typeof value === 'string' && /[a-z%)]$/i.test(value.trim())) return value;
    return `${Number(value)}px`;
  }
  return String(value);
};

export const selectorForClassRule = (cssClass: string) => {
  if (cssClass === 'offer-value' || cssClass === 'offer-subline') {
    return `[data-gwd-group="OfferSlot"] .${cssClass}`;
  }
  return `.${cssClass}`;
};

/** `offers-0.cta-rect` → `.offers-0.cta-rect`; plain scopes stay `.cta-rect`. */
export const selectorForVariantScope = (scope: unknown) => {
  const parts = String(scope || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  return parts.map((part) => `.${part}`).join('');
};

/** Photo-act ink/geometry scopes that share `.sse-headline` across acts. */
const PHOTO_ACT_HEADLINE_SCOPES = new Set(['offers-0', 'white-headlines', 'navy-headlines']);

/**
 * Layer ids omitted from a shared `.sse-headline` variant rule.
 * Default: Act 4 stays on endframe geometry. Banner offers-0 may also list Act 3
 * (`excludeLayerIds` on the rule) so H3 can be sized independently of H1/H2.
 */
export const excludedHeadlineLayerIdsForVariantRule = (rule: Record<string, unknown> = {}) => {
  const layerId = String(rule.layerId || '');
  const cssClass = String(rule.cssClass || '');
  const scope = String(rule.scope || '');
  if (layerId || cssClass !== 'sse-headline' || !PHOTO_ACT_HEADLINE_SCOPES.has(scope)) {
    return [];
  }
  if (Array.isArray(rule.excludeLayerIds)) {
    return rule.excludeLayerIds.map(String).filter(Boolean);
  }
  return ['headline-act4'];
};

/** Stable authoring targets use exact DOM IDs, including nested offer children. */
export const targetIdToSelector = (targetId, priority = 1) => {
  const [layerId, childId] = String(targetId).split('::');
  if (!/^[\w-]+$/.test(layerId) || (childId && !/^[\w-]+$/.test(childId))) throw new Error(`Invalid target ID: ${targetId}`);
  const domId = layerId === 'terms-solo' ? 'TC_Solo' : layerId.replace(/^offer-slot-(\d+)$/, 'offer$1');
  const parent = Array(Math.max(1, priority)).fill(`#${domId}`).join('');
  return layerId === 'terms-solo' ? `${parent} .terms-solo` : childId ? `${parent} .${childId}` : parent;
};

export const selectorForVariantRule = (rule: Record<string, unknown>) => {
  if (rule.targetId) {
    const scope = selectorForVariantScope(rule.scope);
    return `${scope} ${targetIdToSelector(rule.targetId, rule.ownershipPriority || 1)}`.trim();
  }
  const layerId = String(rule.layerId || '');
  const cssClass = String(rule.cssClass || rule.layerId || '');
  const excluded = excludedHeadlineLayerIdsForVariantRule(rule);
  // Photo-act shared headline overrides skip excluded acts (default: Act 4 endframe).
  if (excluded.length && cssClass === 'sse-headline' && !layerId) {
    const scopeSelector = selectorForVariantScope(String(rule.scope || ''));
    const notActs = excluded.map((id) => `:not(#${id})`).join('');
    return `${scopeSelector} .sse-headline${notActs}`.trim();
  }
  // Headline acts share .sse-headline; act-specific overrides target the element id.
  const base = layerId.startsWith('headline-act')
    ? `#${layerId}`
    : selectorForClassRule(cssClass);
  const scopeSelector = selectorForVariantScope(rule.scope);
  return scopeSelector ? `${scopeSelector} ${base}` : base;
};

export const declarationsForProps = (props: Record<string, unknown> = {}) => (
  Object.entries(props)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `      ${cssName(key)}: ${cssValue(key, value)};`)
);

export const renderCssRule = (selector: string, props: Record<string, unknown> = {}) => {
  const declarations = declarationsForProps(props);
  if (!declarations.length) return '';
  return `    ${selector} {\n${declarations.join('\n')}\n    }`;
};

const fitForClass = (
  sizeCreative: Record<string, unknown>,
  cssClass: string,
  ownFit: Record<string, unknown> | null | undefined,
) => {
  if (ownFit && Object.keys(ownFit).length) return ownFit;
  const classRule = (sizeCreative.classRules || []).find(
    (rule: Record<string, unknown>) => rule.cssClass === cssClass,
  );
  return classRule?.fit || {};
};

const BOX_LAYOUT_KEYS = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'fontSize',
  'lineHeight',
  'display',
  'alignItems',
  'justifyContent',
  'textAlign',
]);

const variantOwnsBoxLayout = (props: Record<string, unknown> = {}) => (
  Object.keys(props).some((key) => BOX_LAYOUT_KEYS.has(key))
);

const hasAuthoredLength = (value: unknown) => (
  value !== undefined && value !== null && value !== ''
);

export const structuredRuleCss = (sizeCreative: Record<string, unknown>) => {
  const classRules = (sizeCreative.classRules || [])
    .map((rule: Record<string, unknown>) => renderCssRule(
      selectorForClassRule(rule.cssClass),
      propsWithFitBudget(rule.properties || {}, rule.fit || {}),
    ))
    .filter(Boolean);
  const variantRules = (sizeCreative.variantRules || [])
    .map((rule: Record<string, unknown>) => {
      const cssClass = String(rule.cssClass || rule.layerId || '');
      const fit = fitForClass(sizeCreative, cssClass, rule.fit);
      // Variant props overlay class properties so fontSize/lineHeight/align
      // are available when deriving the maxLines budget.
      const classProps = (sizeCreative.classRules || []).find(
        (item: Record<string, unknown>) => item.cssClass === cssClass,
      )?.properties || {};
      const authored = { ...(rule.props || {}) };
      const merged = { ...classProps, ...authored };
      const budgeted = propsWithFitBudget(merged, fit);
      // Only emit fields the variant actually owns. Never leak class height/top
      // into colour-only ink scopes (that overrode offers-0 geometry to 31px).
      const props: Record<string, unknown> = { ...authored };
      if (variantOwnsBoxLayout(authored)) {
        if (hasAuthoredLength(authored.height)) {
          props.height = budgeted.height;
        } else if (budgeted.height !== classProps.height) {
          props.height = budgeted.height;
        }
        if (hasAuthoredLength(authored.top)) {
          props.top = budgeted.top !== undefined ? budgeted.top : authored.top;
        } else if (
          props.height !== undefined
          && budgeted.top !== classProps.top
          && budgeted.top !== undefined
        ) {
          props.top = budgeted.top;
        }
      }
      return renderCssRule(selectorForVariantRule(rule), props);
    })
    .filter(Boolean);
  return [...classRules, ...variantRules].join('\n\n');
};
