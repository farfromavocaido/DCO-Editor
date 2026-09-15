// @ts-nocheck
import { excludedHeadlineLayerIdsForVariantRule, selectorForVariantRule } from './creative-css';

/** Empty scopes apply globally; compound scopes require every token. */
export const ownershipScopeIsActive = (scope, scopes = []) => String(scope || '').split('.').filter(Boolean).every((part) => scopes.includes(part));

/** Mirror the selectors emitted for legacy documents until migration is explicit. */
export const ownershipRuleSpecificity = (rule) => {
  const selector = selectorForVariantRule(rule);
  return (selector.match(/#[\w-]+/g) || []).length * 1000
    + (selector.match(/\.[\w-]+|\[[^\]]+\]/g) || []).length;
};
export const activeOwnershipRules = (rules = [], identity, scopes = []) => rules.filter((rule) => {
  if (!ownershipScopeIsActive(rule.scope, scopes)) return false;
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
      if (value === undefined || value === null || value === '') continue;
      values[key] = value;
      provenance[key] = { kind: 'variantRule', ruleId: rule.id, scope: rule.scope || '', layerId: rule.layerId, cssClass: rule.cssClass };
    }
  }
  return { values, provenance };
};
