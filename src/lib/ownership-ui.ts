// @ts-nocheck
import { findCreativeTarget } from './creative-model';
import { setCreativeOwnershipField } from './creative-ownership';
import { campaignConditionFamilies, campaignVariantModel, isGenericCampaign, campaignScopes, campaignRowForScopes } from './campaign-variants';

/** Destinations are alternatives, never a conjunction of mutually exclusive counts. */
export function ownershipDestinations(targetId, formats, counts, conditions: string[] = []) {
  return [...new Set(formats)].flatMap(size => [...new Set(counts)].filter(count => [0,1,2,3].includes(count)).map(count => ({ size, targetId, scope: [`offers-${count}`, ...conditions.filter(token => !/^offers-/.test(token))].sort().join('.') })));
}
export function validOwnershipProperty(target, domain, field) {
  const keys = Object.keys(target?.[domain] || {});
  return keys.includes(field) ? field : keys[0] || '';
}
export function selectedOwnershipValues(target, selected) {
  return Object.fromEntries(['values','fit'].map(domain => [domain, Object.fromEntries(selected.filter(key => key.startsWith(`${domain}:`)).map(key => key.slice(domain.length + 1)).filter(field => target?.[domain]?.[field] !== undefined).map(field => [field, target[domain][field]]))]));
}
/** Capture the effective source before changing any destination. Copies stay independent. */
export function copyOwnershipSelection(document, sourceSize, targetId, scopes, selected, destinations) {
  if (!destinations.length) throw new Error('Choose at least one destination version and format.');
  const bundle = selectedOwnershipValues(findCreativeTarget(document, sourceSize, targetId, scopes), selected);
  if (!Object.values(bundle).some(values => Object.keys(values).length)) throw new Error('Choose at least one property.');
  const fields = Object.fromEntries(Object.entries(bundle).map(([domain,values]) => [domain,Object.keys(values)]));
  let next = replaceOwnershipDestinationLocals(replaceOwnershipDestinationLinks(document,destinations,fields),destinations,fields);
  for (const destination of destinations) {
    const parts = destination.scope.split('.');
    for (const [domain, values] of Object.entries(bundle)) for (const [field,value] of Object.entries(values)) next = setCreativeOwnershipField(next, destination.size, targetId, parts, domain, field, value);
  }
  return next;
}

/** Inspector edits author one local version; composite controls commit one document. */
export function editOwnershipVersion(document, size, targetId, scopes, domain, patch) {
  return Object.entries(patch).reduce((next, [field, value]) => {
    const parsed = value === '' ? '' : typeof value === 'boolean' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : value;
    return setCreativeOwnershipField(next, size, targetId, scopes, domain, field, parsed, 'local');
  }, document);
}

/** Replace a destination's fields while retaining local values everywhere outside it. */
export function replaceOwnershipDestinationLocals(document, destinations, fields) {
  const next = structuredClone(document);
  const conditionFamilies = campaignConditionFamilies(document);
  for (const destination of destinations) {
    const destinationFields = typeof fields === 'function' ? fields(destination) : fields;
    const wanted = destination.scope.split('.').filter(Boolean).sort((a,b) => Number(/^offers-/.test(b)) - Number(/^offers-/.test(a)));
    validateOwnershipScopes(document, wanted);
    const familyFor = token => conditionFamilies.find(family => family.includes(token));
    const locals = next.sizes[destination.size].localOverrides || [];
    next.sizes[destination.size].localOverrides = locals.flatMap(local => {
      if (local.targetId !== destination.targetId) return [local];
      const original = String(local.scope || '').split('.').filter(Boolean);
      if (wanted.some(token => original.some(other => other !== token && familyFor(token)?.includes(other)))) return [local];
      const removed = Object.fromEntries(['values','fit'].map(domain => [domain,Object.fromEntries(Object.entries(local[domain] || {}).filter(([field]) => destinationFields[domain]?.includes(field)))]));
      if (!Object.values(removed).some(values => Object.keys(values).length)) return [local];
      const retained = structuredClone(local);
      for (const domain of ['values','fit']) for (const field of Object.keys(removed[domain])) delete retained[domain][field];
      // A \ B: partition on the first destination condition that does not match.
      // These disjoint residual rules keep broad local values outside B intact.
      const residuals = [];
      const prefix = [...original];
      for (const token of wanted) {
        if (prefix.includes(token)) continue;
        const family = familyFor(token);
        if (!family) throw new Error(`Cannot safely replace local values for condition ${token}.`);
        for (const other of family.filter(value => value !== token)) residuals.push({...structuredClone(local),scope:[...prefix,other].sort().join('.'),scopeSpecificity:local.scopeSpecificity ?? original.length,...structuredClone(removed)});
        prefix.push(token);
      }
      return [retained,...residuals];
    });
  }
  return next;
}

/** Only fields actually supplied in this format may replace local values. */
export function suppliedOwnershipFields(definition, member) {
  const existing = definition.members?.find(item => item.size === member.size && item.targetId === member.targetId && (item.scope || '') === (member.scope || ''));
  return Object.fromEntries(['values','fit'].map(domain => [domain,Object.entries({...definition[domain],...definition.perSize?.[member.size]?.[domain]}).filter(([field,value]) => value !== undefined && value !== null && value !== '' && !existing?.exclude?.[domain]?.includes(field)).map(([field]) => field)]));
}

/** OR within a dimension, AND across dimensions. No campaign-specific tokens. */
export function campaignOwnershipDestinations(document, targetId, formats, choices) {
  const dimensions = campaignVariantModel(document).dimensions;
  let combinations = [[]];
  for (const dimension of dimensions) {
    const selected = choices[dimension.id] || [];
    if (!selected.length) continue;
    const options = dimension.options.filter(option => selected.includes(option.value));
    if (!options.length) throw new Error(`Choose a valid ${dimension.label}.`);
    combinations = combinations.flatMap(parts => options.map(option => [...parts, ...String(option.scope || '').split('.').filter(Boolean)]));
  }
  return [...new Set(formats)].flatMap(size => combinations.map(parts => {
    validateOwnershipScopes(document, parts);
    return {size,targetId,scope:[...new Set(parts)].sort().join('.')};
  }));
}
export function validateOwnershipScopes(document, parts) {
  for (const family of campaignConditionFamilies(document)) {
    if (family.filter(token => parts.includes(token)).length > 1) throw new Error('Choose only one value per condition in a version.');
  }
  const conditions = document.variantModel?.validConditions;
  if (conditions?.length && !conditions.some(condition => !condition.some(token => parts.some(other => other !== token && campaignConditionFamilies(document).some(family => family.includes(token) && family.includes(other)))))) throw new Error('This combination of campaign variables is not allowed.');
  // Legacy SSE's colour selector only exists on its zero-offer state.
  if (!isGenericCampaign(document) && parts.some(token => /^(navy|white)-headlines$/.test(token)) && !parts.includes('offers-0')) throw new Error('Headline colour conditions apply only to 0 offers.');
}
/** Replace link ownership only inside the selected destination; preserve other members. */
export function replaceOwnershipDestinationLinks(document, destinations, fields) {
  const next = structuredClone(document);
  const families = campaignConditionFamilies(document);
  for (const destination of destinations) {
    const wanted = destination.scope.split('.').filter(Boolean);
    const selected = typeof fields === 'function' ? fields(destination) : fields;
    for (const definition of next.sharedDefinitions || []) definition.members = definition.members.flatMap(member => {
      if (member.size !== destination.size || member.targetId !== destination.targetId) return [member];
      const original = String(member.scope || '').split('.').filter(Boolean);
      const familyFor = token => families.find(family => family.includes(token));
      if (wanted.some(token => original.some(other => other !== token && familyFor(token)?.includes(other)))) return [member];
      const residuals = [];
      const prefix = [...original];
      for (const token of wanted) {
        if (prefix.includes(token)) continue;
        const family = familyFor(token);
        if (!family) throw new Error(`Unknown condition ${token}.`);
        for (const other of family.filter(value => value !== token)) residuals.push({...structuredClone(member),scope:[...prefix,other].sort().join('.')});
        prefix.push(token);
      }
      const intersection = {...structuredClone(member),scope:[...new Set([...original,...wanted])].sort().join('.')};
      intersection.exclude ||= {};
      for (const domain of ['values','fit']) intersection.exclude[domain] = [...new Set([...(intersection.exclude[domain] || []),...(selected[domain] || [])])];
      return [...residuals,intersection];
    });
  }
  return next;
}

/** Enumerate actual versions for a review transaction; an empty dimension selects nothing. */
export function campaignConcreteDestinations(document, targetId, formats, choices, baseRow = {}, rows = []) {
  const dimensions = campaignVariantModel(document).dimensions.filter(dimension => !dimension.derived);
  let combinations = [[]];
  for (const dimension of dimensions) {
    const options = dimension.options.filter(option => (choices[dimension.id] || []).includes(option.value));
    if (!options.length) return [];
    combinations = combinations.flatMap(parts => options.map(option => [...parts,option.scope]));
  }
  const actual = new Map();
  for (const parts of combinations) {
    try {
      const row = resolveOwnershipVersionRow(document,baseRow,parts,rows).row;
      const scopes = campaignScopes(document,row);
      // Some legacy controls disappear or are constrained by the chosen layout.
      const available = parts.filter(token => isGenericCampaign(document) || !/^(navy|white)-headlines$/.test(token) || scopes.includes('offers-0'));
      if (available.some(token => !scopes.includes(token))) continue;
      const scope = [...scopes].sort().join('.');
      actual.set(scope,scope);
    } catch { /* Invalid campaign combinations are not destination versions. */ }
  }
  return [...new Set(formats)].flatMap(size => [...actual.keys()].map(scope => ({size,targetId,scope})));
}

/** Use the copy belonging to the reviewed version, including unsaved feed rows. */
export function resolveOwnershipVersionRow(document, baseRow, scopes, rows = []) {
  const synthesized = campaignRowForScopes(document,baseRow,scopes);
  const expected = campaignScopes(document,synthesized);
  const families = campaignVariantModel(document).dimensions.filter(dimension => !dimension.derived).map(dimension => dimension.options.map(option => option.scope));
  const relevant = expected.filter(scope => families.some(family => family.includes(scope)));
  const matches = row => {
    try {const actual = campaignScopes(document,row);return relevant.every(scope => actual.includes(scope));} catch{return false;}
  };
  const candidates = [baseRow,...(rows.length ? rows : document.feed?.sampleRows || [])];
  const row = candidates.find(matches);
  return {row:row || synthesized, synthesized:!row};
}
