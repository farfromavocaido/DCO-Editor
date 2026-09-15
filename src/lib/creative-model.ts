// @ts-nocheck
import { resolveTimeRef } from './creative-compiler';
import { beatsForScopes } from './timing-profiles';
import { activeOwnershipRules, resolveOwnedFields, materializeCreativeOwnership, setCreativeOwnershipField, resetCreativeOwnershipField } from "./creative-ownership";

import { excludedHeadlineLayerIdsForVariantRule, variantRuleProps } from '@/lib/creative-css';

export const deepClone = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

export const currentSizeCreative = (document: Record<string, unknown> | null, size: string) => (
  document?.sizes?.[size] || null
);

export const findCreativeLayer = (
  document: Record<string, unknown> | null,
  size: string,
  layerId: string,
) => currentSizeCreative(document, size)?.layers?.find((layer: Record<string, unknown>) => layer.id === layerId);

export const HEADLINE_CSS_CLASS = 'sse-headline';
export const BG_IMAGE_LAYER_ID = 'bg-image';
export const BG_IMAGE_CSS_CLASS = 'bg-image';

export const HEADLINE_STYLE_FIELDS = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'fontSize',
  'textAlign',
  'lineHeight',
  'justifyContent',
  'minFontSize',
  'whiteSpace',
  'letterSpacing',
]);

export const BG_IMAGE_STYLE_FIELDS = new Set([
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'objectFit',
  'objectPosition',
  'opacity',
]);

/** Compound scopes: fully independent brand CTAs per shape under offers-0. */
export const OFFERS_0_CTA_RECT_SCOPE = 'offers-0.cta-rect';
export const OFFERS_0_CTA_ROUNDEL_SCOPE = 'offers-0.cta-roundel';

/** Compound scopes: 0-offer roundel copy/value, independent of offers 1–3. */
export const OFFERS_0_ROUNDEL_SPLIT_SCOPE = 'offers-0.roundel-split';
export const OFFERS_0_ROUNDEL_COPY_ONLY_SCOPE = 'offers-0.roundel-copy-only';

const ROUNDEL_LAYER_IDS = new Set(['roundel-frame', 'roundel-copy', 'roundel-value']);

export const HEADLINE_LAYOUT_FIELDS = [
  'left',
  'top',
  'width',
  'height',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'justifyContent',
  'display',
  'alignItems',
  'whiteSpace',
];

export const isHeadlineLayer = (layer: Record<string, unknown> | null | undefined) => (
  String(layer?.id || '').startsWith('headline-act')
);

export const isBackgroundLayer = (layer: Record<string, unknown> | null | undefined) => (
  String(layer?.id || '') === BG_IMAGE_LAYER_ID
  || String(layer?.base?.cssClass || '') === BG_IMAGE_CSS_CLASS
);

/** Synthetic background layer when the size only has classRules (legacy docs). */
export const backgroundLayerDescriptor = (sizeCreative: Record<string, unknown> | null) => ({
  id: BG_IMAGE_LAYER_ID,
  label: 'Background',
  group: 'Waves / background',
  kind: 'image',
  zIndex: 0,
  base: { cssClass: BG_IMAGE_CSS_CLASS },
  asset: sizeCreative?.assets?.background || '',
  clips: [],
});

/**
 * Only terms-solo still uses a classRule wrapper for local coords.
 * terms-prices + unit-rate-prices are canvas-absolute (no silent group offset).
 */
export const TERMS_WRAPPER_CLASS_BY_LAYER = {
  'terms-solo': 'tc-solo-group',
} as const;

export const termsWrapperClassForLayer = (layerId: string) => (
  TERMS_WRAPPER_CLASS_BY_LAYER[layerId as keyof typeof TERMS_WRAPPER_CLASS_BY_LAYER] || ''
);

/** Legal copy lines — used for fit-budget / inspector special cases. */
export const isTermsLegalLayer = (layerId: string) => (
  /^(terms-prices|unit-rate-prices|terms-solo)$/.test(String(layerId || ''))
);

const offerChildDefinitions = [
  {
    id: 'offer-value',
    label: 'Offer value',
    cssClass: 'offer-value',
    coordinateScope: 'group',
    description: 'Position is relative to the offer slot group.',
  },
  {
    id: 'offer-subline',
    label: 'Offer subline',
    cssClass: 'offer-subline',
    coordinateScope: 'group',
    description: 'Position is relative to the offer slot group.',
  },
];

const childDefinitionsForLayer = (layer: Record<string, unknown> | null) => {
  if (!layer) return [];
  const id = String(layer.id || '');
  if (id.startsWith('offer-slot-')) return offerChildDefinitions;
  return [];
};

export const targetIdForLayerChild = (layerId: string, childId: string) => `${layerId}::${childId}`;

export const parseCreativeTargetId = (targetId: string) => {
  const [layerId, childId] = String(targetId || '').split('::');
  return {
    layerId,
    childId: childId || '',
    isNested: Boolean(childId),
  };
};

export const editableTargetsForLayer = (layer: Record<string, unknown> | null) => {
  if (!layer) return [];
  return childDefinitionsForLayer(layer).map((child) => ({
    ...child,
    id: targetIdForLayerChild(String(layer.id), child.id),
    childId: child.id,
    parentLayerId: layer.id,
  }));
};

const propsOnlyHideVisibility = (props: Record<string, unknown> = {}) => {
  const keys = Object.keys(props || {});
  return keys.length > 0 && keys.every((key) => key === 'visibility');
};

const findClassRule = (sizeCreative: Record<string, unknown>, cssClass: string) => (
  (sizeCreative?.classRules || []).find((rule: Record<string, unknown>) => rule.cssClass === cssClass)
);

const numberProp = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Stage box for the T&Cs / unit-rate wrapper that owns legal-line local coords. */
export const termsWrapperBounds = (
  sizeCreative: Record<string, unknown> | null,
  layerId: string,
) => {
  const cssClass = termsWrapperClassForLayer(layerId);
  if (!sizeCreative || !cssClass) return null;
  const props = findClassRule(sizeCreative, cssClass)?.properties || {};
  return {
    cssClass,
    left: numberProp(props.left, 0),
    top: numberProp(props.top, 0),
    width: numberProp(props.width, 0),
    height: numberProp(props.height, 0),
  };
};

const ruleMatchesIdentity = (
  rule: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
) => {
  // Shared photo-act `.sse-headline` rules skip excluded acts (mirrors
  // selectorForVariantRule :not(#…) — default Act 4; banners may exclude Act 3).
  if (
    identity.layerId
    && rule.cssClass === 'sse-headline'
    && !rule.layerId
    && excludedHeadlineLayerIdsForVariantRule(rule).includes(String(identity.layerId))
  ) {
    return false;
  }
  return (
    (identity.layerId && rule.layerId === identity.layerId)
    || (identity.cssClass && rule.cssClass === identity.cssClass)
  );
};

/** Plain scope token, or compound `offers-0.cta-rect` requiring every part active. */
export const variantScopeIsActive = (scope: unknown, activeScopes: string[] = []) => {
  const parts = String(scope || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return false;
  const active = new Set((activeScopes || []).map(String));
  return parts.every((part) => active.has(part));
};

const isCtaIdentity = (identity: { layerId?: string; cssClass?: string }) => (
  identity.layerId === 'cta' || identity.cssClass === 'cta'
);

const isRoundelIdentity = (identity: { layerId?: string; cssClass?: string }) => (
  ROUNDEL_LAYER_IDS.has(String(identity.layerId || ''))
  || ROUNDEL_LAYER_IDS.has(String(identity.cssClass || ''))
);

const isOffers0OwnedScope = (scope: unknown) => {
  const text = String(scope || '');
  return text === 'offers-0' || text.startsWith('offers-0.');
};

const matchedVariantRulesUnfiltered = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => {
  const scopes = (activeScopes || []).map(String);
  return (sizeCreative?.variantRules || []).filter((rule: Record<string, unknown>) => (
    variantScopeIsActive(rule.scope, scopes)
    && !propsOnlyHideVisibility(rule.props)
    && ruleMatchesIdentity(rule, identity)
  ));
};

/**
 * Active variant rules in document order (same as structuredRuleCss emission).
 * Later rules win for both merged values and writeSource — matching equal-specificity
 * CSS cascade. Scope-list order must NOT drive this.
 *
 * Offers-0 CTA and Offer Roundel only use `offers-0` / `offers-0.*` rules so
 * brand rearranges stay independent of offers 1–3. Those two stacks are
 * separate; each follows the same ownership rule.
 */
const activeVariantRulesForIdentity = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => {
  return activeOwnershipRules(sizeCreative?.variantRules || [], identity, activeScopes)
    .filter((rule) => !propsOnlyHideVisibility(rule.props));
};

const findActiveVariantRule = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => (
  activeVariantRulesForIdentity(sizeCreative, identity, activeScopes).at(-1) || null
);

/** Ink scopes must stay colour-only — never the write target for geometry. */
const INK_COLOR_SCOPES = new Set(['white-headlines', 'navy-headlines']);

const isInkColorScopeRule = (rule: Record<string, unknown>) => (
  INK_COLOR_SCOPES.has(String(rule.scope || ''))
);

/** Last active variant rule that may own layout (skips white/navy ink colour rules). */
const findActiveVariantWriteRule = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => {
  const matched = activeVariantRulesForIdentity(sizeCreative, identity, activeScopes);
  const writable = matched.filter((rule) => !isInkColorScopeRule(rule));
  return writable.at(-1) || matched.at(-1) || null;
};

const mergedActiveVariantProps = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => (
  activeVariantRulesForIdentity(sizeCreative, identity, activeScopes)
    .reduce((props, rule) => ({ ...props, ...(rule.props || {}) }), {})
);

const childDefinitionForTarget = (childId: string) => (
  offerChildDefinitions.find((child) => child.id === childId || child.cssClass === childId) || null
);

const findCreativeTargetLegacy = (
  document: Record<string, unknown> | null,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
) => {
  const sizeCreative = currentSizeCreative(document, size);
  if (!sizeCreative || !targetId) return null;
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(document, size, parsed.layerId);
  if (!layer) return null;

  if (parsed.isNested) {
    const child = childDefinitionForTarget(parsed.childId);
    if (!child) return null;
    const classRule = findClassRule(sizeCreative, child.cssClass);
    const variantRule = findActiveVariantRule(sizeCreative, { cssClass: child.cssClass }, activeScopes);
    const variantProps = mergedActiveVariantProps(sizeCreative, { cssClass: child.cssClass }, activeScopes);
    const values = {
      ...(classRule?.properties || {}),
      ...variantProps,
    };
    // Fit follows the same "1-offer = classRule baseline, offers-2/3 = variant
    // override" pattern as layout props. Runtime already applies variantRules[].fit
    // via text-fit-rules scopes; the editor must read/write that same place.
    const fit = {
      ...(classRule?.fit || {}),
      ...(variantRule?.fit || {}),
    };
    return {
      id: targetId,
      label: `${layer.label || layer.id} / ${child.label}`,
      kind: 'nested',
      childId: child.id,
      parentLayerId: layer.id,
      parentLayer: layer,
      cssClass: child.cssClass,
      coordinateScope: child.coordinateScope,
      description: child.description,
      values,
      base: values,
      fit,
      clips: layer.clips || [],
      writeSource: variantRule
        ? { kind: 'variantRule', ruleId: variantRule.id, scope: variantRule.scope }
        : { kind: 'classRule', cssClass: child.cssClass },
    };
  }

  if (isHeadlineLayer(layer)) {
    const classRule = findClassRule(sizeCreative, HEADLINE_CSS_CLASS);
    const identity = { cssClass: HEADLINE_CSS_CLASS, layerId: layer.id };
    const writeRule = findActiveVariantWriteRule(sizeCreative, identity, activeScopes);
    const variantProps = mergedActiveVariantProps(sizeCreative, identity, activeScopes);
    const values = {
      ...(classRule?.properties || {}),
      ...variantProps,
    };
    return {
      id: layer.id,
      label: layer.label || layer.id,
      kind: layer.kind || 'layer',
      layer,
      parentLayerId: '',
      cssClass: HEADLINE_CSS_CLASS,
      coordinateScope: 'canvas',
      description: writeRule?.layerId === layer.id
        ? `Editing ${writeRule.scope} ${layer.id} overrides.`
        : writeRule
          ? `Editing ${writeRule.scope} headline overrides (shared by acts).`
          : 'Shared headline placement for acts 1–3.',
      values,
      base: values,
      fit: {
        ...(layer.fit || {}),
        ...(writeRule?.fit || {}),
      },
      clips: layer.clips || [],
      writeSource: writeRule
        ? { kind: 'variantRule', ruleId: writeRule.id, scope: writeRule.scope }
        : { kind: 'classRule', cssClass: HEADLINE_CSS_CLASS },
    };
  }

  if (isBackgroundLayer(layer)) {
    const classRule = findClassRule(sizeCreative, BG_IMAGE_CSS_CLASS);
    const values = {
      ...(classRule?.properties || {}),
      ...(layer.base || {}),
      cssClass: BG_IMAGE_CSS_CLASS,
    };
    return {
      id: BG_IMAGE_LAYER_ID,
      label: layer.label || 'Background',
      kind: 'image',
      layer,
      parentLayerId: '',
      cssClass: BG_IMAGE_CSS_CLASS,
      coordinateScope: 'canvas',
      description: 'Background image frame (class rule).',
      values,
      base: values,
      fit: {},
      clips: layer.clips || [],
      writeSource: { kind: 'classRule', cssClass: BG_IMAGE_CSS_CLASS },
    };
  }

  const cssClass = layer.base?.cssClass || layer.id;
  const variantRule = findActiveVariantRule(sizeCreative, { layerId: layer.id, cssClass }, activeScopes);
  const variantProps = mergedActiveVariantProps(sizeCreative, { layerId: layer.id, cssClass }, activeScopes);
  const wrapper = termsWrapperBounds(sizeCreative, String(layer.id));
  const bottomLineProps = findClassRule(sizeCreative, 'sse-bottom-line')?.properties || {};
  const legalLine = isTermsLegalLayer(String(layer.id));
  const values = {
    // Legal lines inherit shared bottom-line metrics used by fit-budget height.
    ...(legalLine ? bottomLineProps : {}),
    ...(layer.base || {}),
    ...variantProps,
  };
  return {
    id: layer.id,
    label: layer.label || layer.id,
    kind: layer.kind || 'layer',
    layer,
    parentLayerId: '',
    cssClass,
    coordinateScope: wrapper ? 'group' : 'canvas',
    wrapperClass: wrapper?.cssClass || '',
    wrapperBounds: wrapper,
    description: variantRule
      ? `Editing ${variantRule.scope} overrides for this layer.`
      : (wrapper
        ? 'Position is relative to the T&Cs group.'
        : 'Position is relative to the canvas.'),
    values,
    base: values,
    fit: {
      ...(layer.fit || {}),
      ...(variantRule?.fit || {}),
    },
    clips: layer.clips || [],
    writeSource: variantRule
      ? { kind: 'variantRule', ruleId: variantRule.id, scope: variantRule.scope }
      : { kind: 'layerBase', layerId: layer.id },
  };
};

/** Resolve each field independently; a later unrelated rule is not its owner. */
export const findCreativeTarget = (document: any, size: string, targetId: string, activeScopes: string[] = []): any => {
  document = materializeCreativeOwnership(document);
  const target = findCreativeTargetLegacy(document, size, targetId, activeScopes);
  if (!target) return null;
  const sizeCreative = currentSizeCreative(document, size);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(document, size, parsed.layerId);
  const identity = { ...identityForTarget(layer, parsed), targetId };
  const rules = activeOwnershipRules(sizeCreative.variantRules || [], identity, activeScopes)
    .filter((rule) => !propsOnlyHideVisibility(rule.props));
  const baseline = findCreativeTargetLegacy({ ...document, sizes: { ...document.sizes, [size]: { ...sizeCreative, variantRules: [] } } }, size, targetId, []);
  const props = resolveOwnedFields(baseline.values, baseline.writeSource, rules.map((rule) => ({ ...rule, props: variantRuleProps(sizeCreative, rule) })));
  const fit = resolveOwnedFields(baseline.fit, { kind: parsed.isNested ? 'classRule' : 'layerFit', layerId: layer.id, cssClass: target.cssClass }, rules, 'fit');
  return { ...target, values: props.values, base: props.values, fit: fit.values, valueProvenance: props.provenance, fitProvenance: fit.provenance };
};

export const groupedCreativeLayers = (layers: Array<Record<string, unknown>> = []) => {
  const groups: Array<{ label: string; layers: Array<Record<string, unknown>> }> = [];
  const byLabel = new Map<string, { label: string; layers: Array<Record<string, unknown>> }>();
  for (const layer of layers) {
    const label = layer.group || 'Other';
    if (!byLabel.has(label)) {
      const group = { label, layers: [] };
      groups.push(group);
      byLabel.set(label, group);
    }
    byLabel.get(label)!.layers.push(layer);
  }
  return groups;
};

export const updateCreativeLayerBase = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  if (isHeadlineLayer(layer) && HEADLINE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, HEADLINE_CSS_CLASS);
    classRule.properties[field] = value;
    return next;
  }
  if (isBackgroundLayer(layer) && BG_IMAGE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, BG_IMAGE_CSS_CLASS);
    classRule.properties[field] = value;
    return next;
  }
  layer.base = {
    ...(layer.base || {}),
    [field]: value,
  };
  return next;
};

export const updateCreativeLayerGradient = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  if (String(layer.kind || '') !== 'gradient') {
    throw new Error(`Layer ${layerId} is not a gradient layer`);
  }
  layer.gradient = {
    ...(layer.gradient || {}),
    [field]: value,
  };
  return next;
};

export const updateCreativeLayerBlur = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  if (String(layer.kind || '') !== 'blur') {
    throw new Error(`Layer ${layerId} is not a blur layer`);
  }
  layer.blur = {
    ...(layer.blur || {}),
    [field]: value,
  };
  return next;
};

export const updateCreativeLayerFit = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  const fit = {
    ...(layer.fit || {}),
    [field]: value,
  };
  if (isHeadlineLayer(layer)) {
    for (const headline of (sizeCreative.layers || []).filter(isHeadlineLayer)) {
      headline.fit = { ...fit };
    }
    return next;
  }
  layer.fit = fit;
  return next;
};

export const updateCreativeClassFit = (
  document: Record<string, unknown>,
  size: string,
  cssClass: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const rule = ensureClassRule(sizeCreative, cssClass);
  rule.fit = {
    ...(rule.fit || {}),
    [field]: value,
  };
  return next;
};

/** Write nested/layer fit using the active scope (classRule baseline vs variantRules[].fit). */
export const updateCreativeTargetFit = (
  document: Record<string, unknown>,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
  field: string,
  value: unknown,
) => {
  const effectiveSource = findCreativeTarget(document, size, targetId, activeScopes)?.fitProvenance?.[field];
  if (effectiveSource?.kind === 'sharedDefinition' || effectiveSource?.kind === 'localOverride') {
    return setCreativeOwnershipField(document, size, targetId, activeScopes, 'fit', field, value, 'local');
  }
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);

  const target = findCreativeTarget(document, size, targetId, activeScopes);
  const rules = activeOwnershipRules(sizeCreative.variantRules || [], identityForTarget(layer, parsed), activeScopes);
  const source = target.fitProvenance?.[field];
  const rule = source?.kind === 'variantRule'
    ? rules.find((item) => item.id === source.ruleId)
    : rules.filter((item) => !isInkColorScopeRule(item)).at(-1);
  if (rule) {
    rule.fit = { ...(rule.fit || {}), [field]: value };
    return next;
  }
  if (parsed.isNested) {
    const classRule = ensureClassRule(sizeCreative, target.cssClass);
    classRule.fit = { ...(classRule.fit || {}), [field]: value };
    return next;
  }
  layer.fit = { ...(layer.fit || {}), [field]: value };
  return next;
};

export const replaceCreativeLayer = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  nextLayer: Record<string, unknown>,
) => {
  if (!nextLayer || nextLayer.id !== layerId) {
    throw new Error('Layer code edits must keep the same id.');
  }
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const index = (sizeCreative.layers || []).findIndex((layer: Record<string, unknown>) => layer.id === layerId);
  if (index < 0) throw new Error(`Unknown layer: ${layerId}`);
  sizeCreative.layers[index] = deepClone(nextLayer);
  return next;
};

export const updateCreativeLayerMetadata = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  field: string,
  value: unknown,
) => {
  if (!['label', 'group'].includes(field)) {
    throw new Error(`Unsupported layer metadata field: ${field}`);
  }
  const next = deepClone(document);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  layer[field] = value;
  return next;
};

const titleForId = (id: string) => (
  String(id || '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
);

const nextLayerId = (layers: Array<Record<string, unknown>>, baseId: string) => {
  const existing = new Set(layers.map((layer) => String(layer.id || '')));
  if (!existing.has(baseId)) return baseId;
  let index = 1;
  let candidate = `${baseId}-${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${baseId}-${index}`;
  }
  return candidate;
};

const maxLayerZ = (layers: Array<Record<string, unknown>>) => (
  layers.reduce((max, layer, index) => Math.max(max, Number.isFinite(Number(layer.zIndex)) ? Number(layer.zIndex) : index), -1)
);

export const duplicateCreativeLayer = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layers = sizeCreative.layers || [];
  const source = layers.find((layer: Record<string, unknown>) => layer.id === layerId);
  if (!source) throw new Error(`Unknown layer: ${layerId}`);
  const id = nextLayerId(layers, `${layerId}-copy`);
  const copy = deepClone(source);
  copy.id = id;
  copy.label = `${source.label || titleForId(layerId)} copy`;
  copy.zIndex = maxLayerZ(layers) + 1;
  copy.base = {
    ...(copy.base || {}),
    cssClass: id,
    left: Number(copy.base?.left || 0) + 12,
    top: Number(copy.base?.top || 0) + 12,
  };
  copy.clips = (copy.clips || []).map((clip: Record<string, unknown>) => ({
    ...clip,
    id: `${id}-${clip.preset || clip.id || 'clip'}`,
    label: `${copy.label} ${clip.preset || 'motion'}`,
  }));
  layers.push(copy);
  return next;
};

export const deleteCreativeLayer = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
) => {
  if (String(layerId) === BG_IMAGE_LAYER_ID) {
    throw new Error('Background layer cannot be deleted');
  }
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layer = (sizeCreative.layers || []).find((item: Record<string, unknown>) => item.id === layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  const cssClass = layer.base?.cssClass || layer.id;
  sizeCreative.layers = (sizeCreative.layers || []).filter((item: Record<string, unknown>) => item.id !== layerId);
  sizeCreative.variantRules = (sizeCreative.variantRules || []).filter((rule: Record<string, unknown>) => (
    rule.layerId !== layerId && rule.cssClass !== cssClass
  ));
  const belongs = (targetId) => targetId === layerId || String(targetId).startsWith(`${layerId}::`);
  if (sizeCreative.localOverrides) sizeCreative.localOverrides = sizeCreative.localOverrides.filter((item) => !belongs(item.targetId));
  if (sizeCreative.canvasGroups) sizeCreative.canvasGroups = sizeCreative.canvasGroups.map((group) => ({...group, members: group.members.filter((id) => !belongs(id))})).filter((group) => group.members.length >= 2);
  for (const definition of next.sharedDefinitions || []) definition.members = definition.members.filter((member) => member.size !== size || !belongs(member.targetId));
  return next;
};

export const addCreativeShapeLayer = (
  document: Record<string, unknown>,
  size: string,
  shape = 'rectangle',
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layers = sizeCreative.layers || [];
  const existingShapeCount = layers.filter((layer: Record<string, unknown>) => String(layer.id || '').startsWith(`${shape}-`)).length;
  const number = existingShapeCount + 1;
  const id = nextLayerId(layers, `${shape}-${number}`);
  layers.push({
    id,
    label: `${titleForId(shape)} ${number}`,
    group: 'Shapes',
    kind: 'shape',
    zIndex: maxLayerZ(layers) + 1,
    base: {
      left: 24,
      top: 24,
      width: 120,
      height: 64,
      cssClass: id,
      backgroundColor: 'rgba(0, 229, 165, 0.2)',
      border: '1px solid rgba(0, 229, 165, 0.65)',
      borderRadius: 0,
    },
    clips: [],
  });
  return next;
};

export const reorderCreativeLayerZ = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  direction: number,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layers = sizeCreative.layers || [];
  layers.forEach((layer: Record<string, unknown>, index: number) => {
    layer.zIndex = Number.isFinite(Number(layer.zIndex)) ? Number(layer.zIndex) : index;
  });
  const sorted = [...layers].sort((a, b) => Number(a.zIndex) - Number(b.zIndex));
  const index = sorted.findIndex((layer) => layer.id === layerId);
  if (index < 0) throw new Error(`Unknown layer: ${layerId}`);
  const nextIndex = Math.max(0, Math.min(sorted.length - 1, index + Math.sign(direction)));
  if (nextIndex === index) return next;
  const current = sorted[index];
  const peer = sorted[nextIndex];
  const currentZ = current.zIndex;
  current.zIndex = peer.zIndex;
  peer.zIndex = currentZ;
  return next;
};

export const moveCreativeLayerToZIndex = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  targetIndex: number,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const layers = sizeCreative.layers || [];
  layers.forEach((layer: Record<string, unknown>, index: number) => {
    layer.zIndex = Number.isFinite(Number(layer.zIndex)) ? Number(layer.zIndex) : index;
  });
  const sorted = [...layers].sort((a, b) => Number(a.zIndex) - Number(b.zIndex));
  const currentIndex = sorted.findIndex((layer) => layer.id === layerId);
  if (currentIndex < 0) throw new Error(`Unknown layer: ${layerId}`);
  const [current] = sorted.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(sorted.length, Math.round(Number(targetIndex) || 0)));
  sorted.splice(boundedIndex, 0, current);
  sorted.forEach((layer, index) => {
    layer.zIndex = index;
  });
  return next;
};

const ensureClassRule = (sizeCreative: Record<string, unknown>, cssClass: string) => {
  sizeCreative.classRules = sizeCreative.classRules || [];
  let rule = findClassRule(sizeCreative, cssClass);
  if (!rule) {
    rule = { cssClass, properties: {} };
    sizeCreative.classRules.push(rule);
  }
  rule.properties = rule.properties || {};
  return rule;
};

const isOfferRoundelLayerRef = (value: unknown) => {
  const text = String(value || '');
  return text === 'roundel-frame' || text === 'roundel-copy' || text === 'roundel-value'
    || text.startsWith('roundel-');
};

/**
 * Offer Roundel stays linked across offers 1–3: drop offers-2/3 roundel variant
 * rules so those variants inherit the 1-offer path (base frame + roundel-split).
 * offers-0 colour rules are kept.
 */
export const stripOfferCountRoundelOverrides = (document: Record<string, unknown> | null) => {
  if (!document?.sizes || typeof document.sizes !== 'object') return document;
  for (const sizeCreative of Object.values(document.sizes) as Array<Record<string, unknown>>) {
    if (!sizeCreative || typeof sizeCreative !== 'object') continue;
    const rules = Array.isArray(sizeCreative.variantRules) ? sizeCreative.variantRules : [];
    sizeCreative.variantRules = rules.filter((rule: Record<string, unknown>) => {
      const scope = String(rule?.scope || '');
      if (scope !== 'offers-2' && scope !== 'offers-3') return true;
      const id = String(rule?.id || '');
      return !(
        id.includes('roundel')
        || isOfferRoundelLayerRef(rule?.layerId)
        || isOfferRoundelLayerRef(rule?.cssClass)
      );
    });
  }
  return document;
};

const offers0CtaShapeScope = (activeScopes: string[] = []) => (
  activeScopes.map(String).includes('cta-rect')
    ? OFFERS_0_CTA_RECT_SCOPE
    : OFFERS_0_CTA_ROUNDEL_SCOPE
);

const ensureOffers0CtaShapeRule = (
  sizeCreative: Record<string, unknown>,
  compoundScope: string,
) => {
  const id = `${compoundScope}|cta`;
  sizeCreative.variantRules = Array.isArray(sizeCreative.variantRules)
    ? sizeCreative.variantRules
    : [];
  let rule = sizeCreative.variantRules.find((item: Record<string, unknown>) => (
    String(item?.id || '') === id || String(item?.scope || '') === compoundScope
  ));
  if (!rule) {
    rule = {
      id,
      scope: compoundScope,
      layerId: 'cta',
      cssClass: 'cta',
      props: {},
      editable: true,
    };
    sizeCreative.variantRules.push(rule);
  }
  rule.id = id;
  rule.scope = compoundScope;
  rule.layerId = 'cta';
  rule.cssClass = 'cta';
  rule.editable = true;
  rule.props = rule.props || {};
  return rule;
};

const writeOffers0CtaField = (
  sizeCreative: Record<string, unknown>,
  activeScopes: string[],
  field: string,
  value: unknown,
) => {
  const rule = ensureOffers0CtaShapeRule(sizeCreative, offers0CtaShapeScope(activeScopes));
  rule.props[field] = value;
};

const pickDefined = (...values: unknown[]) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

/**
 * Migrate legacy `offers-0|cta` into independent compound shape rules
 * (`offers-0.cta-rect` / `offers-0.cta-roundel`). Seeds from brand position/colour
 * + matching multi-offer geometry once; never rewrites existing compound props.
 * Leaves offers 1–3 CTA rules untouched.
 */
export const normalizeOffers0CtaRules = (document: Record<string, unknown> | null) => {
  if (!document?.sizes || typeof document.sizes !== 'object') return document;
  for (const sizeCreative of Object.values(document.sizes) as Array<Record<string, unknown>>) {
    if (!sizeCreative || typeof sizeCreative !== 'object') continue;
    const rules = Array.isArray(sizeCreative.variantRules) ? [...sizeCreative.variantRules] : [];
    sizeCreative.variantRules = rules;
    const ctaLayer = (sizeCreative.layers || []).find((layer: Record<string, unknown>) => (
      layer?.id === 'cta'
    ));
    if (!ctaLayer) continue;
    const base = ctaLayer?.base && typeof ctaLayer.base === 'object' ? ctaLayer.base : {};
    const rectRule = rules.find((rule: Record<string, unknown>) => (
      String(rule?.id || '') === 'cta-rect|cta' || String(rule?.scope || '') === 'cta-rect'
    ));
    const rectProps = rectRule?.props && typeof rectRule.props === 'object' ? rectRule.props : {};
    const legacy = rules.find((rule: Record<string, unknown>) => (
      String(rule?.id || '') === 'offers-0|cta'
      || (String(rule?.scope || '') === 'offers-0'
        && (String(rule?.layerId || '') === 'cta' || String(rule?.cssClass || '') === 'cta'))
    ));
    const legacyProps = legacy?.props && typeof legacy.props === 'object' ? legacy.props : {};

    const rectCompound = ensureOffers0CtaShapeRule(sizeCreative, OFFERS_0_CTA_RECT_SCOPE);
    const roundCompound = ensureOffers0CtaShapeRule(sizeCreative, OFFERS_0_CTA_ROUNDEL_SCOPE);

    const seedIfEmpty = (rule: Record<string, unknown>, seed: Record<string, unknown>) => {
      const props = rule.props && typeof rule.props === 'object' ? rule.props : {};
      if (Object.keys(props).length) return;
      rule.props = { ...seed };
    };

    seedIfEmpty(rectCompound, {
      left: pickDefined(legacyProps.left, rectProps.left, base.left),
      top: pickDefined(legacyProps.top, rectProps.top, base.top),
      width: pickDefined(legacyProps.width, rectProps.width, base.width),
      height: pickDefined(legacyProps.height, rectProps.height, base.height),
      borderRadius: pickDefined(rectProps.borderRadius, 4),
      fontSize: pickDefined(legacyProps.fontSize, rectProps.fontSize, base.fontSize),
      backgroundColor: pickDefined(legacyProps.backgroundColor, 'rgb(0, 41, 117)'),
      color: pickDefined(legacyProps.color, 'rgb(255, 255, 255)'),
    });
    seedIfEmpty(roundCompound, {
      left: pickDefined(legacyProps.left, base.left),
      top: pickDefined(legacyProps.top, base.top),
      width: pickDefined(legacyProps.width, base.width),
      height: pickDefined(legacyProps.height, base.height),
      borderRadius: pickDefined(base.borderRadius, '50%'),
      fontSize: pickDefined(legacyProps.fontSize, base.fontSize),
      backgroundColor: pickDefined(legacyProps.backgroundColor, 'rgb(0, 41, 117)'),
      color: pickDefined(legacyProps.color, 'rgb(255, 255, 255)'),
    });

    sizeCreative.variantRules = sizeCreative.variantRules.filter((rule: Record<string, unknown>) => (
      !(
        String(rule?.id || '') === 'offers-0|cta'
        || (String(rule?.scope || '') === 'offers-0'
          && (String(rule?.layerId || '') === 'cta' || String(rule?.cssClass || '') === 'cta'))
      )
    ));
  }
  return document;
};

const offers0RoundelWhen = (scope: string) => {
  if (scope === OFFERS_0_ROUNDEL_SPLIT_SCOPE) {
    return { offer_count_num: 0, roundel_value_text: 'non-empty' };
  }
  if (scope === OFFERS_0_ROUNDEL_COPY_ONLY_SCOPE) {
    return { offer_count_num: 0, roundel_value_text: '' };
  }
  return { offer_count_num: 0 };
};

const offers0RoundelWriteScope = (layerId: string, activeScopes: string[] = []) => {
  if (layerId === 'roundel-frame') return 'offers-0';
  const scopes = (activeScopes || []).map(String);
  if (scopes.includes('roundel-split')) return OFFERS_0_ROUNDEL_SPLIT_SCOPE;
  if (scopes.includes('roundel-copy-only')) return OFFERS_0_ROUNDEL_COPY_ONLY_SCOPE;
  return 'offers-0';
};

const ensureOffers0RoundelRule = (
  sizeCreative: Record<string, unknown>,
  scope: string,
  layerId: string,
) => {
  const id = `${scope}|${layerId}`;
  sizeCreative.variantRules = Array.isArray(sizeCreative.variantRules)
    ? sizeCreative.variantRules
    : [];
  let rule = sizeCreative.variantRules.find((item: Record<string, unknown>) => (
    String(item?.id || '') === id
    || (String(item?.scope || '') === scope && String(item?.layerId || '') === layerId)
  ));
  if (!rule) {
    rule = {
      id,
      scope,
      layerId,
      cssClass: layerId,
      when: offers0RoundelWhen(scope),
      props: {},
      editable: true,
    };
    sizeCreative.variantRules.push(rule);
  }
  rule.id = id;
  rule.scope = scope;
  rule.layerId = layerId;
  rule.cssClass = layerId;
  rule.editable = true;
  rule.props = rule.props || {};
  if (!rule.when) rule.when = offers0RoundelWhen(scope);
  return rule;
};

const mergedUnfilteredVariantProps = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => (
  matchedVariantRulesUnfiltered(sizeCreative, identity, activeScopes)
    .reduce((props: Record<string, unknown>, rule: Record<string, unknown>) => (
      { ...props, ...(rule.props || {}) }
    ), {})
);

const lastUnfilteredVariantFit = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => {
  const rules = matchedVariantRulesUnfiltered(sizeCreative, identity, activeScopes);
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const fit = rules[index]?.fit;
    if (fit && typeof fit === 'object' && Object.keys(fit).length) return { ...fit };
  }
  return null;
};

const seedOffers0RoundelRuleIfEmpty = (
  rule: Record<string, unknown>,
  seed: Record<string, unknown>,
  seedFit: Record<string, unknown> | null,
) => {
  const props = rule.props && typeof rule.props === 'object' ? rule.props : {};
  if (!Object.keys(props).length && seed && Object.keys(seed).length) {
    rule.props = { ...seed };
  }
  if (seedFit && !rule.fit) {
    rule.fit = { ...seedFit };
  }
};

const writeOffers0RoundelField = (
  sizeCreative: Record<string, unknown>,
  layerId: string,
  activeScopes: string[],
  field: string,
  value: unknown,
) => {
  const scope = offers0RoundelWriteScope(layerId, activeScopes);
  const identity = { layerId, cssClass: layerId };
  const rule = ensureOffers0RoundelRule(sizeCreative, scope, layerId);
  if (!Object.keys(rule.props || {}).length) {
    rule.props = { ...mergedUnfilteredVariantProps(sizeCreative, identity, activeScopes) };
  }
  rule.props[field] = value;
};

/**
 * Seed independent 0-offer roundel rules from the current merged boxes
 * (shared split / copy-only + existing offers-0 colour) so isolation does
 * not move anything. Existing owned props win; offers 1–3 rules stay put.
 */
export const normalizeOffers0RoundelRules = (document: Record<string, unknown> | null) => {
  if (!document?.sizes || typeof document.sizes !== 'object') return document;
  for (const sizeCreative of Object.values(document.sizes) as Array<Record<string, unknown>>) {
    if (!sizeCreative || typeof sizeCreative !== 'object') continue;
    const layers = Array.isArray(sizeCreative.layers) ? sizeCreative.layers : [];
    const hasLayer = (layerId: string) => layers.some((layer: Record<string, unknown>) => (
      layer?.id === layerId
    ));
    if (!hasLayer('roundel-frame') && !hasLayer('roundel-copy') && !hasLayer('roundel-value')) {
      continue;
    }

    const splitScopes = ['offers-0', 'roundel-split'];
    const copyOnlyScopes = ['offers-0', 'roundel-copy-only'];

    const seedLayer = (
      layerId: string,
      scope: string,
      activeScopes: string[],
    ) => {
      if (!hasLayer(layerId)) return;
      const identity = { layerId, cssClass: layerId };
      const seed = mergedUnfilteredVariantProps(sizeCreative, identity, activeScopes);
      const seedFit = lastUnfilteredVariantFit(sizeCreative, identity, activeScopes);
      if (!Object.keys(seed).length && !seedFit) return;
      const rule = ensureOffers0RoundelRule(sizeCreative, scope, layerId);
      seedOffers0RoundelRuleIfEmpty(rule, seed, seedFit);
    };

    seedLayer('roundel-copy', OFFERS_0_ROUNDEL_SPLIT_SCOPE, splitScopes);
    seedLayer('roundel-value', OFFERS_0_ROUNDEL_SPLIT_SCOPE, splitScopes);
    seedLayer('roundel-copy', OFFERS_0_ROUNDEL_COPY_ONLY_SCOPE, copyOnlyScopes);
    seedLayer('roundel-value', OFFERS_0_ROUNDEL_COPY_ONLY_SCOPE, copyOnlyScopes);
  }
  return document;
};

/** Ensure each size has a selectable bg-image layer + classRule frame. */
export const ensureBackgroundLayers = (document: Record<string, unknown> | null) => {
  if (!document?.sizes || typeof document.sizes !== 'object') return document;
  for (const sizeCreative of Object.values(document.sizes) as Array<Record<string, unknown>>) {
    if (!sizeCreative || typeof sizeCreative !== 'object') continue;
    const canvas = sizeCreative.canvas || {};
    const width = Number(canvas.width) || 0;
    const height = Number(canvas.height) || 0;
    const classRule = ensureClassRule(sizeCreative, BG_IMAGE_CSS_CLASS);
    classRule.properties = {
      left: 0,
      top: 0,
      width,
      height,
      objectFit: 'cover',
      ...(classRule.properties || {}),
    };
    // Keep bannerette natural aspect when height was left as auto.
    if (classRule.properties.height === 'auto' && width > 0) {
      classRule.properties.height = Math.round((width * 90) / 728);
    }
    if (!classRule.properties.objectFit) {
      classRule.properties.objectFit = 'cover';
    }
    const layers = sizeCreative.layers || [];
    sizeCreative.layers = layers;
    if (!layers.some((layer: Record<string, unknown>) => layer.id === BG_IMAGE_LAYER_ID)) {
      layers.unshift({
        ...backgroundLayerDescriptor(sizeCreative),
        asset: sizeCreative.assets?.background || '',
      });
    } else {
      const existing = layers.find((layer: Record<string, unknown>) => layer.id === BG_IMAGE_LAYER_ID);
      if (existing) {
        existing.base = { ...(existing.base || {}), cssClass: BG_IMAGE_CSS_CLASS };
        if (!existing.asset) existing.asset = sizeCreative.assets?.background || '';
        if (existing.label == null) existing.label = 'Background';
        if (existing.group == null) existing.group = 'Waves / background';
        if (existing.kind == null) existing.kind = 'image';
        if (!Array.isArray(existing.clips)) existing.clips = [];
      }
    }
  }
  return document;
};

const identityForTarget = (
  layer: Record<string, unknown>,
  parsed: { layerId?: string; childId?: string; isNested?: boolean },
) => {
  if (parsed.isNested) {
    const child = childDefinitionForTarget(String(parsed.childId || ''));
    if (!child) throw new Error(`Unknown nested target: ${parsed.childId}`);
    return { cssClass: child.cssClass, child };
  }
  const cssClass = layer.base?.cssClass || layer.id;
  return { layerId: layer.id, cssClass };
};

const writeSharedTargetValue = (
  sizeCreative: Record<string, unknown>,
  layer: Record<string, unknown>,
  parsed: { childId?: string; isNested?: boolean },
  field: string,
  value: unknown,
) => {
  if (parsed.isNested) {
    const child = childDefinitionForTarget(String(parsed.childId || ''));
    if (!child) throw new Error(`Unknown nested target: ${parsed.childId}`);
    const classRule = ensureClassRule(sizeCreative, child.cssClass);
    classRule.properties[field] = value;
    return;
  }
  if (isHeadlineLayer(layer) && HEADLINE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, HEADLINE_CSS_CLASS);
    classRule.properties[field] = value;
    return;
  }
  if (isBackgroundLayer(layer) && BG_IMAGE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, BG_IMAGE_CSS_CLASS);
    classRule.properties[field] = value;
    return;
  }
  layer.base = {
    ...(layer.base || {}),
    [field]: value,
  };
};

export const updateCreativeTargetSharedValue = (
  document: Record<string, unknown>,
  size: string,
  targetId: string,
  field: string,
  value: unknown,
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);
  writeSharedTargetValue(sizeCreative, layer, parsed, field, value);
  return next;
};

export const clearCreativeTargetActiveOverride = (
  document: Record<string, unknown>,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
  fields: string[] = [],
) => {
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);
  const identity = identityForTarget(layer, parsed);
  const rule = findActiveVariantRule(sizeCreative, identity, activeScopes);
  if (!rule) return next;

  if (fields.length) {
    const target = findCreativeTarget(document, size, targetId, activeScopes);
    for (const field of fields) {
      const source = target?.valueProvenance?.[field];
      const owner = source?.kind === 'variantRule'
        ? (sizeCreative.variantRules || []).find((item) => item.id === source.ruleId)
        : null;
      if (owner) delete owner.props?.[field];
    }
  } else {
    rule.props = {};
    delete rule.fit;
  }

  const hasProps = Object.keys(rule.props || {}).length > 0;
  const hasFit = Boolean(rule.fit && Object.keys(rule.fit).length > 0);
  // Keep the variant rule if a scoped fit override remains — clearing layout
  // props alone must not wipe independent wrap/shrink settings.
  if (!hasProps && !hasFit) {
    sizeCreative.variantRules = (sizeCreative.variantRules || []).filter((item: Record<string, unknown>) => item !== rule);
  }
  return next;
};

/** Reset only the controlling local/variant field; inherited values are untouched. */
export const resetCreativeTargetField = (document, size, targetId, scopes, domain, field) => {
  const target = findCreativeTarget(document, size, targetId, scopes);
  const source = (domain === 'fit' ? target?.fitProvenance : target?.valueProvenance)?.[field];
  if (source?.kind === 'localOverride') return resetCreativeOwnershipField(document, size, targetId, scopes, domain, field);
  const next = deepClone(document);
  if (source?.kind === 'variantRule') {
    const rule = currentSizeCreative(next, size)?.variantRules?.find((item) => item.id === source.ruleId);
    if (rule) delete rule[domain === 'fit' ? 'fit' : 'props']?.[field];
  }
  return next;
};

export const promoteCreativeTargetToSharedStyle = (
  document: Record<string, unknown>,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
  fields: string[] = [],
) => {
  const current = findCreativeTarget(document, size, targetId, activeScopes);
  if (!current) throw new Error(`Unknown target: ${targetId}`);

  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);

  const targetFields = fields.length ? fields : Object.keys(current.values || {});
  for (const field of targetFields) {
    if (current.values?.[field] === undefined) continue;
    writeSharedTargetValue(sizeCreative, layer, parsed, field, current.values[field]);
  }

  return clearCreativeTargetActiveOverride(next, size, targetId, activeScopes, targetFields);
};

export const updateCreativeTargetValue = (
  document: Record<string, unknown>,
  size: string,
  targetId: string,
  activeScopes: string[] = [],
  field: string,
  value: unknown,
) => {
  const effectiveSource = findCreativeTarget(document, size, targetId, activeScopes)?.valueProvenance?.[field];
  if (effectiveSource?.kind === 'sharedDefinition' || effectiveSource?.kind === 'localOverride') {
    return setCreativeOwnershipField(document, size, targetId, activeScopes, 'values', field, value, 'local');
  }
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);

  const source = findCreativeTarget(document, size, targetId, activeScopes)?.valueProvenance?.[field];
  if (source?.kind === 'variantRule') {
    const rule = (sizeCreative.variantRules || []).find((item) => item.id === source.ruleId);
    rule.props = { ...(rule.props || {}), [field]: value };
    return next;
  }

  if (parsed.isNested) {
    const child = childDefinitionForTarget(parsed.childId);
    if (!child) throw new Error(`Unknown nested target: ${parsed.childId}`);
    const variantRule = findActiveVariantRule(sizeCreative, { cssClass: child.cssClass }, activeScopes);
    if (variantRule) {
      variantRule.props = { ...(variantRule.props || {}), [field]: value };
      return next;
    }
    const classRule = ensureClassRule(sizeCreative, child.cssClass);
    classRule.properties[field] = value;
    return next;
  }

  const headlineIdentity = isHeadlineLayer(layer)
    ? { cssClass: HEADLINE_CSS_CLASS, layerId: layer.id }
    : null;
  const backgroundIdentity = isBackgroundLayer(layer)
    ? { cssClass: BG_IMAGE_CSS_CLASS }
    : null;
  const cssClass = headlineIdentity?.cssClass
    || backgroundIdentity?.cssClass
    || layer.base?.cssClass
    || layer.id;
  const isCtaLayer = String(layer.id || '') === 'cta' || cssClass === 'cta';
  const isRoundelLayer = isRoundelIdentity({ layerId: String(layer.id || ''), cssClass });
  const scopes = (activeScopes || []).map(String);
  if (isCtaLayer && scopes.includes('offers-0') && !headlineIdentity && !backgroundIdentity) {
    writeOffers0CtaField(sizeCreative, scopes, field, value);
    return next;
  }
  if (isRoundelLayer && scopes.includes('offers-0') && !headlineIdentity && !backgroundIdentity) {
    writeOffers0RoundelField(sizeCreative, String(layer.id || cssClass), scopes, field, value);
    return next;
  }

  const variantRule = headlineIdentity
    ? findActiveVariantWriteRule(sizeCreative, headlineIdentity, activeScopes)
    : findActiveVariantRule(
      sizeCreative,
      backgroundIdentity || { layerId: layer.id, cssClass },
      activeScopes,
    );
  if (variantRule) {
    variantRule.props = { ...(variantRule.props || {}), [field]: value };
    return next;
  }

  if (headlineIdentity && HEADLINE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, HEADLINE_CSS_CLASS);
    classRule.properties[field] = value;
    return next;
  }

  if (backgroundIdentity && BG_IMAGE_STYLE_FIELDS.has(field)) {
    const classRule = ensureClassRule(sizeCreative, BG_IMAGE_CSS_CLASS);
    classRule.properties[field] = value;
    return next;
  }

  layer.base = {
    ...(layer.base || {}),
    [field]: value,
  };
  return next;
};

export const updateCreativeLayerClip = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  clipId: string,
  change: { field: string; value: unknown; target?: 'params' | 'clip' },
) => {
  const next = deepClone(document);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  const clip = (layer.clips || []).find((item: Record<string, unknown>) => item.id === clipId);
  if (!clip) throw new Error(`Unknown clip: ${clipId}`);
  if (change.target === 'params') {
    clip.params = {
      ...(clip.params || {}),
      [change.field]: change.value,
    };
  } else {
    const beats = beatsForScopes(document, [clip.profile || clip.frameScope || 'frames-3']);
    const durationS = document.clock?.durationS || 15;
    const time = (value) => { try { return resolveTimeRef(value, beats, durationS); } catch { return Number.NaN; } };
    const nextBoundary = time(change.value);
    if (
      (change.field === 'start' || change.field === 'end')
      && Array.isArray(clip.keyframes)
      && Number.isFinite(nextBoundary)
    ) {
      const previousBoundary = time(clip[change.field]);
      const numericKeyframes = clip.keyframes
        .map((keyframe: Record<string, unknown>) => time(keyframe.at))
        .filter((at: number) => Number.isFinite(at));
      const inferredBoundary = change.field === 'start'
        ? Math.min(...numericKeyframes)
        : Math.max(...numericKeyframes);
      clip.keyframes = clip.keyframes.map((keyframe: Record<string, unknown>) => {
        const at = time(keyframe.at);
        if (
          Number.isFinite(at)
          && (
            (Number.isFinite(previousBoundary) && at === previousBoundary)
            || at === inferredBoundary
          )
        ) {
          return { ...keyframe, at: keyframe.at?.unit === 'seconds' ? { value: nextBoundary * durationS / 100, unit: 'seconds' } : keyframe.at?.unit === 'timeline-percent' ? { value: nextBoundary, unit: 'timeline-percent' } : nextBoundary };
        }
        return keyframe;
      });
    }
    clip[change.field] = change.value;
  }
  return next;
};

export const addCreativeLayerClip = (
  document: Record<string, unknown>,
  size: string,
  layerId: string,
  clip: Record<string, unknown>,
) => {
  const next = deepClone(document);
  const layer = findCreativeLayer(next, size, layerId);
  if (!layer) throw new Error(`Unknown layer: ${layerId}`);
  layer.clips = [...(layer.clips || []), clip];
  return next;
};

export const headlineOfferScope = (offerCount: number) => `offers-${offerCount}`;

export const headlineOfferVariantRule = (
  sizeCreative: Record<string, unknown> | null,
  offerCount: number,
) => {
  if (!sizeCreative || offerCount < 0 || offerCount > 3) return null;
  return (sizeCreative.variantRules || []).find(
    (rule: Record<string, unknown>) => rule.id === `${headlineOfferScope(offerCount)}|${HEADLINE_CSS_CLASS}`,
  ) || null;
};

const pickLayoutProps = (
  values: Record<string, unknown> = {},
  fields: string[] = HEADLINE_LAYOUT_FIELDS,
) => (
  Object.fromEntries(
    fields
      .filter((field) => values[field] !== undefined && values[field] !== null && values[field] !== '')
      .map((field) => [field, values[field]]),
  )
);

const layoutValuesEqual = (
  left: Record<string, unknown> = {},
  right: Record<string, unknown> = {},
  fields: string[] = HEADLINE_LAYOUT_FIELDS,
) => {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((field) => fields.includes(field));
  return keys.every((field) => left[field] === right[field]);
};

export const resolveHeadlineLayoutValues = (
  document: Record<string, unknown> | null,
  size: string,
  offerCount: number,
  fields: string[] = HEADLINE_LAYOUT_FIELDS,
) => {
  const sizeCreative = currentSizeCreative(document, size);
  if (!sizeCreative) return {};
  const classRule = findClassRule(sizeCreative, HEADLINE_CSS_CLASS);
  const variantProps = mergedActiveVariantProps(
    sizeCreative,
    { cssClass: HEADLINE_CSS_CLASS },
    [headlineOfferScope(offerCount)],
  );
  return pickLayoutProps({ ...(classRule?.properties || {}), ...variantProps }, fields);
};

export const headlineOfferLayoutStatus = (
  document: Record<string, unknown> | null,
  size: string,
) => {
  const sizeCreative = currentSizeCreative(document, size);
  const baseline = resolveHeadlineLayoutValues(document, size, 1);
  const dual = resolveHeadlineLayoutValues(document, size, 2);

  return [1, 2, 3].map((offerCount) => {
    const resolved = resolveHeadlineLayoutValues(document, size, offerCount);
    const rule = headlineOfferVariantRule(sizeCreative, offerCount);
    const hasRule = Boolean(rule && Object.keys(rule.props || {}).length);

    if (offerCount === 1) {
      return {
        offerCount,
        label: '1-offer',
        tone: 'baseline',
        detail: 'Shared baseline for single-offer ads',
      };
    }

    if (!hasRule || layoutValuesEqual(resolved, baseline)) {
      return {
        offerCount,
        label: `${offerCount}-offer`,
        tone: 'baseline',
        detail: 'Uses the 1-offer baseline',
      };
    }

    if (offerCount === 3 && layoutValuesEqual(resolved, dual)) {
      return {
        offerCount,
        label: '3-offer',
        tone: 'linked',
        detail: 'Matches the 2-offer layout',
      };
    }

    return {
      offerCount,
      label: `${offerCount}-offer`,
      tone: 'custom',
      detail: 'Custom layout for this offer count',
    };
  });
};

export const copyCreativeHeadlineOfferLayout = (
  document: Record<string, unknown>,
  size: string,
  sourceOfferCount: number,
  targetOfferCount: number,
) => {
  if (sourceOfferCount < 1 || sourceOfferCount > 3) throw new Error(`Unknown source offer count: ${sourceOfferCount}`);
  if (targetOfferCount < 2 || targetOfferCount > 3) throw new Error('Can only copy headline layout onto 2- or 3-offer variants');
  if (sourceOfferCount === targetOfferCount) return deepClone(document);

  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);

  const props = pickLayoutProps(resolveHeadlineLayoutValues(next, size, sourceOfferCount));
  const scope = headlineOfferScope(targetOfferCount);
  const id = `${scope}|${HEADLINE_CSS_CLASS}`;
  sizeCreative.variantRules = sizeCreative.variantRules || [];
  let rule = sizeCreative.variantRules.find((item: Record<string, unknown>) => item.id === id);
  if (!rule) {
    rule = {
      id,
      scope,
      cssClass: HEADLINE_CSS_CLASS,
      when: { offer_count_num: targetOfferCount },
      props: {},
      editable: true,
    };
    sizeCreative.variantRules.push(rule);
  }
  rule.props = { ...props };
  return next;
};

export const resetCreativeHeadlineOfferLayout = (
  document: Record<string, unknown>,
  size: string,
  offerCount: number,
) => {
  if (offerCount < 2 || offerCount > 3) throw new Error('Can only reset 2- or 3-offer headline variants');
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const id = `${headlineOfferScope(offerCount)}|${HEADLINE_CSS_CLASS}`;
  sizeCreative.variantRules = (sizeCreative.variantRules || []).filter(
    (rule: Record<string, unknown>) => rule.id !== id,
  );
  return next;
};
