#!/usr/bin/env node
/**
 * One-off migration: move headline box/style props onto shared sse-headline class.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../campaign/sse-dco-creative.json');

const HEADLINE_CSS_CLASS = 'sse-headline';
const HEADLINE_STYLE_FIELDS = new Set([
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

const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

for (const [, sizeCreative] of Object.entries(doc.sizes)) {
  const headlines = (sizeCreative.layers || []).filter((layer) => String(layer.id || '').startsWith('headline-act'));
  if (!headlines.length) continue;

  sizeCreative.classRules = sizeCreative.classRules || [];
  let classRule = sizeCreative.classRules.find((rule) => rule.cssClass === HEADLINE_CSS_CLASS);
  if (!classRule) {
    classRule = { cssClass: HEADLINE_CSS_CLASS, properties: {} };
    sizeCreative.classRules.push(classRule);
  }
  classRule.properties = classRule.properties || {};

  const canonical = headlines.find((layer) => layer.id === 'headline-act1') || headlines[0];
  for (const [key, value] of Object.entries(canonical.base || {})) {
    if (key === 'cssClass' || !HEADLINE_STYLE_FIELDS.has(key)) continue;
    classRule.properties[key] = value;
  }

  const canonicalFit = headlines.find((layer) => layer.fit)?.fit || headlines[0]?.fit;
  for (const layer of headlines) {
    layer.base = { cssClass: HEADLINE_CSS_CLASS };
    if (canonicalFit) layer.fit = { ...canonicalFit };
    else delete layer.fit;
  }

  const variantRules = sizeCreative.variantRules || [];
  const headlineVariants = variantRules.filter((rule) => (
    String(rule.layerId || '').startsWith('headline-act')
    || String(rule.cssClass || '').startsWith('headline-act')
  ));
  const scopes = [...new Set(headlineVariants.map((rule) => rule.scope))];
  sizeCreative.variantRules = variantRules.filter((rule) => !headlineVariants.includes(rule));
  for (const scope of scopes) {
    const scoped = headlineVariants.filter((rule) => rule.scope === scope);
    const props = scoped[0]?.props || {};
    sizeCreative.variantRules.push({
      id: `${scope}|${HEADLINE_CSS_CLASS}`,
      scope,
      cssClass: HEADLINE_CSS_CLASS,
      when: scoped[0]?.when,
      props: { ...props },
      editable: scoped[0]?.editable ?? true,
    });
  }

  if (typeof sizeCreative.manualCss === 'string') {
    sizeCreative.manualCss = sizeCreative.manualCss
      .replace(/\.headline-act[123]/g, `.${HEADLINE_CSS_CLASS}`)
      .replace(
        /\.offers-2 \.sse-headline,\s*\n\s*\.offers-3 \.sse-headline/g,
        '.offers-2 .sse-headline',
      );
  }
}

fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
