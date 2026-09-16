// @ts-nocheck
import { findCreativeTarget } from './creative-model';
import { setCreativeOwnershipField } from './creative-ownership';

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
  if (!destinations.length) throw new Error('Choose at least one format and offer count.');
  const bundle = selectedOwnershipValues(findCreativeTarget(document, sourceSize, targetId, scopes), selected);
  if (!Object.values(bundle).some(values => Object.keys(values).length)) throw new Error('Choose at least one property.');
  let next = replaceOwnershipDestinationLocals(document,destinations,Object.fromEntries(Object.entries(bundle).map(([domain,values]) => [domain,Object.keys(values)])));
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

const conditionFamilies = [
  ['offers-0','offers-1','offers-2','offers-3'], ['cta-rect','cta-roundel'],
  ['roundel-split','roundel-copy-only'], ['roundel-frame-on','roundel-frame-off'],
  ['tc-solo','tc-prices'], ['frames-3','frames-4'], ['navy-headlines','white-headlines'],
];
/** Replace a destination's fields while retaining local values everywhere outside it. */
export function replaceOwnershipDestinationLocals(document, destinations, fields) {
  const next = structuredClone(document);
  for (const destination of destinations) {
    const destinationFields = typeof fields === 'function' ? fields(destination) : fields;
    const wanted = destination.scope.split('.').filter(Boolean).sort((a,b) => Number(/^offers-/.test(b)) - Number(/^offers-/.test(a)));
    if (wanted.some(token => /^(navy|white)-headlines$/.test(token)) && !wanted.includes('offers-0')) throw new Error('Headline colour conditions apply only to 0 offers.');
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
