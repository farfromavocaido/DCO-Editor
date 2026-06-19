#!/usr/bin/env node
/**
 * Ensure every size has offers-2|sse-headline and offers-3|sse-headline variant rules
 * (per offer-count headline placement, matching the 300x250 pattern).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docPath = path.join(__dirname, '../campaign/sse-dco-creative.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

const HEADLINE_CSS_CLASS = 'sse-headline';

const headlineBaseline = (sizeCreative) => (
  sizeCreative.classRules?.find((rule) => rule.cssClass === HEADLINE_CSS_CLASS)?.properties || {}
);

/** @returns {{ offers2: Record<string, unknown>, offers3: Record<string, unknown> } | null} */
const headlineOfferVariants = (sizeKey, canvas, baseline) => {
  const width = Number(canvas?.width) || 300;
  const baseLeft = Number(baseline.left);
  const baseTop = Number(baseline.top);
  const baseWidth = Number(baseline.width);

  if (sizeKey === '300x250') {
    return {
      offers2: { left: 10, width: 280, textAlign: 'center' },
      offers3: {
        left: 20,
        width: 280,
        textAlign: 'left',
        justifyContent: 'flex-start',
        ...(Number.isFinite(baseTop) ? { top: baseTop } : {}),
      },
    };
  }

  if (sizeKey === '728x90') {
    return {
      offers2: { left: 30, width: 205, textAlign: 'left' },
      offers3: {
        left: 30,
        width: 205,
        textAlign: 'left',
        justifyContent: 'flex-start',
        top: Number.isFinite(baseTop) ? baseTop : 16,
      },
    };
  }

  if (sizeKey === '320x50') {
    return {
      offers2: {
        left: Number.isFinite(baseLeft) ? baseLeft : 12,
        width: Number.isFinite(baseWidth) ? baseWidth : 240,
        textAlign: 'center',
      },
      offers3: {
        left: Number.isFinite(baseLeft) ? baseLeft : 12,
        width: 180,
        top: 18,
        textAlign: 'left',
        justifyContent: 'flex-start',
      },
    };
  }

  if (sizeKey === '160x600') {
    return {
      offers2: {
        left: Number.isFinite(baseLeft) ? baseLeft : 10,
        width: Number.isFinite(baseWidth) ? baseWidth : 140,
        textAlign: 'center',
      },
      offers3: {
        left: Number.isFinite(baseLeft) ? baseLeft : 10,
        width: Number.isFinite(baseWidth) ? baseWidth : 140,
        top: 60,
        textAlign: 'left',
        justifyContent: 'flex-start',
      },
    };
  }

  const side = Math.max(8, Math.round(width * 10 / 300));
  const left3 = Math.max(12, Math.round(width * 20 / 300));
  return {
    offers2: { left: side, width: width - side * 2, textAlign: 'center' },
    offers3: {
      left: left3,
      width: width - left3 - side,
      textAlign: 'left',
      justifyContent: 'flex-start',
      ...(Number.isFinite(baseTop) ? { top: baseTop } : {}),
    },
  };
};

const upsertHeadlineVariant = (sizeCreative, scope, props) => {
  sizeCreative.variantRules = sizeCreative.variantRules || [];
  const id = `${scope}|${HEADLINE_CSS_CLASS}`;
  const offerCount = scope === 'offers-2' ? 2 : 3;
  const existing = sizeCreative.variantRules.find((rule) => rule.id === id);
  if (existing) {
    existing.scope = scope;
    existing.cssClass = HEADLINE_CSS_CLASS;
    existing.when = { offer_count_num: offerCount };
    existing.props = { ...props };
    existing.editable = true;
    return;
  }
  sizeCreative.variantRules.push({
    id,
    scope,
    cssClass: HEADLINE_CSS_CLASS,
    when: { offer_count_num: offerCount },
    props: { ...props },
    editable: true,
  });
};

const stripManualHeadlineOfferCss = (manualCss) => {
  if (typeof manualCss !== 'string') return manualCss;
  return manualCss.replace(
    /\n\s*\.offers-2 \.sse-headline,[\s\S]*?text-align: center;\s*\}\s*/m,
    '\n',
  );
};

for (const [sizeKey, sizeCreative] of Object.entries(doc.sizes || {})) {
  const headlines = (sizeCreative.layers || []).filter((layer) => String(layer.id || '').startsWith('headline-act'));
  if (!headlines.length) continue;

  const variants = headlineOfferVariants(sizeKey, sizeCreative.canvas, headlineBaseline(sizeCreative));
  if (!variants) continue;

  upsertHeadlineVariant(sizeCreative, 'offers-2', variants.offers2);
  upsertHeadlineVariant(sizeCreative, 'offers-3', variants.offers3);
  sizeCreative.manualCss = stripManualHeadlineOfferCss(sizeCreative.manualCss);
}

fs.writeFileSync(docPath, `${JSON.stringify(doc, null, 2)}\n`);
