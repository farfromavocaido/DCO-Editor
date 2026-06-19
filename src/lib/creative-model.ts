// @ts-nocheck

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

const findActiveVariantRule = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => (
  activeVariantRulesForIdentity(sizeCreative, identity, activeScopes).at(-1) || null
);

const ruleMatchesIdentity = (
  rule: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
) => (
  (
    (identity.layerId && rule.layerId === identity.layerId)
    || (identity.cssClass && rule.cssClass === identity.cssClass)
  )
);

const activeVariantRulesForIdentity = (
  sizeCreative: Record<string, unknown>,
  identity: { layerId?: string; cssClass?: string },
  activeScopes: string[] = [],
) => (
  activeScopes.flatMap((scope) => (
    (sizeCreative?.variantRules || []).filter((rule: Record<string, unknown>) => (
      String(rule.scope || '') === String(scope)
    && !propsOnlyHideVisibility(rule.props)
      && ruleMatchesIdentity(rule, identity)
    ))
  ))
);

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

export const findCreativeTarget = (
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
      fit: classRule?.fit || {},
      clips: layer.clips || [],
      writeSource: variantRule
        ? { kind: 'variantRule', ruleId: variantRule.id, scope: variantRule.scope }
        : { kind: 'classRule', cssClass: child.cssClass },
    };
  }

  if (isHeadlineLayer(layer)) {
    const classRule = findClassRule(sizeCreative, HEADLINE_CSS_CLASS);
    const identity = { cssClass: HEADLINE_CSS_CLASS };
    const variantRule = findActiveVariantRule(sizeCreative, identity, activeScopes);
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
      description: variantRule
        ? `Editing ${variantRule.scope} headline overrides (shared by all acts).`
        : 'Shared headline placement for acts 1–3.',
      values,
      base: values,
      clips: layer.clips || [],
      writeSource: variantRule
        ? { kind: 'variantRule', ruleId: variantRule.id, scope: variantRule.scope }
        : { kind: 'classRule', cssClass: HEADLINE_CSS_CLASS },
    };
  }

  const cssClass = layer.base?.cssClass || layer.id;
  const variantRule = findActiveVariantRule(sizeCreative, { layerId: layer.id, cssClass }, activeScopes);
  const variantProps = mergedActiveVariantProps(sizeCreative, { layerId: layer.id, cssClass }, activeScopes);
  const values = {
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
    coordinateScope: 'canvas',
    description: variantRule
      ? `Editing ${variantRule.scope} overrides for this layer.`
      : 'Position is relative to the canvas.',
    values,
    base: values,
    clips: layer.clips || [],
    writeSource: variantRule
      ? { kind: 'variantRule', ruleId: variantRule.id, scope: variantRule.scope }
      : { kind: 'layerBase', layerId: layer.id },
  };
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
  layer.base = {
    ...(layer.base || {}),
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
    for (const field of fields) {
      delete rule.props?.[field];
    }
  } else {
    rule.props = {};
  }

  const hasProps = Object.keys(rule.props || {}).length > 0;
  if (!hasProps) {
    sizeCreative.variantRules = (sizeCreative.variantRules || []).filter((item: Record<string, unknown>) => item !== rule);
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
  const next = deepClone(document);
  const sizeCreative = currentSizeCreative(next, size);
  if (!sizeCreative) throw new Error(`Unknown size: ${size}`);
  const parsed = parseCreativeTargetId(targetId);
  const layer = findCreativeLayer(next, size, parsed.layerId);
  if (!layer) throw new Error(`Unknown layer: ${parsed.layerId}`);

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
    ? { cssClass: HEADLINE_CSS_CLASS }
    : null;
  const cssClass = headlineIdentity?.cssClass || layer.base?.cssClass || layer.id;
  const variantRule = findActiveVariantRule(
    sizeCreative,
    headlineIdentity || { layerId: layer.id, cssClass },
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
    const nextBoundary = Number(change.value);
    if (
      (change.field === 'start' || change.field === 'end')
      && Array.isArray(clip.keyframes)
      && Number.isFinite(nextBoundary)
    ) {
      const previousBoundary = Number(clip[change.field]);
      const numericKeyframes = clip.keyframes
        .map((keyframe: Record<string, unknown>) => Number(keyframe.at))
        .filter((at: number) => Number.isFinite(at));
      const inferredBoundary = change.field === 'start'
        ? Math.min(...numericKeyframes)
        : Math.max(...numericKeyframes);
      clip.keyframes = clip.keyframes.map((keyframe: Record<string, unknown>) => {
        const at = Number(keyframe.at);
        if (
          Number.isFinite(at)
          && (
            (Number.isFinite(previousBoundary) && at === previousBoundary)
            || at === inferredBoundary
          )
        ) {
          return { ...keyframe, at: nextBoundary };
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
  if (!sizeCreative || offerCount < 1 || offerCount > 3) return null;
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
