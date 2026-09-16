// @ts-nocheck
import { materializeComponentLinks } from './creative-components';
import { campaignConditionFamilies } from './campaign-variants';
import { excludedHeadlineLayerIdsForVariantRule, selectorForVariantRule } from './creative-css';

/** Empty scopes apply globally; compound scopes require every token. */
export const ownershipScopeIsActive = (scope: unknown, scopes: string[] = []) => String(scope || '').split('.').filter(Boolean).every((part) => scopes.includes(part));

/** Mirror the selectors emitted for legacy documents until migration is explicit. */
export const ownershipRuleSpecificity = (rule) => {
  const selector = selectorForVariantRule(rule).replace(/:where\([^)]*\)/g, '');
  return (selector.match(/#[\w-]+/g) || []).length * 1000
    + (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
};
export const activeOwnershipRules = (rules: any[] = [], identity: any, scopes: string[] = []) => rules.filter((rule) => {
  if (!ownershipScopeIsActive(rule.scope, scopes)) return false;
  if (rule.targetId) return rule.targetId === identity.targetId;
  if (identity.layerId && excludedHeadlineLayerIdsForVariantRule(rule).includes(identity.layerId)) return false;
  return String(rule.layerId || '').startsWith('headline-act')
    ? rule.layerId === identity.layerId
    : (Boolean(identity.cssClass) && (rule.cssClass || rule.layerId) === identity.cssClass) || (Boolean(identity.layerId) && rule.layerId === identity.layerId);
}).sort((a, b) => ownershipRuleSpecificity(a) - ownershipRuleSpecificity(b));

export const resolveOwnedFields = (base, baseSource, rules, field = 'props') => {
  const values = { ...base };
  const provenance = Object.fromEntries(Object.keys(values).map((key) => [key, baseSource]));
  for (const rule of rules) {
    for (const [key, value] of Object.entries(rule[field] || {})) {
      if (value === undefined || value === null || (value === '' && !(field === 'fit' && ['frame', 'sharedGroup'].includes(key)))) continue;
      values[key] = value;
      provenance[key] = rule.ownershipFieldSources?.[field]?.[key] || rule.ownershipSource || { kind: 'variantRule', ruleId: rule.id, scope: rule.scope || '', layerId: rule.layerId, cssClass: rule.cssClass };
    }
  }
  return { values, provenance };
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const targetParts = (targetId) => String(targetId).split('::');
const targetIdentity = (document, size, targetId) => {
  const [layerId, childId] = targetParts(targetId);
  const layer = document.sizes?.[size]?.layers?.find((item) => item.id === layerId);
  if (!layer || (childId && (!/^offer-slot-\d+$/.test(layerId) || !['offer-value', 'offer-subline'].includes(childId)))) throw new Error(`Unknown ownership target: ${size}/${targetId}`);
  if (!/^[\w-]+(?:::[\w-]+)?$/.test(targetId)) throw new Error(`Invalid ownership target: ${targetId}`);
  return { layerId, cssClass: childId || layer.base?.cssClass || layerId, targetId };
};
const scopeParts = (scope) => String(scope || '').split('.').filter(Boolean);
const scopesOverlap = (document, a, b) => !campaignConditionFamilies(document).some(family => scopeParts(a).some(x => family.includes(x) && scopeParts(b).some(y => y !== x && family.includes(y))));
const memberKey = (member) => `${member.size}/${member.targetId}/${member.scope || ''}`;
const definitionFields = (definition, size, domain, member) => Object.fromEntries(Object.entries({ ...(definition[domain] || {}), ...(definition.perSize?.[size]?.[domain] || {}) }).filter(([field]) => !(member?.exclude?.[domain] || []).includes(field)));

const sharedFieldSource = (definition, member, domain, field) => {
  const formatOverride = Object.hasOwn(definition.perSize?.[member.size]?.[domain] || {}, field);
  return {
    kind: 'sharedDefinition', definitionId: definition.id, name: definition.name, member,
    domain, field, sourceLevel: formatOverride ? 'format' : 'definition',
    ...(formatOverride ? { format: member.size } : {}),
  };
};

/** Describe the actual authored field changed by an explicit shared-source edit. */
export const sharedCreativeFieldReach = (document, source) => {
  const definition = document?.sharedDefinitions?.find((item) => item.id === source?.definitionId);
  if (!definition || source?.kind !== 'sharedDefinition') return { members: [], localExceptions: [] };
  const { domain, field } = source;
  const members = definition.members.filter((member) => {
    if ((member.exclude?.[domain] || []).includes(field)) return false;
    const formatOwns = Object.hasOwn(definition.perSize?.[member.size]?.[domain] || {}, field);
    return source.sourceLevel === 'format'
      ? member.size === source.format && formatOwns
      : !formatOwns && Object.hasOwn(definition[domain] || {}, field);
  });
  const localExceptions = members.flatMap((member) => {
    const scopes = (document.sizes?.[member.size]?.localOverrides || [])
      .filter((local) => local.targetId === member.targetId
        && scopesOverlap(document, local.scope, member.scope)
        && local[domain]?.[field] !== undefined && local[domain]?.[field] !== null && local[domain]?.[field] !== '')
      .map((local) => local.scope || '');
    return scopes.length ? [{ member, scopes: [...new Set(scopes)] }] : [];
  });
  return { members, localExceptions };
};

/** Pure, idempotent compatibility compiler. Authored definitions are never rewritten. */
export const materializeCreativeOwnership = (document: any): any => {
  document = materializeComponentLinks(document);
  if (!document?.sharedDefinitions?.length && !Object.values(document?.sizes || {}).some((size) => size.localOverrides?.length || size.variantRules?.some((rule) => rule.ownershipGenerated))) return document;
  const next = clone(document);
  const ids = new Set();
  const assignments = [];
  for (const definition of next.sharedDefinitions || []) {
    if (!definition.id || !definition.name || ids.has(definition.id) || !Array.isArray(definition.members)) throw new Error('Shared definitions require unique IDs, names, and members');
    ids.add(definition.id);
    for (const member of definition.members) {
      targetIdentity(next, member.size, member.targetId);
      for (const domain of ['values', 'fit']) {
        const fields = definitionFields(definition, member.size, domain, member);
        for (const previous of assignments) {
          if (previous.member.size === member.size && previous.member.targetId === member.targetId && previous.domain === domain && scopesOverlap(document, previous.member.scope, member.scope)) {
            const duplicate = Object.keys(fields).find((field) => Object.hasOwn(previous.fields, field));
            if (duplicate) throw new Error(`Shared ownership conflict for ${member.size}/${member.targetId} ${domain}.${duplicate}: ${previous.definitionName} and ${definition.name}`);
          }
        }
        assignments.push({ definitionId: definition.id, definitionName: definition.name, member, domain, fields });
      }
    }
  }
  for (const [size, creative] of Object.entries(next.sizes || {})) {
    creative.variantRules = (creative.variantRules || []).filter((rule) => !rule.ownershipGenerated);
    const priority = Math.floor(Math.max(0, ...creative.variantRules.map(ownershipRuleSpecificity)) / 1000) + 2;
    for (const definition of next.sharedDefinitions || []) for (const member of definition.members.filter((member) => member.size === size)) {
      creative.variantRules.push({
        id: `ownership:shared:${definition.id}:${memberKey(member)}`,
        ...targetIdentity(next, size, member.targetId), scope: member.scope || '',
        props: definitionFields(definition, size, 'values', member), fit: definitionFields(definition, size, 'fit', member),
        ownershipGenerated: true, ownershipPriority: priority,
        ownershipSource: { kind: 'sharedDefinition', definitionId: definition.id, name: definition.name, member },
        ownershipFieldSources: Object.fromEntries(['values', 'fit'].map((domain) => [
          domain === 'values' ? 'props' : 'fit',
          Object.fromEntries(Object.keys(definitionFields(definition, size, domain, member)).map((field) => [field, sharedFieldSource(definition, member, domain, field)])),
        ])),
      });
    }
    const detachedCount = (creative.localOverrides || []).filter((local) => local.detached).length;
    let detachedPriority = detachedCount;
    for (const [index, local] of (creative.localOverrides || []).entries()) {
      creative.variantRules.push({
        id: `ownership:local:${size}:${index}`,
        ...targetIdentity(next, size, local.targetId), scope: local.scope || '',
        props: local.values || {}, fit: local.fit || {}, ownershipGenerated: true, ownershipPriority: priority + (local.detached ? detachedPriority-- : detachedCount + 1),
        ...(local.scopeSpecificity !== undefined ? { ownershipScopeSpecificity: local.scopeSpecificity } : {}),
        ownershipSource: { kind: 'localOverride', targetId: local.targetId, scope: local.scope || '', index },
      });
    }
  }
  return next;
};

export const activeNamedOwnership = (document: any, size: string, targetId: string, scopes: string[] = []) => {
  const compiled = materializeCreativeOwnership(document);
  return activeOwnershipRules(compiled.sizes?.[size]?.variantRules || [], targetIdentity(compiled, size, targetId), scopes).filter((rule) => rule.ownershipGenerated);
};
const localFor = (next, size, targetId, scopes) => {
  const scope = [...new Set(scopes)].sort().join('.');
  const creative = next.sizes[size];
  creative.localOverrides ||= [];
  let local = creative.localOverrides.find((item) => !item.detached && item.scopeSpecificity === undefined && item.targetId === targetId && (item.scope || '') === scope);
  if (!local) { local = { targetId, scope, values: {}, fit: {} }; creative.localOverrides.push(local); }
  return local;
};
/** Explicit intent: local exceptions never mutate named members; shared edits name their source. */
export const setCreativeOwnershipField = (document: any, size: string, targetId: string, scopes: string[], domain: 'values' | 'fit', field: string, value: any, intent: 'local' | 'shared' = 'local', definitionId?: string) => {
  const next = clone(document);
  targetIdentity(next, size, targetId);
  let destination;
  if (intent === 'shared') {
    destination = next.sharedDefinitions?.find((definition) => definition.id === definitionId);
    if (!destination || !destination.members.some((member) => member.size === size && member.targetId === targetId && ownershipScopeIsActive(member.scope, scopes))) throw new Error('Choose an active named shared source');
    // Edit the same per-format field that supplies this format, when present.
    if (Object.hasOwn(destination.perSize?.[size]?.[domain] || {}, field)) destination = destination.perSize[size];
  } else destination = localFor(next, size, targetId, scopes);
  destination[domain] = { ...(destination[domain] || {}), [field]: value };
  materializeCreativeOwnership(next); // Reject a new ambiguous field assignment.
  return next;
};

export const resetCreativeOwnershipField = (document, size, targetId, scopes, domain, field) => {
  const next = clone(document);
  const rules = activeNamedOwnership(next, size, targetId, scopes).filter((rule) => rule.ownershipSource.kind === 'localOverride' && Object.hasOwn(rule[domain === 'values' ? 'props' : 'fit'] || {}, field));
  const rule = rules.at(-1);
  if (rule) delete next.sizes[size].localOverrides[rule.ownershipSource.index][domain][field];
  return next;
};
/** Detach one explicit membership, copying its authored bundle into a local exception. */
export const detachCreativeOwnership = (document: any, definitionId: string, member: any, fields?: {values?: string[];fit?: string[]}) => {
  const next = clone(document);
  const definition = next.sharedDefinitions?.find((item) => item.id === definitionId);
  if (!definition || !definition.members.some((item) => memberKey(item) === memberKey(member))) throw new Error('Unknown shared membership');
  const ownedMember = definition.members.find((item) => memberKey(item) === memberKey(member));
  // A detached bundle replaces its shared source, below every pre-existing local
  // exception. Merging into an ordinary scoped local would change the winner for
  // fields currently supplied by a broader local override.
  const local = { targetId: member.targetId, scope: member.scope || '', detached: true, values: {}, fit: {} };
  next.sizes[member.size].localOverrides ||= [];
  next.sizes[member.size].localOverrides.push(local);
  for (const domain of ['values', 'fit']) {
    const bundle = definitionFields(definition, member.size, domain, ownedMember);
    const copied = Object.fromEntries(Object.entries(bundle).filter(([field]) => !fields || fields[domain]?.includes(field)));
    local[domain] = { ...copied, ...(local[domain] || {}) };
    if (fields) {
      ownedMember.exclude ||= {};
      ownedMember.exclude[domain] = [...new Set([...(ownedMember.exclude[domain] || []), ...Object.keys(copied)])];
    }
  }
  if (!fields) definition.members = definition.members.filter((item) => memberKey(item) !== memberKey(member));
  return next;
};

export const linkCreativeOwnership = (document, definitionId, member) => {
  const next = clone(document);
  targetIdentity(next, member.size, member.targetId);
  const definition = next.sharedDefinitions?.find((item) => item.id === definitionId);
  if (!definition) throw new Error('Unknown shared definition');
  if (!definition.members.some((item) => memberKey(item) === memberKey(member))) definition.members.push(member);
  materializeCreativeOwnership(next);
  return next;
};

export const createCreativeOwnershipDefinition = (document, definition) => {
  const next = clone(document);
  next.sharedDefinitions = [...(next.sharedDefinitions || []), clone(definition)];
  materializeCreativeOwnership(next);
  return next;
};

/** Copy the chosen source once without creating a sharing relationship. */
export const copyCreativeOwnership = (document, definitionId, member) => {
  const next = clone(document);
  targetIdentity(next, member.size, member.targetId);
  const definition = next.sharedDefinitions?.find((item) => item.id === definitionId);
  if (!definition) throw new Error('Unknown shared definition');
  const local = localFor(next, member.size, member.targetId, scopeParts(member.scope));
  for (const domain of ['values', 'fit']) local[domain] = { ...(local[domain] || {}), ...definitionFields(definition, member.size, domain) };
  return next;
};
