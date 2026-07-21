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

export const selectorForVariantRule = (rule: Record<string, unknown>) => {
  const base = selectorForClassRule(String(rule.cssClass || rule.layerId || ''));
  return `.${rule.scope} ${base}`;
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
      const merged = { ...classProps, ...(rule.props || {}) };
      const budgeted = propsWithFitBudget(merged, fit);
      // Only emit fields the variant actually owns, plus derived height/top.
      const props = {
        ...(rule.props || {}),
        height: budgeted.height,
        ...(rule.props?.top !== undefined || budgeted.top !== classProps.top
          ? { top: budgeted.top }
          : {}),
      };
      return renderCssRule(selectorForVariantRule(rule), props);
    })
    .filter(Boolean);
  return [...classRules, ...variantRules].join('\n\n');
};
