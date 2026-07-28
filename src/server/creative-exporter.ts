// @ts-nocheck
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import { compileAnimationClips } from '@/lib/creative-compiler';
import { structuredRuleCss } from '@/lib/creative-css';
import { clipsForProfile, headlineTransitionRuntimeBlock } from '@/lib/headline-motion';
import {
  CDN_FONT_URLS,
  MUSEO_FONT_FILENAME,
} from '@/lib/brand-font';
import {
  findCreativeTarget,
  HEADLINE_CSS_CLASS,
  isBackgroundLayer,
  isHeadlineLayer,
} from '@/lib/creative-model';
import { blurBackdropFilter, blurIsActive, isBlurLayer } from '@/lib/blur-layer';
import { gradientBackgroundImage, isGradientLayer } from '@/lib/gradient-layer';
import {
  CREATIVE_AD_SIZES,
  backgroundFieldsFromRow,
  backgroundImageFieldName,
  backgroundImageFieldDefinitions,
  imageFieldUrl,
  studioDevBackgroundUrl,
} from '@/lib/feed-background';
import { activeScopesFromControls, clampOfferCount, controlsFromFeedRow } from '@/lib/feed-model';
import { visibilityForLayer } from '@/lib/offer-interaction-model';
import { layoutOffersRuntime } from '@/lib/offer-layout';
import {
  OFFER_PLUS_LAYOUT_ATTR,
  resolveOfferPlusLayout,
} from '@/lib/offer-plus-layout';
import {
  alignOfferValueSymbolsRuntime,
  offerValueSymbolCss,
  wrapOfferValueSymbolRuntime,
} from '@/lib/offer-value-symbols';
import { applyOffers0BeatOverlay, beatsForFrameScope } from '@/lib/timing-profiles';
import { textFitEngineSource } from '@/lib/text-fit';
import { textFitRulesForSize } from '@/lib/text-fit-rules';
import type { PresentationSnapshots, SizePresentationSnapshot } from '@/lib/outline-snapshot';
import { getCampaign, listStaticPreviewCampaigns } from './campaign-registry';
import {
  bakeOutlinedOfferSlotSvgs,
  bakeOutlinedText,
  positionStyleAttr,
} from './outline-bake';
import { appRoot, outputRoot, outputsRoot, projectRoot } from './paths';

const DEFAULT_STATE = 'offers-1 tc-solo cta-roundel frames-3 roundel-frame-off roundel-copy-only';

/** Outline bake: use the editor snapshot as-is (direct WYSIWYG positions). */
const outlineSnapshotForDocument = (
  _document: Record<string, unknown>,
  snapshot: SizePresentationSnapshot | null | undefined,
) => snapshot || null;

export const exportSlugForDocument = (document: Record<string, unknown> = {}) => (
  getCampaign(document?.campaign?.id).exportSlug
);

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] || char));

const escapeAttr = escapeHtml;

const jsString = (value: unknown) => JSON.stringify(value);

type RenderMode = 'font' | 'outline';
/** `studio` keeps Enabler/DV360 shell. `static` is lean fixed-copy HTML (outline-only). */
export type DeliveryMode = 'studio' | 'static';

type RenderOptions = {
  assetBasePath?: string;
  assetUrlMap?: Record<string, string>;
  fontBasePath?: string;
  fontUrlMap?: Record<string, string>;
  includePackagedBackground?: boolean;
  includePreviewBridge?: boolean;
  includeStudioDynamicContent?: boolean;
  /**
   * Override Studio `devDynamicContent` background `.Url` values (per size).
   * Canonical/embed packages pass packaged relative paths so blank feed rows
   * do not fall back to the hiker CDN sample set.
   */
  studioBackgroundUrlForSize?: (size: string) => string;
  previewValidatorScriptPath?: string;
  /** `font` keeps Museo + live DOM text. `outline` bakes fixed-copy SVG paths and omits the OTF. */
  renderMode?: RenderMode;
  /** Outline shell: Studio Enabler vs lean static. Ignored for font mode. */
  delivery?: DeliveryMode;
  /**
   * Per-size editor presentation snapshot (fit size/tracking/align, plus/slot
   * positions). When set, outline bake is a pure snapshot — no second fit.
   */
  presentationSnapshot?: SizePresentationSnapshot | null;
};

type HtmlExportOptions = {
  renderMode?: RenderMode;
  delivery?: DeliveryMode;
  /** Editor snapshots keyed by size (`300x250`, …). */
  presentationSnapshots?: PresentationSnapshots;
};

type PackageEntry = {
  path: string;
  data: string | Buffer;
};

/** How agency/client packages resolve fonts and static assets. */
export type PackageAssetMode = 'packaged' | 'cdn' | 'embed' | 'canonical-agency';

type ClientPreviewPackageOptions = {
  includeValidator?: boolean;
  /** `cdn` matches Studio CDN base zips (fonts/SVGs from s0.2mdn.net). Default `packaged` keeps downloadable ZIPs self-contained. */
  assetMode?: PackageAssetMode;
  renderMode?: RenderMode;
  presentationSnapshots?: PresentationSnapshots;
};

type BasePackageOptions = {
  /**
   * `packaged` — fonts + SVGs in the ZIP (no bg JPEGs; Studio feed supplies them).
   * `cdn` — Museo + wave/logo SVGs from Studio CDN; plus inlined; no bg JPEGs.
   * `embed` (canonical) — `{size}.html` + `assets/` at zip root; SVGs inlined;
   *   Museo from CDN only; backgrounds as relative file refs (no other asset CDNs).
   * `canonical-agency` — agency `ads/{size}/index.html`; Museo CDN; SVGs inlined;
   *   backgrounds feed-only (empty src, no packaged JPEGs, no hiker CDN sample).
   */
  assetMode?: PackageAssetMode;
  renderMode?: RenderMode;
  presentationSnapshots?: PresentationSnapshots;
};

const clientFontSourcePath = (filename: string) => (
  path.resolve(projectRoot, 'assets/fonts', filename)
);

const resolveClientFontSourcePath = async (filename: string) => {
  const repoPath = path.resolve(projectRoot, 'assets/fonts', filename);
  try {
    await fs.access(repoPath);
    return repoPath;
  } catch {
    return path.resolve(/*turbopackIgnore: true*/ process.env.HOME || '', 'Library/Fonts', filename);
  }
};

const CLIENT_PREVIEW_BRAND_FILES = [
  { path: 'brand/BGlogo_SVG.svg', sourcePath: () => path.resolve(appRoot, 'public/BGlogo_SVG.svg') },
  { path: 'brand/SSELogoWhite.svg', sourcePath: () => path.resolve(appRoot, 'public/SSELogoWhite.svg') },
];

const PACKAGED_FONT_LOCAL_BLOCK = 'local("☺")';

const createClientFontEntry = (filename: string, families: string[], weight: number) => ({
  filename,
  families,
  weight,
  sourcePath: () => clientFontSourcePath(filename),
  resolveSourcePath: () => resolveClientFontSourcePath(filename),
});

// ── Brand font: Museo (slab). CDN URL lives in src/lib/brand-font.ts so the
// editor, /view renders, and CDN packages all load the same Studio file.
// Never alias "Museo" to MuseoSans_700.otf.
const CLIENT_FONT_FILES = [
  createClientFontEntry(MUSEO_FONT_FILENAME, ['Museo'], 700),
];

/** Offer plus — always read from campaign asset so CDN inline cannot drift. */
const SSE_PLUS_ASSET = 'assets/SVG/sse-plus.svg';
const SSE_PLUS_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  readFileSync(path.resolve(projectRoot, SSE_PLUS_ASSET), 'utf8'),
)}`;

const isSvgAssetPath = (assetPath: string) => /\.svg$/i.test(assetPath);

/** Adobe Animate–style inline: read campaign SVG into a data URI. */
const dataUriForSvgAsset = (assetPath: string) => {
  const abs = path.resolve(projectRoot, assetPath);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(readFileSync(abs, 'utf8'))}`;
};

const CDN_ASSET_URLS: Record<string, string> = {
  'assets/SVG/SSELogoBlue.svg': 'https://s0.2mdn.net/creatives/assets/5627651/SSELogoBlue.svg',
  'assets/SVG/SSELogoWhite.svg': 'https://s0.2mdn.net/creatives/assets/5627651/SSELogoWhite.svg',
  'assets/SVG/bluewave-wider.svg': 'https://s0.2mdn.net/creatives/assets/5627651/bluewave-wider.svg',
  'assets/SVG/bluewave.svg': 'https://s0.2mdn.net/creatives/assets/5627651/bluewave.svg',
  'assets/SVG/greenwave-wider.svg': 'https://s0.2mdn.net/creatives/assets/5627651/greenwave-wider.svg',
  'assets/SVG/greenwave.svg': 'https://s0.2mdn.net/creatives/assets/5627651/greenwave.svg',
  // Data URI — CDN/Pages packages need no extra Studio SVG upload.
  [SSE_PLUS_ASSET]: SSE_PLUS_DATA_URI,
};

/** Map every SVG used by the creative to an inlined data URI (embed packages). */
const buildEmbedSvgAssetUrlMap = (document: Record<string, unknown>) => {
  const map: Record<string, string> = {};
  for (const assetPath of collectClientAssetPaths(document)) {
    if (isSvgAssetPath(assetPath)) {
      map[assetPath] = dataUriForSvgAsset(assetPath);
    }
  }
  return map;
};

/** Flatten nested bg paths to `assets/<basename>` for static export packages. */
const flatAssetEntryPath = (assetPath: string) => `assets/${path.basename(assetPath)}`;

const buildFlatBackgroundAssetUrlMap = (document: Record<string, unknown>) => {
  const map: Record<string, string> = {};
  for (const assetPath of collectClientAssetPaths(document)) {
    if (!isSvgAssetPath(assetPath)) {
      map[assetPath] = flatAssetEntryPath(assetPath);
    }
  }
  return map;
};

const isStaticDelivery = (options: RenderOptions = {}) => (
  options.renderMode === 'outline' && options.delivery === 'static'
);

const documentHasZeroOffers = (document: Record<string, unknown> = {}) => (
  (document.feed?.sampleRows || []).some((sample: Record<string, unknown>) => (
    Number(sample.offer_count_num) === 0
  ))
);

const clientVariantMatrix = (document: Record<string, unknown> = {}) => {
  const offerCounts = documentHasZeroOffers(document) ? [0, 1, 2, 3] : [1, 2, 3];
  const rows = [];
  for (const offerCount of offerCounts) {
    const tcModes = offerCount === 0 ? ['tcs_only'] : ['tcs_only', 'tcs_units'];
    for (const tcMode of tcModes) {
      for (const ctaShape of ['roundel', 'rectangle']) {
        rows.push({ offerCount, tcMode, ctaShape });
      }
    }
  }
  return rows;
};

const clientVariantSlug = ({ offerCount, tcMode, ctaShape }: { offerCount: number; tcMode: string; ctaShape: string }) => (
  `offers-${offerCount}_${tcMode.replace(/_/g, '-')}_${ctaShape === 'rectangle' ? 'rectangle' : 'roundel'}`
);

const rowForClientVariant = (
  document: Record<string, unknown>,
  variant: { offerCount: number; tcMode: string; ctaShape: string },
) => {
  const samples = document.feed?.sampleRows || [];
  const matching = samples.find((sample: Record<string, unknown>) => (
    Number(sample.offer_count_num) === variant.offerCount
    && String(sample.tc_type_enum || '') === variant.tcMode
    && String(sample.cta_type_enum || '') === variant.ctaShape
  ));
  const offerMatch = samples.find((sample: Record<string, unknown>) => Number(sample.offer_count_num) === variant.offerCount);
  const fallback = samples[0] || {};
  return {
    ...fallback,
    ...(offerMatch || {}),
    ...(matching || {}),
    offer_count_num: variant.offerCount,
    tc_type_enum: variant.tcMode,
    cta_type_enum: variant.ctaShape,
    cta_text: matching?.cta_text || offerMatch?.cta_text || fallback.cta_text || 'Switch today',
    include_roundel_frame_bool: matching?.include_roundel_frame_bool ?? offerMatch?.include_roundel_frame_bool ?? fallback.include_roundel_frame_bool ?? false,
    roundel_text_text: matching?.roundel_text_text || offerMatch?.roundel_text_text || fallback.roundel_text_text || 'Save up to',
    roundel_value_text: matching?.roundel_value_text || offerMatch?.roundel_value_text || fallback.roundel_value_text || '',
    tc_terms_text: matching?.tc_terms_text || offerMatch?.tc_terms_text || fallback.tc_terms_text || '*T&Cs apply',
    tc_units_text: matching?.tc_units_text || offerMatch?.tc_units_text || fallback.tc_units_text || '',
    ...backgroundFieldsFromRow({
      ...fallback,
      ...(offerMatch || {}),
      ...(matching || {}),
    }),
  };
};

const clientInitialRow = (document: Record<string, unknown>) => {
  const fallback = document.feed?.sampleRows?.[0] || {};
  return {
    heading1_text: 'A different kind of energy',
    heading2_text: 'Our very best electricity plan',
    heading3_text: 'A different kind of energy',
    heading4_text: 'Switch and save today',
    offer_count_num: 1,
    offer1_value_text: '15%',
    offer1_sub_text: 'OFF ELECTRICITY*',
    offer2_value_text: '30%',
    offer2_sub_text: 'OFF GAS*',
    offer3_value_text: '100',
    offer3_sub_text: 'OFF BILL*',
    cta_type_enum: 'roundel',
    cta_text: 'Switch today',
    include_roundel_frame_bool: false,
    roundel_text_text: 'Save up to',
    roundel_value_text: '€1,080',
    tc_type_enum: 'tcs_only',
    tc_terms_text: '*T&Cs apply',
    tc_units_text: 'Electricity unit rate: 32.64 Inc. Vat 31.09 Ex. Vat',
    ...backgroundFieldsFromRow({}),
    ...fallback,
  };
};

const assetSrc = (src: unknown, options: RenderOptions = {}) => {
  const value = String(src ?? '');
  const mappedUrl = options.assetUrlMap?.[value.replace(/^\/+/, '')];
  if (mappedUrl) return mappedUrl;
  if (!options.assetBasePath || /^(?:https?:)?\/\//.test(value) || value.startsWith('/')) return value;
  return `${options.assetBasePath.replace(/\/?$/, '/')}${value.replace(/^\/+/, '')}`;
};

const fontUrl = (filename: string, options: RenderOptions = {}) => (
  options.fontUrlMap?.[filename]
    || `${String(options.fontBasePath || '').replace(/\/?$/, '/')}${filename}`
);

const localFontFaceCss = (options: RenderOptions = {}) => {
  if (!options.fontBasePath && !options.fontUrlMap) return '';
  // One face spans 100–900 so weight:400 T&Cs and weight:900 heavy copy both
  // resolve to Museo700-Regular.otf instead of browser-synthesised impostors.
  return CLIENT_FONT_FILES.flatMap((font) => font.families.map((family) => `    @font-face {
      font-family: "${family}";
      src: ${PACKAGED_FONT_LOCAL_BLOCK}, url("${fontUrl(font.filename, options)}") format("opentype");
      font-weight: 100 900;
      font-style: normal;
      font-display: block;
    }`)).join('\n');
};

const packagedFontPreloadTags = (options: RenderOptions = {}) => {
  if (!options.fontBasePath && !options.fontUrlMap) return '';
  const seen = new Set<string>();
  return CLIENT_FONT_FILES
    .map((font) => fontUrl(font.filename, options))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((url) => (
      `    <link rel="preload" href="${escapeAttr(url)}" as="font" type="font/otf" crossorigin>`
    ))
    .join('\n');
};

const packagedFontIsolationCss = () => `
    html,
    body,
    .stage,
    .stage * {
      font-synthesis: none;
      text-rendering: auto;
      -webkit-font-smoothing: auto;
      -moz-osx-font-smoothing: auto;
    }`;

const previewValidatorTag = (options: RenderOptions = {}) => (
  options.previewValidatorScriptPath
    ? `    <script src="${escapeAttr(options.previewValidatorScriptPath)}"></script>`
    : ''
);

const clientValidationFields = () => [
  { name: 'heading1_text', label: 'Heading 1' },
  { name: 'heading2_text', label: 'Heading 2' },
  { name: 'heading3_text', label: 'Heading 3' },
  { name: 'heading4_text', label: 'Heading 4' },
  { name: 'offer1_value_text', label: 'Offer 1 value' },
  { name: 'offer1_sub_text', label: 'Offer 1 subline' },
  { name: 'offer2_value_text', label: 'Offer 2 value' },
  { name: 'offer2_sub_text', label: 'Offer 2 subline' },
  { name: 'offer3_value_text', label: 'Offer 3 value' },
  { name: 'offer3_sub_text', label: 'Offer 3 subline' },
  { name: 'cta_text', label: 'CTA text' },
  { name: 'roundel_text_text', label: 'Roundel text' },
  { name: 'roundel_value_text', label: 'Roundel value' },
  { name: 'tc_terms_text', label: 'T&C text' },
  { name: 'tc_units_text', label: 'Unit price text' },
];

const dynamicFieldMapping = () => [
  ['heading1_text', 'text', '', 'Headline 1 copy'],
  ['heading2_text', 'text', '', 'Headline 2 copy'],
  ['heading3_text', 'text', '', 'Act 3 headline copy over the offer roundel'],
  ['heading4_text', 'text', '', 'Act 4 headline copy over the CTA/endframe'],
  ['offer_count_num', 'integer', '0-3', 'Visible offer count (0 = no offers)'],
  ['offer1_value_text', 'text', '', 'Offer 1 value'],
  ['offer1_sub_text', 'text', '', 'Offer 1 subline'],
  ['offer2_value_text', 'text', '', 'Offer 2 value'],
  ['offer2_sub_text', 'text', '', 'Offer 2 subline'],
  ['offer3_value_text', 'text', '', 'Offer 3 value'],
  ['offer3_sub_text', 'text', '', 'Offer 3 subline'],
  ['tc_type_enum', 'enum', 'tcs_only | tcs_units', 'Terms display mode'],
  ['tc_terms_text', 'text', '', 'Terms and conditions copy'],
  ['tc_units_text', 'text', '', 'Unit price copy'],
  ['cta_type_enum', 'enum', 'roundel | rectangle', 'CTA visual type; default roundel'],
  ['cta_text', 'text', '', 'CTA label'],
  ['include_roundel_frame_bool', 'boolean', 'true | false', 'Show optional roundel frame; false keeps the three-act timing'],
  ['roundel_text_text', 'text', '', 'Optional roundel frame copy'],
  ['roundel_value_text', 'text', '', 'Optional large roundel value'],
  ...backgroundImageFieldDefinitions().map((field) => [
    field.name,
    'image',
    '',
    field.description,
  ] as const),
];

const STUDIO_DEV_DYNAMIC_SCALAR_FIELDS = [
  '_id',
  'Unique_ID',
  'Reporting_label',
  'Active',
  'Default',
  'heading1_text',
  'heading2_text',
  'heading3_text',
  'heading4_text',
  'offer_count_num',
  'offer1_value_text',
  'offer1_sub_text',
  'offer2_value_text',
  'offer2_sub_text',
  'offer3_value_text',
  'offer3_sub_text',
  'tc_type_enum',
  'tc_terms_text',
  'tc_units_text',
  'cta_type_enum',
  'cta_text',
  'include_roundel_frame_bool',
  'roundel_text_text',
  'roundel_value_text',
] as const;

const studioDevDynamicLiteral = (fieldName: string, value: unknown) => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return jsString(String(value ?? ''));
};

export const renderStudioDynamicContentScript = (
  document: Record<string, unknown>,
  sampleRow: Record<string, unknown> = {},
  options: { backgroundUrlForSize?: (size: string) => string } = {},
) => {
  const profileId = Number(document.feed?.studioProfileId || 10960467);
  const profileElement = String(document.feed?.studioProfileElement || 'SSE_ROI_Delivery');
  const row = { ...(document.feed?.sampleRows?.[0] || {}), ...sampleRow };
  const lines = [
    '    <script type="text/javascript">',
    '      Enabler.setProfileId(' + profileId + ');',
    '      var devDynamicContent = {};',
    `      devDynamicContent.${profileElement} = [{}];`,
  ];

  for (const fieldName of STUDIO_DEV_DYNAMIC_SCALAR_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(row, fieldName)) continue;
    lines.push(
      `      devDynamicContent.${profileElement}[0].${fieldName} = ${studioDevDynamicLiteral(fieldName, row[fieldName])};`,
    );
  }

  for (const size of CREATIVE_AD_SIZES) {
    const fieldName = backgroundImageFieldName(size);
    const url = options.backgroundUrlForSize
      ? options.backgroundUrlForSize(size)
      : studioDevBackgroundUrl(size, row[fieldName] ?? row.background_image_url);
    lines.push(`      devDynamicContent.${profileElement}[0].${fieldName} = {};`);
    lines.push(`      devDynamicContent.${profileElement}[0].${fieldName}.Url = ${jsString(url)};`);
  }

  lines.push('      Enabler.setDevDynamicContent(devDynamicContent);');
  lines.push('    </script>');
  return lines.join('\n');
};

export const renderMappingTxt = () => [
  'SSE DCO dynamic field mapping',
  'Designed for Studio / GWD-style dynamic creative handoff.',
  '',
  'field_name\ttype\tallowed_values\tcreative_usage',
  ...dynamicFieldMapping().map((row) => row.map((value) => String(value || '')).join('\t')),
  '',
].join('\n');

const px = (value: unknown) => `${Number(value)}px`;

const camelToKebab = (value: string) => value.replace(/([A-Z])/g, '-$1').toLowerCase();

const cssValue = (value: unknown, unit = '') => {
  if (!unit) return value;
  if (typeof value === 'string' && /[a-z%)]$/i.test(value.trim())) return value;
  return `${value}${unit}`;
};

const cssDecl = (prop: string, value: unknown, unit = '') => (
  value === undefined || value === null || value === ''
    ? ''
    : `      ${prop}: ${cssValue(value, unit)};`
);

const formatTransform = (keyframe: Record<string, unknown>) => {
  const parts = [];
  if (keyframe.translate) parts.push(`translate3d(${px(keyframe.translate[0])}, ${px(keyframe.translate[1])}, 0px)`);
  if (keyframe.scale !== undefined) parts.push(`scale3d(${keyframe.scale}, ${keyframe.scale}, 1)`);
  return parts.length ? parts.join(' ') : null;
};

const renderKeyframes = (name: string, keyframes: Array<Record<string, unknown>>) => `    @keyframes ${name} {
${keyframes.map((keyframe) => {
    const transform = formatTransform(keyframe);
    return `      ${keyframe.at}% {
${[
        transform ? `        transform: ${transform};` : '',
        keyframe.opacity !== undefined ? `        opacity: ${keyframe.opacity};` : '',
        keyframe.easing ? `        animation-timing-function: ${keyframe.easing};` : '',
      ].filter(Boolean).join('\n')}
      }`;
  }).join('\n')}
    }`;

const layerClipsForProfile = (
  layer: Record<string, unknown>,
  profile = 'frames-3',
) => clipsForProfile(layer.clips, profile);

const staticRuleForLayer = (
  layer: Record<string, unknown>,
  beats: Record<string, number>,
  options: { profile?: string; selectorPrefix?: string } = {},
) => {
  // Gradients are static (no clips). Scoped re-emits under `.offers-0` would
  // restate base `visibility: hidden` and override the offers-0 show rule.
  if (isGradientLayer(layer) && options.selectorPrefix) return '';
  const profile = options.profile || 'frames-3';
  const clips = isBlurLayer(layer) && !blurIsActive(layer.blur)
    ? []
    : layerClipsForProfile(layer, profile);
  const firstKeyframe = clips.length ? compileAnimationClips(clips, beats)[0] : null;
  if (isHeadlineLayer(layer)) {
    const initialTransform = firstKeyframe ? formatTransform(firstKeyframe) : null;
    const declarations = [];
    if (initialTransform) declarations.push(`      transform: ${initialTransform};`);
    if (firstKeyframe?.opacity !== undefined) declarations.push(`      opacity: ${firstKeyframe.opacity};`);
    if (!declarations.length) return '';
    return `    ${options.selectorPrefix || ''}#${layer.id} {
${declarations.join('\n')}
    }`;
  }
  // Frame lives on the shared .bg-image classRule; avoid an empty layer override.
  if (isBackgroundLayer(layer)) return '';
  const base = layer.base || {};
  const cssClass = base.cssClass || layer.id;
  const initialTransform = firstKeyframe ? formatTransform(firstKeyframe) : null;
  const declarations = [
    cssDecl('left', base.left, 'px'),
    cssDecl('top', base.top, 'px'),
    cssDecl('bottom', base.bottom, 'px'),
    cssDecl('width', base.width, 'px'),
    cssDecl('height', base.height, 'px'),
    cssDecl('font-size', base.fontSize, 'px'),
  ];
  for (const [key, value] of Object.entries(base)) {
    if (['left', 'top', 'bottom', 'width', 'height', 'fontSize', 'cssClass'].includes(key)) continue;
    declarations.push(cssDecl(camelToKebab(key), value));
  }
  if (isGradientLayer(layer)) {
    const backgroundImage = gradientBackgroundImage(layer.gradient || {});
    if (backgroundImage) declarations.push(cssDecl('background-image', backgroundImage));
  }
  if (isBlurLayer(layer)) {
    const filter = blurBackdropFilter(layer.blur || {});
    declarations.push(cssDecl('backdrop-filter', filter));
    declarations.push(cssDecl('-webkit-backdrop-filter', filter));
    declarations.push(cssDecl('background-color', 'rgba(255, 255, 255, 0.01)'));
  }
  if (initialTransform) declarations.push(`      transform: ${initialTransform};`);
  if (isBlurLayer(layer) && !blurIsActive(layer.blur)) {
    declarations.push(cssDecl('opacity', 0));
  } else if (firstKeyframe?.opacity !== undefined) {
    declarations.push(`      opacity: ${firstKeyframe.opacity};`);
  }
  declarations.push('      position: absolute;');
  // Gradient/blur author visibility on base; other layers inherit stage visibility.
  if (!isGradientLayer(layer) && !isBlurLayer(layer)) declarations.push('      visibility: inherit;');
  return `    .${cssClass} {
${declarations.filter(Boolean).join('\n')}
    }`;
};

const animationNameForLayer = (layer: Record<string, unknown>, suffix = '') => `${layer.id}-${layer.clips[0].id}${suffix ? `-${suffix}` : ''}`;

const animationCssForLayer = (
  layer: Record<string, unknown>,
  beats: Record<string, number>,
  durationS: number,
  options: { suffix?: string; selectorPrefix?: string; profile?: string } = {},
) => {
  const profile = options.profile || 'frames-3';
  if (isBlurLayer(layer) && !blurIsActive(layer.blur)) return '';
  const clips = layerClipsForProfile(layer, profile);
  if (!clips.length) return '';
  const name = animationNameForLayer({ ...layer, clips }, options.suffix || '');
  const keyframes = compileAnimationClips(clips, beats);
  const cssClass = layer.base?.cssClass || layer.id;
  const selector = isHeadlineLayer(layer)
    ? `${options.selectorPrefix || ''}#${layer.id}`
    : `${options.selectorPrefix || ''}.${cssClass}`;
  return `${renderKeyframes(name, keyframes)}
    ${selector} {
      animation: ${durationS}s linear 0s 1 normal forwards running ${name};
    }`;
};

const dcoFieldForLayer = (layer: Record<string, unknown>) => {
  if (layer.binding?.field) return String(layer.binding.field);
  const id = String(layer.id || '');
  if (id === 'headline-act1') return 'heading1_text';
  if (id === 'headline-act2') return 'heading2_text';
  if (id === 'headline-act3') return 'heading3_text';
  if (id === 'headline-act4') return 'heading4_text';
  if (id === 'cta') return 'cta_text';
  if (id === 'plus-1' || id === 'plus-2') return '';
  return '';
};

const renderOfferSlot = (layer: Record<string, unknown>) => {
  const cssClass = layer.base?.cssClass || layer.id;
  const index = String(layer.id).match(/(\d)$/)?.[1] || '1';
  return `          <div class="stage-element ${cssClass}" data-gwd-group="OfferSlot" data-offer-index="${index}" id="offer${index}">
            <p class="gwd-grp-offer offer-value" data-dco-field="offer${index}_value_text"></p>
            <p class="gwd-grp-offer offer-subline" data-dco-field="offer${index}_sub_text"></p>
          </div>`;
};

const sampleRowForDocument = (document: Record<string, unknown>) => (
  (document.feed?.sampleRows || []).find((row: Record<string, unknown>) => row.Default)
  || document.feed?.sampleRows?.[0]
  || {}
);

const textForLayerFromRow = (layerId: string, row: Record<string, unknown>) => {
  if (layerId === 'headline-act1') return String(row.heading1_text || '');
  if (layerId === 'headline-act2') return String(row.heading2_text || '');
  if (layerId === 'headline-act3') return String(row.heading3_text || '');
  if (layerId === 'headline-act4') return String(row.heading4_text || '');
  if (layerId === 'cta') return String(row.cta_text || '');
  if (layerId === 'terms-prices' || layerId === 'terms-solo') return String(row.tc_terms_text || '');
  if (layerId === 'unit-rate-prices') return String(row.tc_units_text || '');
  if (layerId === 'roundel-copy') return String(row.roundel_text_text || '');
  if (layerId === 'roundel-value') return String(row.roundel_value_text || '');
  return '';
};

const outlinedSvgMarkup = async ({
  document,
  size,
  targetId,
  text,
  activeScopes,
  fallbackFit = {},
  snapshot = null,
}: {
  document: Record<string, unknown>;
  size: string;
  targetId: string;
  text: string;
  activeScopes: string[];
  fallbackFit?: Record<string, unknown>;
  snapshot?: SizePresentationSnapshot | null;
}) => {
  const outlined = await bakeOutlinedText({
    document,
    size,
    targetId,
    text,
    activeScopes,
    fallbackFit,
    snapshot,
  });
  return outlined.svg;
};

const renderOutlinedOfferSlot = (
  layer: Record<string, unknown>,
  baked: { valueSvg: string; subSvg: string },
  snapshot: SizePresentationSnapshot | null | undefined,
) => {
  const cssClass = layer.base?.cssClass || layer.id;
  const index = String(layer.id).match(/(\d)$/)?.[1] || '1';
  const slotStyle = positionStyleAttr(
    snapshot,
    String(layer.id),
    `offer-slot-${index}`,
    `offer${index}`,
  );
  const valueStyle = positionStyleAttr(
    snapshot,
    `${layer.id}::offer-value`,
    `offer-slot-${index}::offer-value`,
    `offer${index}::offer-value`,
  );
  const subStyle = positionStyleAttr(
    snapshot,
    `${layer.id}::offer-subline`,
    `offer-slot-${index}::offer-subline`,
    `offer${index}::offer-subline`,
  );
  // Keep data-gwd-group / gwd-grp-* — manualCss and structured rules key off them.
  return `          <div class="stage-element ${cssClass}" data-gwd-group="OfferSlot" id="offer${index}"${slotStyle}>
            <div class="gwd-grp-offer offer-value outlined-text"${valueStyle}>${baked.valueSvg}</div>
            <div class="gwd-grp-offer offer-subline outlined-text"${subStyle}>${baked.subSvg}</div>
          </div>`;
};

const renderOutlinedLayer = async (
  document: Record<string, unknown>,
  size: string,
  layer: Record<string, unknown>,
  row: Record<string, unknown>,
  activeScopes: string[],
  options: RenderOptions = {},
  offerBakes: Record<string, { valueSvg: string; subSvg: string }> = {},
) => {
  const cssClass = isHeadlineLayer(layer)
    ? HEADLINE_CSS_CLASS
    : (layer.base?.cssClass || layer.id);
  if (layer.id === 'terms-solo') return '';
  if (
    isStaticDelivery(options)
    && visibilityForLayer(document, size, String(layer.id), activeScopes) === 'hidden'
  ) {
    return '';
  }
  if (layer.id.startsWith('offer-slot-')) {
    const baked = offerBakes[String(layer.id)] || { valueSvg: '', subSvg: '' };
    return renderOutlinedOfferSlot(layer, baked, options.presentationSnapshot);
  }
  const positionAttr = positionStyleAttr(options.presentationSnapshot, String(layer.id));
  if (layer.kind === 'image') {
    return `          <img alt="" draggable="false" class="stage-element ${cssClass}" id="${escapeAttr(layer.id)}" src="${escapeAttr(assetSrc(layer.asset, options))}"${positionAttr}>`;
  }
  if (isGradientLayer(layer) || isBlurLayer(layer)) {
    return `          <div class="stage-element ${cssClass}" id="${escapeAttr(layer.id)}"${positionAttr}></div>`;
  }
  const text = textForLayerFromRow(String(layer.id), row);
  const svg = await outlinedSvgMarkup({
    document,
    size,
    targetId: String(layer.id),
    text,
    activeScopes,
    fallbackFit: layer.fit || {},
    snapshot: options.presentationSnapshot,
  });
  const className = [
    'stage-element',
    'outlined-text',
    /headline/.test(layer.id) ? 'sse-text sse-text-bold' : '',
    /terms|unit-rate/.test(layer.id) ? 'sse-text sse-bottom-line' : '',
    cssClass,
  ].filter(Boolean).join(' ');
  const layerIdAttr = isStaticDelivery(options) ? '' : ` data-layer-id="${escapeAttr(layer.id)}"`;
  return `          <div class="${className}" id="${escapeAttr(layer.id)}"${layerIdAttr}${positionAttr}>${svg}</div>`;
};

const renderLayer = (layer: Record<string, unknown>, options: RenderOptions = {}) => {
  const cssClass = isHeadlineLayer(layer)
    ? HEADLINE_CSS_CLASS
    : (layer.base?.cssClass || layer.id);
  if (layer.id === 'terms-solo') return '';
  if (layer.id.startsWith('offer-slot-')) return renderOfferSlot(layer);
  if (layer.kind === 'image') {
    return `          <img alt="" draggable="false" class="stage-element ${cssClass}" id="${escapeAttr(layer.id)}" src="${escapeAttr(assetSrc(layer.asset, options))}">`;
  }
  if (isGradientLayer(layer) || isBlurLayer(layer)) {
    return `          <div class="stage-element ${cssClass}" id="${escapeAttr(layer.id)}" data-layer-id="${escapeAttr(layer.id)}"></div>`;
  }
  const tag = layer.id === 'cta' ? 'div' : 'p';
  const className = [
    'stage-element',
    /headline/.test(layer.id) ? 'sse-text sse-text-bold' : '',
    /terms|unit-rate/.test(layer.id) ? 'sse-text sse-bottom-line' : '',
    cssClass,
  ].filter(Boolean).join(' ');
  const dcoField = dcoFieldForLayer(layer);
  const dcoAttr = dcoField ? ` data-dco-field="${escapeAttr(dcoField)}"` : '';
  return `          <${tag} class="${className}" id="${escapeAttr(layer.id)}" data-layer-id="${escapeAttr(layer.id)}"${dcoAttr}></${tag}>`;
};

const termsLayer = (sizeCreative: Record<string, unknown>, id: string) => (
  sizeCreative.layers.find((layer: Record<string, unknown>) => layer.id === id)
);

const renderTermsWrappers = (sizeCreative: Record<string, unknown>) => {
  // terms-prices + unit-rate-prices render as normal canvas layers.
  // Only the solo T&Cs line still uses a dedicated wrapper.
  const solo = termsLayer(sizeCreative, 'terms-solo');
  return `          <div class="stage-static tc-solo-group" data-gwd-group="tc_solo" id="TC_Solo">
            <p class="gwd-grp-tc sse-text sse-bottom-line ${solo?.base?.cssClass || 'terms-solo'}" data-dco-field="tc_terms_text"></p>
          </div>`;
};

const renderOutlinedTermsWrappers = async (
  document: Record<string, unknown>,
  size: string,
  row: Record<string, unknown>,
  activeScopes: string[],
  options: RenderOptions = {},
) => {
  if (
    isStaticDelivery(options)
    && visibilityForLayer(document, size, 'terms-solo', activeScopes) === 'hidden'
  ) {
    return '';
  }
  const sizeCreative = document.sizes[size];
  const solo = termsLayer(sizeCreative, 'terms-solo');
  const svg = await outlinedSvgMarkup({
    document,
    size,
    targetId: 'terms-solo',
    text: String(row.tc_terms_text || ''),
    activeScopes,
    snapshot: options.presentationSnapshot,
  });
  return `          <div class="stage-static tc-solo-group" data-gwd-group="tc_solo" id="TC_Solo">
            <div class="gwd-grp-tc sse-text sse-bottom-line outlined-text ${solo?.base?.cssClass || 'terms-solo'}">${svg}</div>
          </div>`;
};

/** Default landing URL for static (non-Enabler) HTML5 clickTag. */
export const DEFAULT_STATIC_CLICK_TAG = 'https://www.sseairtricity.com/uk';

const outlineRuntimeScript = (delivery: DeliveryMode = 'studio') => {
  if (delivery === 'static') {
    return `
    <script>
      (function() {
        var MOTION_START_TIMEOUT_MS = 3000;
        var motionReleased = false;
        var clickTag = ${JSON.stringify(DEFAULT_STATIC_CLICK_TAG)};
        window.clickTag = clickTag;
        function releaseMotionClock() {
          if (motionReleased) return;
          var root = document.getElementById('page-content');
          if (!root) return;
          motionReleased = true;
          root.classList.add('motion-ready');
        }
        function wireClickTag() {
          var root = document.getElementById('page-content');
          if (!root) return;
          root.addEventListener('click', function() {
            window.open(clickTag, '_blank');
          });
        }
        function boot() {
          wireClickTag();
          window.requestAnimationFrame(function() {
            window.requestAnimationFrame(releaseMotionClock);
          });
          window.setTimeout(releaseMotionClock, MOTION_START_TIMEOUT_MS);
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', boot);
        } else {
          boot();
        }
      })();
    </script>
`;
  }
  return `
    <script>
      (function() {
        // Same .motion-ready gate as font exports (CSS pauses animations until
        // the class is present). Outline has no Museo load to wait on — release
        // on the next frames so first paint stays at 0%, then the clock runs.
        var MOTION_START_TIMEOUT_MS = 3000;
        var motionReleased = false;

        function releaseMotionClock() {
          if (motionReleased) return;
          var root = document.getElementById('page-content');
          if (!root) return;
          motionReleased = true;
          root.classList.add('motion-ready');
        }

        function wireExit() {
          var root = document.getElementById('page-content');
          if (!root) return;
          root.addEventListener('click', function() {
            if (typeof Enabler !== 'undefined' && Enabler.exit) {
              Enabler.exit('Main Exit');
            }
          }, { once: true });
        }

        function boot() {
          wireExit();
          window.requestAnimationFrame(function() {
            window.requestAnimationFrame(releaseMotionClock);
          });
          window.setTimeout(releaseMotionClock, MOTION_START_TIMEOUT_MS);
          window.__SSE_DCO_READY__ = true;
        }

        if (typeof Enabler !== 'undefined' && Enabler.addEventListener && typeof studio !== 'undefined' && studio.events) {
          if (Enabler.isInitialized && Enabler.isInitialized()) {
            boot();
          } else {
            Enabler.addEventListener(studio.events.StudioEvent.INIT, boot);
          }
        } else if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', boot);
        } else {
          boot();
        }
      })();
    </script>
`;
};

const outlinedTextCss = `
    .outlined-text {
      overflow: visible;
    }
    /* Intrinsic SVG size = baked CSS line boxes (true font-size + half-leading).
       Do not stretch with width:100% — that scaled paths down inside padded CTA
       content boxes (~15px → ~10.8px when padding:0 18px). Flex hosts still centre. */
    .outlined-text svg {
      display: block;
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
      overflow: visible;
      pointer-events: none;
      flex: 0 0 auto;
    }
    /* Font-mode CTA padding is for live text wrap inside the box. Outlined SVG
       is already baked to the full authored width — zero padding so glyphs stay
       at designed size. */
    .cta.outlined-text {
      padding: 0;
    }
`;

const stateClasses = (row: Record<string, unknown>) => {
  const count = clampOfferCount(row.offer_count_num);
  const tc = count === 0 || row.tc_type_enum !== 'tcs_units' ? 'tc-solo' : 'tc-prices';
  const includeRoundel = row.include_roundel_frame_bool === true
    || row.include_roundel_frame === true
    || ['true', '1', 'yes', 'on'].includes(String(row.include_roundel_frame_bool || row.include_roundel_frame || '').trim().toLowerCase());
  const cta = includeRoundel || ['rectangle', 'rect'].includes(String(row.cta_type_enum || '')) ? 'cta-rect' : 'cta-roundel';
  const frame = includeRoundel ? 'frames-4' : 'frames-3';
  const roundelFrame = includeRoundel ? 'roundel-frame-on' : 'roundel-frame-off';
  const roundelMode = includeRoundel && String(row.roundel_value_text || '').trim() ? 'roundel-split' : 'roundel-copy-only';
  return `offers-${count} ${tc} ${cta} ${frame} ${roundelFrame} ${roundelMode}`;
};

const runtimeScript = (
  fitRules: Array<Record<string, unknown>> = [],
  options: RenderOptions = {},
  headlineRuntime: { layers?: Array<Record<string, unknown>>; beatsProfiles?: Record<string, Record<string, number>>; durationS?: number } = {},
) => {
  const includePreviewBridge = options.includePreviewBridge !== false;
  const previewRowFallback = includePreviewBridge
    ? `
          // Local QA only: *_WIP_*.html and Preview bake window.__SSE_DCO_PREVIEW__.
          if (window.__SSE_DCO_PREVIEW__) return window.__SSE_DCO_PREVIEW__;`
    : '';
  const previewMessageBridge = includePreviewBridge
    ? `
        window.addEventListener('message', function(event) {
          if (!event.data || event.data.type !== 'SSE_DCO_PREVIEW_STATE') return;
          if (!event.data.row) return;
          applyRuntimeState(event.data.row);
        });`
    : '';
  return `
    <script>
      (function() {
        var root = null;
        var textFitRules = ${JSON.stringify(fitRules)};

        function fieldValue(value) {
          if (value === undefined || value === null) return '';
          return String(value);
        }

        function imageFieldValue(value) {
          if (value && typeof value === 'object' && value.Url !== undefined) {
            return String(value.Url || '');
          }
          return fieldValue(value);
        }

        function backgroundFieldNameForSize(size) {
          return 'background_image_url_' + size;
        }

        function backgroundImageUrlForSize(data, size) {
          var sized = imageFieldValue(data[backgroundFieldNameForSize(size)]);
          if (sized) return sized;
          return imageFieldValue(data.background_image_url);
        }

        function normalizeProfileRow(row) {
          row = row || {};
          var out = {};
          [
            'heading1_text', 'heading2_text', 'heading3_text', 'heading4_text',
            'offer_count_num',
            'offer1_value_text', 'offer1_sub_text',
            'offer2_value_text', 'offer2_sub_text',
            'offer3_value_text', 'offer3_sub_text',
            'tc_type_enum', 'tc_terms_text', 'tc_units_text',
            'cta_type_enum', 'cta_text',
            'include_roundel_frame_bool', 'include_roundel_frame',
            'roundel_text_text', 'roundel_value_text'
          ].forEach(function(key) {
            out[key] = fieldValue(row[key]);
          });
          out.background_image_url = imageFieldValue(row.background_image_url);
          ${JSON.stringify(CREATIVE_AD_SIZES)}.forEach(function(size) {
            out[backgroundFieldNameForSize(size)] = imageFieldValue(row[backgroundFieldNameForSize(size)]);
          });
          return out;
        }

        function deriveOfferCount(data) {
          var explicit = parseInt(data.offer_count_num, 10);
          if (explicit === 0 || (explicit >= 1 && explicit <= 3)) return explicit;
          return [data.offer1_value_text, data.offer2_value_text, data.offer3_value_text].filter(function(value) {
            return value && value.trim();
          }).length || 1;
        }

        function booleanValue(value) {
          var normalized = fieldValue(value).trim().toLowerCase();
          return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
        }

        function setText(selector, value) {
          var text = fieldValue(value);
          document.querySelectorAll(selector).forEach(function(element) {
            element.textContent = text;
          });
        }

        ${wrapOfferValueSymbolRuntime}
        ${headlineTransitionRuntimeBlock(
          headlineRuntime.layers || [],
          headlineRuntime.beatsProfiles || {},
          headlineRuntime.durationS || 15,
        )}

        function bindOfferTexts(data) {
          for (var index = 1; index <= 3; index += 1) {
            var slot = document.getElementById('offer' + index);
            if (!slot) continue;
            var value = slot.querySelector('.offer-value');
            var subline = slot.querySelector('.offer-subline');
            if (value) {
              value.textContent = data['offer' + index + '_value_text'] || '';
              wrapOfferValueSymbol(value);
            }
            if (subline) subline.textContent = data['offer' + index + '_sub_text'] || '';
          }
        }

        // Shared fit engine — the exact same code the editor preview runs.
        // Source of truth: src/lib/text-fit.ts (rules: src/lib/text-fit-rules.ts).
        var textFitEngine = ${textFitEngineSource()}(window);

        function fitBoundText() {
          if (!root) return;
          textFitEngine.applyRules(root, textFitRules);
        }

        function commitOfferLayout() {
          if (!root) return;
          fitBoundText();
          alignOfferValueSymbols(root);
          layoutOffers(root);
        }

        // Cold CDN Museo must settle before the 15s clock runs. Pausing via
        // .motion-ready keeps keyframes at 0% until fonts.ready → layout → play,
        // so first impression matches warm Replay. Timeout avoids a hung font
        // load freezing the unit forever.
        var motionStartScheduled = false;
        var MOTION_START_TIMEOUT_MS = 3000;

        function releaseMotionClock() {
          if (!root || root.classList.contains('motion-ready')) return;
          root.classList.add('motion-ready');
        }

        function startMotionWhenReady() {
          if (motionStartScheduled) return;
          motionStartScheduled = true;
          var finished = false;
          var finish = function() {
            if (finished) return;
            finished = true;
            window.requestAnimationFrame(function() {
              commitOfferLayout();
              window.requestAnimationFrame(releaseMotionClock);
            });
          };
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(finish).catch(finish);
          } else {
            finish();
          }
          window.setTimeout(finish, MOTION_START_TIMEOUT_MS);
        }

        ${alignOfferValueSymbolsRuntime}
        ${layoutOffersRuntime}

        function wireExit() {
          root.addEventListener('click', function() {
            if (typeof Enabler !== 'undefined' && Enabler.exit) {
              Enabler.exit('Main Exit');
            }
          }, { once: true });
        }

        function applyBackgroundImage(data) {
          var image = document.getElementById('bg-image');
          if (!image || !root) return;
          var size = root.getAttribute('data-size') || '';
          var url = backgroundImageUrlForSize(data, size);
          if (!url || url === '[object Object]') {
            url = image.getAttribute('data-packaged-src') || image.getAttribute('src') || '';
          }
          if (!url || url === '[object Object]') return;
          image.setAttribute('src', url);
        }

        function applyRuntimeState(row) {
          root = root || document.getElementById('page-content');
          if (!root) return;
          var data = normalizeProfileRow(row);
          var includeRoundel = booleanValue(data.include_roundel_frame_bool)
            || booleanValue(data.include_roundel_frame);
          root.classList.remove(
            'offers-0', 'offers-1', 'offers-2', 'offers-3',
            'tc-solo', 'tc-prices',
            'cta-roundel', 'cta-rect',
            'frames-3', 'frames-4',
            'roundel-frame-off', 'roundel-frame-on',
            'roundel-copy-only', 'roundel-split'
          );
          var offerCount = deriveOfferCount(data);
          root.classList.add('offers-' + offerCount);
          root.classList.add(offerCount === 0 || data.tc_type_enum !== 'tcs_units' ? 'tc-solo' : 'tc-prices');
          root.classList.add(includeRoundel || data.cta_type_enum === 'rectangle' || data.cta_type_enum === 'rect' ? 'cta-rect' : 'cta-roundel');
          root.classList.add(includeRoundel ? 'frames-4' : 'frames-3');
          root.classList.add(includeRoundel ? 'roundel-frame-on' : 'roundel-frame-off');
          root.classList.add(includeRoundel && data.roundel_value_text.trim() ? 'roundel-split' : 'roundel-copy-only');
          setText('#headline-act1', data.heading1_text);
          setText('#headline-act2', data.heading2_text);
          setText('#headline-act3', data.heading3_text);
          setText('#headline-act4', __headlineAct4DisplayText(data, includeRoundel));
          applyHeadlineTransitionSkips(data, includeRoundel);
          setText('#cta', data.cta_text);
          setText('.roundel-copy', data.roundel_text_text);
          setText('.roundel-value', data.roundel_value_text);
          setText('.terms-prices, .terms-solo', data.tc_terms_text);
          setText('.unit-rate-prices', data.tc_units_text);
          applyBackgroundImage(data);
          bindOfferTexts(data);
          // Immediate layout for feed swaps after motion has started; cold boot
          // still holds the clock until startMotionWhenReady releases it.
          commitOfferLayout();
          wireExit();
          startMotionWhenReady();
          window.__SSE_DCO_READY__ = true;
        }

        function firstDynamicRow() {
          // Studio / DV360 inject profile rows at serve time via window.dynamicContent.
${previewRowFallback}
          if (window.dynamicContent) {
            for (var key in window.dynamicContent) {
              var value = window.dynamicContent[key];
              if (Array.isArray(value) && value[0]) return value[0];
              if (value && typeof value === 'object') return value;
            }
          }
          return {};
        }

        window.applyRuntimeState = applyRuntimeState;
        window.applySseDcoRuntimeState = applyRuntimeState;
${previewMessageBridge}
${includePreviewBridge ? `
        function hasBootstrapRow(row) {
          if (window.__SSE_DCO_PREVIEW__) return true;
          if (window.dynamicContent) return true;
          if (!row || typeof row !== 'object') return false;
          return [
            'heading1_text', 'heading2_text', 'heading3_text', 'heading4_text',
            'offer1_value_text', 'offer2_value_text', 'offer3_value_text',
            'cta_text', 'roundel_text_text', 'roundel_value_text'
          ].some(function(key) {
            return fieldValue(row[key]).trim();
          });
        }` : ''}
        function bootstrapRuntime() {
          var row = firstDynamicRow();
${includePreviewBridge ? `
          if (!hasBootstrapRow(row)) return;` : ''}
          applyRuntimeState(row);
        }

        function scheduleRuntimeBootstrap() {
${includePreviewBridge ? `
          // Client preview iframes receive feed rows via postMessage; do not wait for
          // Enabler INIT (which would bootstrap with an empty row and wipe preview text).
          bootstrapRuntime();
          return;` : `
          if (typeof Enabler !== 'undefined' && Enabler.addEventListener && typeof studio !== 'undefined' && studio.events) {
            if (Enabler.isInitialized && Enabler.isInitialized()) {
              bootstrapRuntime();
            } else {
              Enabler.addEventListener(studio.events.StudioEvent.INIT, bootstrapRuntime);
            }
            return;
          }`}
          bootstrapRuntime();
        }

        window.addEventListener('DOMContentLoaded', scheduleRuntimeBootstrap);
      })();
    </script>`;
};

const cssForSize = (document: Record<string, unknown>, size: string, options: RenderOptions = {}) => {
  const sizeCreative = document.sizes[size];
  const duration = document.clock.durationS;
  const defaultBeats = beatsForFrameScope(document, 'frames-3');
  const layerCss = sizeCreative.layers.map((layer) => staticRuleForLayer(layer, defaultBeats)).join('\n\n');
  const defaultAnimationCss = sizeCreative.layers
    .map((layer) => animationCssForLayer(layer, defaultBeats, duration))
    .filter(Boolean)
    .join('\n\n');
  // Static frames-3 bakes skip unused frames-4 profile CSS; frames-4 still needs
  // the default rules plus `.frames-4` overrides.
  const bakedFrameScope = isStaticDelivery(options)
    ? (stateClasses(sampleRowForDocument(document)).includes('frames-4') ? 'frames-4' : 'frames-3')
    : null;
  const profileScopes = ['frames-4'].filter((scope) => (
    document.clock?.profiles?.[scope]
    && (!bakedFrameScope || bakedFrameScope === scope)
  ));
  const profileAnimationCss = profileScopes
    .flatMap((scope) => {
      const beats = beatsForFrameScope(document, scope);
      return sizeCreative.layers
        .map((layer) => animationCssForLayer(layer, beats, duration, {
          suffix: scope,
          selectorPrefix: `.${scope} `,
          profile: scope,
        }))
        .filter(Boolean);
    })
    .join('\n\n');
  const profileStaticCss = profileScopes
    .flatMap((scope) => {
      const beats = beatsForFrameScope(document, scope);
      return sizeCreative.layers
        .map((layer) => staticRuleForLayer(layer, beats, {
          profile: scope,
          selectorPrefix: `.${scope} `,
        }))
        .filter(Boolean);
    })
    .join('\n\n');
  // Zero-offers remaps blue-wave / logo / early headline beats; emit scoped
  // animation overrides so exported HTML matches editor preview.
  const offers0Scopes = documentHasZeroOffers(document)
    ? [
      { suffix: 'offers-0', selectorPrefix: '.offers-0 ', profile: 'frames-3', beats: applyOffers0BeatOverlay(beatsForFrameScope(document, 'frames-3')) },
      { suffix: 'offers-0-frames-4', selectorPrefix: '.offers-0.frames-4 ', profile: 'frames-4', beats: applyOffers0BeatOverlay(beatsForFrameScope(document, 'frames-4')) },
    ].filter((item) => !bakedFrameScope || bakedFrameScope === item.profile)
    : [];
  const offers0AnimationCss = offers0Scopes
    .flatMap((item) => sizeCreative.layers
      .map((layer) => animationCssForLayer(layer, item.beats, duration, {
        suffix: item.suffix,
        selectorPrefix: item.selectorPrefix,
        profile: item.profile,
      }))
      .filter(Boolean))
    .join('\n\n');
  const offers0StaticCss = offers0Scopes
    .flatMap((item) => sizeCreative.layers
      .map((layer) => staticRuleForLayer(layer, item.beats, {
        profile: item.profile,
        selectorPrefix: item.selectorPrefix,
      }))
      .filter(Boolean))
    .join('\n\n');
  return `
${localFontFaceCss(options)}
${options.renderMode === 'outline' ? '' : packagedFontIsolationCss()}
${options.renderMode === 'outline' ? outlinedTextCss : ''}
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
    }
    p, h1, h2, h3 {
      margin: 0px;
    }
    body {
      overflow: hidden;
      background: #fff;
    }
    .stage {
      position: relative;
      overflow: hidden;
      width: ${sizeCreative.canvas.width}px;
      height: ${sizeCreative.canvas.height}px;
      transform-style: preserve-3d;
      background: transparent;
    }
    /* Hold the motion clock at t=0 until fonts + offer layout settle so cold
       first paint matches warm Replay (see startMotionWhenReady). */
    .stage:not(.motion-ready),
    .stage:not(.motion-ready) * {
      animation-play-state: paused !important;
    }
    .stage-element,
    .stage-static {
      position: absolute;
      visibility: inherit;
      box-sizing: border-box;
    }
${sizeCreative.manualCss || ''}

${options.renderMode === 'outline' ? '' : offerValueSymbolCss}

${layerCss}

${structuredRuleCss(sizeCreative)}

${defaultAnimationCss}

${profileStaticCss}

${profileAnimationCss}

${offers0StaticCss}

${offers0AnimationCss}
`;
};

const renderBody = async (document: Record<string, unknown>, size: string, options: RenderOptions = {}) => {
  const sizeCreative = document.sizes[size];
  const background = options.includePackagedBackground === false ? '' : assetSrc(sizeCreative.assets.background, options);
  const row = sampleRowForDocument(document);
  const stateClass = options.renderMode === 'outline' ? stateClasses(row) : DEFAULT_STATE;
  const plusLayoutAttr = ` ${OFFER_PLUS_LAYOUT_ATTR}="${escapeAttr(resolveOfferPlusLayout(document))}"`;
  if (options.renderMode === 'outline') {
    const activeScopes = activeScopesFromControls(controlsFromFeedRow(row));
    const presentationSnapshot = outlineSnapshotForDocument(document, options.presentationSnapshot);
    const outlineOptions = { ...options, presentationSnapshot };
    const offerBakes = await bakeOutlinedOfferSlotSvgs({
      document,
      size,
      row,
      activeScopes,
      snapshot: presentationSnapshot,
    });
    const layers = (await Promise.all(
      sizeCreative.layers
        .filter((layer: Record<string, unknown>) => layer.id !== 'bg-image')
        .map((layer: Record<string, unknown>) => (
          renderOutlinedLayer(document, size, layer, row, activeScopes, outlineOptions, offerBakes)
        )),
    )).filter(Boolean).join('\n');
    const terms = await renderOutlinedTermsWrappers(document, size, row, activeScopes, outlineOptions);
    const packagedSrcAttr = isStaticDelivery(options)
      ? ''
      : ` data-packaged-src="${escapeAttr(background)}"`;
    return `      <main id="page-content" class="stage page-content ${stateClass}" data-size="${escapeAttr(size)}"${plusLayoutAttr}>
          <img alt="" draggable="false" class="stage-element bg-image" id="bg-image" src="${escapeAttr(background)}"${packagedSrcAttr}>
${layers}
${terms}
      </main>`;
  }
  const layers = sizeCreative.layers
    .filter((layer: Record<string, unknown>) => layer.id !== 'bg-image')
    .map((layer: Record<string, unknown>) => renderLayer(layer, options))
    .filter(Boolean)
    .join('\n');
  return `      <main id="page-content" class="stage page-content ${stateClass}" data-size="${escapeAttr(size)}"${plusLayoutAttr} data-dco-state="offer_count_num,tc_type_enum,cta_type_enum,include_roundel_frame_bool,roundel_value_text">
          <img alt="" draggable="false" class="stage-element bg-image" id="bg-image" src="${escapeAttr(background)}" data-packaged-src="${escapeAttr(background)}" data-dco-field="${escapeAttr(backgroundImageFieldName(size))}">
${layers}
${renderTermsWrappers(sizeCreative)}
      </main>`;
};

export const renderStudioReadyHtml = async (
  document: Record<string, unknown>,
  size: string,
  options: RenderOptions = {},
) => {
  const sizeCreative = document.sizes?.[size];
  if (!sizeCreative) throw new Error(`Unknown creative size: ${size}`);
  const renderMode = options.renderMode || 'font';
  const delivery: DeliveryMode = options.delivery === 'static' ? 'static' : 'studio';
  // Outline exports are fixed-copy / self-contained: inline logo/wave/plus SVGs
  // as data URIs (same as canonical embed) unless the caller already mapped assets
  // (CDN packages keep their explicit URL map). Static also flattens bg paths.
  const defaultOutlineAssetMap = renderMode === 'outline'
    ? {
      ...buildEmbedSvgAssetUrlMap(document),
      ...(delivery === 'static' ? buildFlatBackgroundAssetUrlMap(document) : {}),
    }
    : undefined;
  const resolvedOptions: RenderOptions = {
    ...options,
    renderMode,
    delivery: renderMode === 'outline' ? delivery : 'studio',
    assetUrlMap: options.assetUrlMap ?? defaultOutlineAssetMap,
    presentationSnapshot: options.presentationSnapshot ?? null,
  };
  const studioDynamicContentScript = options.includeStudioDynamicContent && renderMode === 'font'
    ? `\n${renderStudioDynamicContentScript(document, {}, {
      backgroundUrlForSize: options.studioBackgroundUrlForSize,
    })}\n`
    : '';
  const scripts = renderMode === 'outline'
    ? outlineRuntimeScript(resolvedOptions.delivery)
    : runtimeScript(textFitRulesForSize(sizeCreative), resolvedOptions, {
      layers: sizeCreative.layers,
      beatsProfiles: {
        'frames-3': beatsForFrameScope(document, 'frames-3'),
        'frames-4': beatsForFrameScope(document, 'frames-4'),
      },
      durationS: document.clock.durationS,
    });
  const body = await renderBody(document, size, resolvedOptions);
  const title = `${escapeHtml(document.campaign?.name || 'SSE DCO')} ${escapeHtml(size)}`;
  const isStatic = isStaticDelivery(resolvedOptions);
  const environmentMeta = isStatic ? '' : '    <meta name="environment" content="dv360">\n';
  const enablerTag = isStatic
    ? ''
    : `    <script src="https://s0.2mdn.net/ads/studio/Enabler.js"></script>${studioDynamicContentScript}\n`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
${environmentMeta}    <meta name="viewport" content="width=${sizeCreative.canvas.width}, initial-scale=1.0">
    <title>${title}</title>
${renderMode === 'outline' ? '' : packagedFontPreloadTags(resolvedOptions)}
${enablerTag}    <style>
${cssForSize(document, size, resolvedOptions)}
    </style>
${scripts}
${renderMode === 'outline' ? '' : previewValidatorTag(resolvedOptions)}
  </head>
  <body>
${body}
  </body>
</html>
`;
};

export const renderWipHtml = (html: string, row: Record<string, unknown>) => {
  const feedScript = `    <script id="sse-dco-preview-feed">
      window.__SSE_DCO_PREVIEW__ = ${JSON.stringify(row, null, 2).replace(/\n/g, '\n      ')};
    </script>
`;
  return html
    .replace(DEFAULT_STATE, stateClasses(row))
    .replace('    <script src="https://s0.2mdn.net/ads/studio/Enabler.js"></script>', `    <script src="https://s0.2mdn.net/ads/studio/Enabler.js"></script>\n${feedScript}`);
};

export const buildCreativeHtmlFiles = async (
  document: Record<string, unknown>,
  size: string,
  options: HtmlExportOptions = {},
) => {
  await fs.mkdir(outputRoot, { recursive: true });
  const slug = exportSlugForDocument(document);
  const renderMode = options.renderMode || 'font';
  const delivery: DeliveryMode = options.delivery === 'static' ? 'static' : 'studio';
  // Local QA files load the packaged Museo (output/ sits beside campaign/), so
  // they measure and render the same font Studio serves — not whatever happens
  // to be installed on this machine. Outline mode skips the font face entirely
  // (SVGs are inlined inside renderStudioReadyHtml).
  const html = await renderStudioReadyHtml(document, size, {
    fontBasePath: renderMode === 'outline' ? undefined : '../campaign/assets/fonts/',
    renderMode,
    delivery: renderMode === 'outline' ? delivery : 'studio',
    presentationSnapshot: options.presentationSnapshots?.[size] || null,
  });
  const outPath = path.resolve(outputRoot, `${slug}_${size}.html`);
  await fs.writeFile(outPath, html);
  const variants = { single: 1, dual: 2, triple: 3 };
  const wip: Record<string, string> = {};
  if (renderMode === 'font') {
    for (const [variant, offerCount] of Object.entries(variants)) {
      const row = document.feed.sampleRows.find((sample) => Number(sample.offer_count_num) === offerCount);
      if (!row) continue;
      const wipPath = path.resolve(outputRoot, `${slug}_${size}_WIP_${variant}.html`);
      await fs.writeFile(wipPath, renderWipHtml(html, row));
      wip[variant] = path.relative(outputRoot, wipPath);
    }
  }
  const modeLabel = renderMode === 'outline' && delivery === 'static'
    ? 'outline/static'
    : renderMode;
  return {
    code: 0,
    stdout: `Built ${path.relative(outputRoot, outPath)} with replacement exporter (${modeLabel})\n`,
    stderr: '',
    outPath: path.relative(outputRoot, outPath),
    wip,
  };
};

/** Non-SVG assets referenced by the creative (backgrounds). SVGs are inlined in outline mode. */
const collectOutlineHtmlSidecarAssets = (document: Record<string, unknown>) => (
  collectClientAssetPaths(document).filter((assetPath) => !isSvgAssetPath(assetPath))
);

/**
 * Copy background JPEGs into output/ so outline HTML relative `assets/…` paths resolve.
 * Static delivery flattens to `assets/<basename>`; studio outline keeps nested paths.
 */
const stageOutlineHtmlSidecarAssets = async (
  document: Record<string, unknown>,
  delivery: DeliveryMode = 'studio',
) => {
  const staged: string[] = [];
  for (const assetPath of collectOutlineHtmlSidecarAssets(document)) {
    const source = path.resolve(projectRoot, assetPath);
    const entryPath = delivery === 'static' ? flatAssetEntryPath(assetPath) : assetPath;
    const destination = path.resolve(outputRoot, entryPath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
    staged.push(entryPath);
  }
  return staged;
};

export const buildAllCreativeHtmlFiles = async (
  document: Record<string, unknown>,
  options: HtmlExportOptions = {},
) => {
  const sizes = Object.keys(document.sizes || {});
  const outputs: Record<string, unknown> = {};
  const stdout = [];
  const delivery: DeliveryMode = options.delivery === 'static' ? 'static' : 'studio';
  for (const size of sizes) {
    const result = await buildCreativeHtmlFiles(document, size, options);
    outputs[size] = result;
    stdout.push(result.stdout.trim());
  }
  const sidecarAssets = options.renderMode === 'outline'
    ? await stageOutlineHtmlSidecarAssets(document, delivery)
    : [];
  return {
    code: 0,
    stdout: `${stdout.join('\n')}\nBuilt ${sizes.length} sizes with replacement exporter\n`,
    stderr: '',
    outputs,
    sidecarAssets,
  };
};

/** Build HTML into output/, then zip those files for browser download. */
export const buildHtmlExportZip = async (
  document: Record<string, unknown>,
  options: HtmlExportOptions = {},
) => {
  const result = await buildAllCreativeHtmlFiles(document, options);
  const entries: PackageEntry[] = [];
  for (const sizeResult of Object.values(result.outputs) as Array<{
    outPath?: string;
    wip?: Record<string, string>;
  }>) {
    if (sizeResult.outPath) {
      const absolute = path.resolve(outputRoot, sizeResult.outPath);
      entries.push({ path: sizeResult.outPath, data: await fs.readFile(absolute) });
    }
    for (const wipRel of Object.values(sizeResult.wip || {})) {
      const absolute = path.resolve(outputRoot, wipRel);
      entries.push({ path: wipRel, data: await fs.readFile(absolute) });
    }
  }
  // Outline HTML keeps relative `assets/…` background refs; ship those files in the ZIP
  // (SVGs are already data URIs). Font-mode HTML export stays HTML-only.
  for (const assetPath of result.sidecarAssets || []) {
    entries.push({
      path: assetPath,
      data: await fs.readFile(path.resolve(outputRoot, assetPath)),
    });
  }
  return {
    result,
    zip: createZipBuffer(entries),
    slug: exportSlugForDocument(document),
  };
};

export type ExportPreviewCampaignInput = {
  id: string;
  document: Record<string, unknown>;
  presentationSnapshots?: PresentationSnapshots;
};

export type ExportPreviewLatest = {
  generatedAt: string;
  zip: string;
  campaigns: Array<{
    id: string;
    name: string;
    exportSlug: string;
    sizes: string[];
  }>;
};

const formatStaticsZipTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
};

const writeTreeEntries = async (root: string, entries: PackageEntry[]) => {
  for (const entry of entries) {
    const target = path.resolve(root, entry.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    await fs.writeFile(target, data);
  }
};

/**
 * Bake Export-for-Static HTML for the non-DCO campaigns into tracked `outputs/`,
 * zip them for client download, and refresh `latest.json`.
 */
export const buildExportPreviewPackage = async (
  campaigns: ExportPreviewCampaignInput[],
) => {
  const allowed = new Map(listStaticPreviewCampaigns().map((entry) => [entry.id, entry]));
  if (!campaigns.length) {
    throw new Error('Export for Preview requires at least one non-DCO campaign');
  }

  const campaignEntries: PackageEntry[] = [];
  const campaignMeta: ExportPreviewLatest['campaigns'] = [];
  const written: string[] = [];

  for (const input of campaigns) {
    const registry = allowed.get(input.id);
    if (!registry) {
      throw new Error(`Campaign ${input.id} is not a statics preview campaign`);
    }
    const document = input.document;
    if (document?.campaign?.id && document.campaign.id !== input.id) {
      throw new Error(`Document campaign id ${document.campaign.id} does not match ${input.id}`);
    }
    const slug = exportSlugForDocument(document);
    const sizes = Object.keys(document.sizes || {});

    for (const size of sizes) {
      const html = await renderStudioReadyHtml(document, size, {
        renderMode: 'outline',
        delivery: 'static',
        presentationSnapshot: input.presentationSnapshots?.[size] || null,
      });
      const relativePath = `campaigns/${input.id}/${slug}_${size}.html`;
      campaignEntries.push({ path: relativePath, data: html });
      written.push(relativePath);
    }

    for (const assetPath of collectOutlineHtmlSidecarAssets(document)) {
      const entryPath = flatAssetEntryPath(assetPath);
      const relativePath = `campaigns/${input.id}/${entryPath}`;
      campaignEntries.push({
        path: relativePath,
        data: await fs.readFile(path.resolve(projectRoot, assetPath)),
      });
      written.push(relativePath);
    }

    campaignMeta.push({
      id: input.id,
      name: registry.name,
      exportSlug: slug,
      sizes,
    });
  }

  const generatedAt = new Date().toISOString();
  const zipName = `SSE_Statics_${formatStaticsZipTimestamp()}.zip`;
  const zipRelative = `downloads/${zipName}`;
  const zipBuffer = createZipBuffer(campaignEntries);
  const latest: ExportPreviewLatest = {
    generatedAt,
    zip: zipRelative,
    campaigns: campaignMeta,
  };

  const campaignsDir = path.resolve(outputsRoot, 'campaigns');
  const downloadsDir = path.resolve(outputsRoot, 'downloads');
  await fs.rm(campaignsDir, { recursive: true, force: true });
  await fs.rm(downloadsDir, { recursive: true, force: true });
  await fs.mkdir(campaignsDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  await writeTreeEntries(outputsRoot, campaignEntries);
  await fs.writeFile(path.resolve(outputsRoot, zipRelative), zipBuffer);
  await fs.writeFile(
    path.resolve(outputsRoot, 'latest.json'),
    `${JSON.stringify(latest, null, 2)}\n`,
  );
  written.push(zipRelative, 'latest.json');

  return {
    ok: true as const,
    latest,
    written,
    zipBytes: zipBuffer.length,
  };
};

const canvasMetaForClient = (document: Record<string, unknown>) => {
  const slug = exportSlugForDocument(document);
  return Object.entries(document.sizes || {}).map(([size, sizeCreative]: [string, Record<string, unknown>]) => ({
    size,
    width: sizeCreative.canvas?.width || 0,
    height: sizeCreative.canvas?.height || 0,
    src: `ads/html/${slug}_${size}.html`,
  }));
};

const collectClientAssetPaths = (document: Record<string, unknown>) => {
  const assets = new Set<string>();
  for (const sizeCreative of Object.values(document.sizes || {}) as Array<Record<string, unknown>>) {
    for (const asset of Object.values(sizeCreative.assets || {})) {
      if (String(asset).startsWith('assets/')) assets.add(String(asset));
    }
    for (const layer of sizeCreative.layers || []) {
      if (String(layer.asset || '').startsWith('assets/')) assets.add(String(layer.asset));
    }
  }
  return [...assets].sort();
};

const collectBasePackageAssetPaths = (document: Record<string, unknown>) => (
  collectClientAssetPaths(document).filter((assetPath) => !/^assets\/bg_[^/]+\.jpe?g$/i.test(assetPath))
);

export const renderClientPreviewValidatorScript = () => `(function() {
  var FIELD_TARGETS = {
    heading1_text: ['#headline-act1'],
    heading2_text: ['#headline-act2'],
    heading3_text: ['#headline-act3'],
    heading4_text: ['#headline-act4'],
    offer1_value_text: ['#offer1 .offer-value'],
    offer1_sub_text: ['#offer1 .offer-subline'],
    offer2_value_text: ['#offer2 .offer-value'],
    offer2_sub_text: ['#offer2 .offer-subline'],
    offer3_value_text: ['#offer3 .offer-value'],
    offer3_sub_text: ['#offer3 .offer-subline'],
    cta_text: ['#cta'],
    roundel_text_text: ['.roundel-copy'],
    roundel_value_text: ['.roundel-value'],
    tc_terms_text: ['.terms-prices', '.terms-solo'],
    tc_units_text: ['.unit-rate-prices']
  };

  var FALLBACK_FIELDS = [
    { name: 'heading1_text', label: 'Heading 1' },
    { name: 'heading2_text', label: 'Heading 2' },
    { name: 'heading3_text', label: 'Heading 3' },
    { name: 'heading4_text', label: 'Heading 4' },
    { name: 'offer1_value_text', label: 'Offer 1 value' },
    { name: 'offer1_sub_text', label: 'Offer 1 subline' },
    { name: 'offer2_value_text', label: 'Offer 2 value' },
    { name: 'offer2_sub_text', label: 'Offer 2 subline' },
    { name: 'offer3_value_text', label: 'Offer 3 value' },
    { name: 'offer3_sub_text', label: 'Offer 3 subline' },
    { name: 'cta_text', label: 'CTA text' },
    { name: 'roundel_text_text', label: 'Roundel text' },
    { name: 'roundel_value_text', label: 'Roundel value' },
    { name: 'tc_terms_text', label: 'T&C text' },
    { name: 'tc_units_text', label: 'Unit price text' }
  ];

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function injectStyles() {
    if (document.getElementById('sse-dco-validation-styles')) return;
    var style = document.createElement('style');
    style.id = 'sse-dco-validation-styles';
    style.textContent = [
      '.validation-switch { display: flex !important; grid-template-columns: none !important; align-items: center; gap: 8px; margin: 0; color: var(--muted); font-size: 12px; font-weight: 500; letter-spacing: 0; text-transform: none; white-space: nowrap; }',
      '.validation-switch input { width: 16px; min-width: 16px; min-height: 16px; padding: 0; accent-color: var(--teal); }',
      '.validation-switch b { color: var(--muted); font-size: 11px; font-weight: 500; }',
      'label.validation-field { grid-template-columns: 82px minmax(0, 1fr) 22px; }',
      '.validation-badge { position: relative; display: none; place-items: center; width: 18px; height: 18px; border: 0; border-radius: 999px; color: #10161d; cursor: help; font: 700 12px/1 system-ui, sans-serif; padding: 0; }',
      '.validation-badge::before { content: "!"; }',
      '.validation-badge::after { content: attr(data-validation-tooltip); display: none; position: absolute; z-index: 80; right: 0; top: 24px; width: max-content; max-width: 340px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: #0b1118; color: var(--ink); box-shadow: 0 14px 40px rgba(0,0,0,0.34); white-space: pre-line; text-align: left; font: 500 12px/1.35 system-ui, sans-serif; text-transform: none; }',
      '.validation-badge:hover::after, .validation-badge:focus-visible::after { display: block; }',
      '.validation-field.validation-warning .validation-badge, .validation-field.validation-error .validation-badge { display: grid; }',
      '.validation-field.validation-warning .validation-badge { background: #f59e0b; }',
      '.validation-field.validation-error .validation-badge { background: #ff4d57; color: white; }',
      '.validation-field.validation-warning input, .validation-field.validation-warning textarea { border-color: #f59e0b; box-shadow: 0 0 0 1px rgba(245,158,11,0.24); }',
      '.validation-field.validation-error input, .validation-field.validation-error textarea { border-color: #ff4d57; box-shadow: 0 0 0 1px rgba(255,77,87,0.28); }',
      'body.validation-off .validation-field input, body.validation-off .validation-field textarea { box-shadow: none; }',
      'body.validation-off .validation-badge { display: none !important; }',
      '.validation-lab { position: fixed; left: -20000px; top: 0; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; }'
    ].join('\\n');
    document.head.appendChild(style);
  }

  function fieldValue(controls, name) {
    var control = controls.elements[name];
    if (control && control.type === 'checkbox') return control.checked ? 'true' : 'false';
    return control ? control.value : '';
  }

  function rowFromControls(controls) {
    return {
      heading1_text: fieldValue(controls, 'heading1_text'),
      heading2_text: fieldValue(controls, 'heading2_text'),
      heading3_text: fieldValue(controls, 'heading3_text'),
      heading4_text: fieldValue(controls, 'heading4_text'),
      offer_count_num: (function(value) {
        var parsed = parseInt(value, 10);
        if (!isFinite(parsed)) return 1;
        return Math.min(3, Math.max(0, parsed));
      })(fieldValue(controls, 'offer_count_num')),
      offer1_value_text: fieldValue(controls, 'offer1_value_text'),
      offer1_sub_text: fieldValue(controls, 'offer1_sub_text'),
      offer2_value_text: fieldValue(controls, 'offer2_value_text'),
      offer2_sub_text: fieldValue(controls, 'offer2_sub_text'),
      offer3_value_text: fieldValue(controls, 'offer3_value_text'),
      offer3_sub_text: fieldValue(controls, 'offer3_sub_text'),
      cta_type_enum: fieldValue(controls, 'cta_type_enum'),
      cta_text: fieldValue(controls, 'cta_text'),
      include_roundel_frame_bool: fieldValue(controls, 'include_roundel_frame_bool'),
      roundel_text_text: fieldValue(controls, 'roundel_text_text'),
      roundel_value_text: fieldValue(controls, 'roundel_value_text'),
      tc_type_enum: fieldValue(controls, 'tc_type_enum'),
      tc_terms_text: fieldValue(controls, 'tc_terms_text'),
      tc_units_text: fieldValue(controls, 'tc_units_text'),
      background_image_url: fieldValue(controls, 'background_image_url')
    };
  }

  function setSavedValidationState(enabled) {
    try {
      window.localStorage.setItem('sse-dco-copy-validation', enabled ? 'on' : 'off');
    } catch (error) {}
  }

  function getSavedValidationState() {
    try {
      return window.localStorage.getItem('sse-dco-copy-validation') !== 'off';
    } catch (error) {
      return true;
    }
  }

  function createToggle(state, scheduleValidation) {
    var actions = document.querySelector('.preview-actions');
    if (!actions) return null;
    var label = document.createElement('label');
    label.className = 'validation-switch';
    label.title = 'Turn copy validation warnings on or off';
    label.innerHTML = '<input type="checkbox" name="Copy_Validation"><span>Validate copy</span><b data-validation-summary></b>';
    var input = label.querySelector('input');
    var summary = label.querySelector('[data-validation-summary]');
    input.checked = state.enabled;
    input.addEventListener('change', function() {
      state.enabled = input.checked;
      document.body.classList.toggle('validation-off', !state.enabled);
      setSavedValidationState(state.enabled);
      clearIndicators(state);
      if (summary) summary.textContent = state.enabled ? 'Checking' : 'Off';
      if (state.enabled) {
        ensureValidationFrames(state, scheduleValidation);
        scheduleValidation();
      }
    });
    actions.insertBefore(label, actions.firstChild);
    return { input: input, summary: summary };
  }

  function createBadges(state) {
    state.fields.forEach(function(field) {
      var control = state.controls.elements[field.name];
      if (!control || !control.closest) return;
      var label = control.closest('label');
      if (!label) return;
      label.classList.add('validation-field');
      var badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'validation-badge';
      badge.setAttribute('aria-label', field.label + ' validation');
      label.appendChild(badge);
      state.badges[field.name] = { label: label, badge: badge, field: field };
    });
  }

  function clearIndicators(state) {
    Object.keys(state.badges).forEach(function(name) {
      var item = state.badges[name];
      item.label.classList.remove('validation-warning', 'validation-error');
      item.badge.removeAttribute('data-validation-tooltip');
      item.badge.removeAttribute('title');
      item.badge.setAttribute('aria-label', item.field.label + ' validation');
    });
  }

  function ensureValidationFrames(state, scheduleValidation) {
    if (state.lab) return;
    var lab = document.createElement('div');
    lab.className = 'validation-lab';
    lab.setAttribute('aria-hidden', 'true');
    document.body.appendChild(lab);
    state.lab = lab;
    state.sizes.forEach(function(meta) {
      var frame = document.createElement('iframe');
      frame.title = 'Validation ' + meta.size;
      frame.tabIndex = -1;
      frame.width = meta.width || 1;
      frame.height = meta.height || 1;
      frame.dataset.validationSize = meta.size;
      frame.src = meta.src;
      frame.addEventListener('load', scheduleValidation);
      lab.appendChild(frame);
      state.frames[meta.size] = frame;
    });
  }

  function issueText(result) {
    if (!result || !result.issues || !result.issues.length) return '';
    return result.issues.join(', ');
  }

  function updateIndicators(state) {
    if (!state.enabled) return;
    clearIndicators(state);
    var errorCount = 0;
    var warningCount = 0;

    state.fields.forEach(function(field) {
      var item = state.badges[field.name];
      if (!item) return;
      var errors = [];
      var warnings = [];
      Object.keys(state.results).forEach(function(size) {
        var fieldResult = state.results[size] && state.results[size][field.name];
        if (!fieldResult || fieldResult.status === 'ok') return;
        var detail = size + ': ' + issueText(fieldResult);
        if (fieldResult.status === 'error') errors.push(detail);
        if (fieldResult.status === 'warning') warnings.push(detail);
      });
      if (!errors.length && !warnings.length) return;
      var tooltip = field.label;
      if (errors.length) tooltip += '\\nErrors\\n' + errors.join('\\n');
      if (warnings.length) tooltip += '\\nWarnings\\n' + warnings.join('\\n');
      item.badge.setAttribute('data-validation-tooltip', tooltip);
      item.badge.setAttribute('title', tooltip);
      if (errors.length) {
        item.label.classList.add('validation-error');
        errorCount += 1;
      } else {
        item.label.classList.add('validation-warning');
        warningCount += 1;
      }
    });

    if (state.summary) {
      if (state.pendingCount > 0) {
        state.summary.textContent = 'Checking';
      } else if (errorCount || warningCount) {
        state.summary.textContent = errorCount + ' error' + (errorCount === 1 ? '' : 's') + ' / ' + warningCount + ' warn';
      } else {
        state.summary.textContent = 'OK';
      }
    }
  }

  function requestValidation(state) {
    if (!state.enabled) return;
    ensureValidationFrames(state, function() { scheduleValidation(state); });
    state.requestId += 1;
    state.results = {};
    state.pendingCount = state.sizes.length;
    var message = {
      type: 'SSE_DCO_VALIDATE',
      requestId: state.requestId,
      row: rowFromControls(state.controls)
    };
    updateIndicators(state);
    state.sizes.forEach(function(meta) {
      var frame = state.frames[meta.size];
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage(message, '*');
      }
    });
  }

  function scheduleValidation(state) {
    if (!state.enabled) return;
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(function() {
      requestValidation(state);
    }, 180);
  }

  function initPreviewValidator() {
    var config = window.__SSE_DCO_CLIENT_PREVIEW__;
    var controls = document.getElementById('controls');
    if (!config || !controls || !Array.isArray(config.sizes)) return;
    injectStyles();
    var state = {
      controls: controls,
      fields: Array.isArray(config.fields) ? config.fields : FALLBACK_FIELDS,
      sizes: config.sizes,
      frames: {},
      badges: {},
      results: {},
      requestId: 0,
      pendingCount: 0,
      timer: 0,
      enabled: getSavedValidationState(),
      lab: null,
      summary: null
    };
    var scheduled = function() { scheduleValidation(state); };
    var toggle = createToggle(state, scheduled);
    state.summary = toggle && toggle.summary;
    document.body.classList.toggle('validation-off', !state.enabled);
    createBadges(state);
    controls.addEventListener('input', scheduled);
    controls.addEventListener('change', scheduled);
    window.addEventListener('message', function(event) {
      var data = event.data || {};
      if (data.type !== 'SSE_DCO_VALIDATION_RESULT' || data.requestId !== state.requestId) return;
      state.results[data.size] = data.results || {};
      state.pendingCount = Math.max(0, state.pendingCount - 1);
      updateIndicators(state);
    });
    if (state.summary) state.summary.textContent = state.enabled ? 'Checking' : 'Off';
    if (state.enabled) {
      ensureValidationFrames(state, scheduled);
      scheduled();
    }
  }

  function currentSize() {
    var stage = document.querySelector('[data-size]');
    return stage ? stage.getAttribute('data-size') : '';
  }

  function isVisible(element) {
    if (!element || !element.textContent || !element.textContent.trim()) return false;
    var style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function declaredFontSize(element, actual) {
    var previous = element.style.fontSize;
    element.style.fontSize = '';
    var declared = parseFloat(window.getComputedStyle(element).fontSize) || actual;
    element.style.fontSize = previous;
    return declared;
  }

  function textOutsideElement(element) {
    if (!document.createRange) return { horizontal: false, vertical: false };
    var range = document.createRange();
    try {
      range.selectNodeContents(element);
      var textRect = range.getBoundingClientRect();
      var box = element.getBoundingClientRect();
      var tolerance = 2;
      if (!textRect || textRect.width <= 0 || textRect.height <= 0) return { horizontal: false, vertical: false };
      return {
        horizontal: textRect.left < box.left - tolerance || textRect.right > box.right + tolerance,
        vertical: textRect.top < box.top - tolerance || textRect.bottom > box.bottom + tolerance
      };
    } finally {
      if (range.detach) range.detach();
    }
  }

  function wordBreaksAcrossLines(textNode, start, end) {
    if (!document.createRange || end - start <= 1) return false;
    var range = document.createRange();
    var tops = [];
    try {
      for (var index = start; index < end; index += 1) {
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        var rect = range.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) continue;
        var top = Math.round(rect.top);
        if (tops.indexOf(top) === -1) tops.push(top);
        if (tops.length > 1) return true;
      }
      return false;
    } finally {
      if (range.detach) range.detach();
    }
  }

  function hasForcedWordBreak(element) {
    if (!document.createTreeWalker) return false;
    var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue || '';
      var match;
      var wordPattern = /\\S+/g;
      while ((match = wordPattern.exec(text))) {
        if (wordBreaksAcrossLines(node, match.index, match.index + match[0].length)) return true;
      }
    }
    return false;
  }

  function inspectElement(element) {
    if (!isVisible(element)) return null;
    var computed = window.getComputedStyle(element);
    var actual = parseFloat(computed.fontSize) || 0;
    var declared = declaredFontSize(element, actual);
    var lineHeight = parseFloat(computed.lineHeight) || actual * 1.15 || 12;
    var scaledThreshold = Math.max(1.5, declared * 0.05);
    var verticalThreshold = Math.max(8, lineHeight * 0.9);
    var outside = textOutsideElement(element);
    var legalCopy = element.classList.contains('terms-prices')
      || element.classList.contains('terms-solo')
      || element.classList.contains('unit-rate-prices');
    var issues = [];
    var error = false;
    var scaled = declared > 0 && actual < declared - scaledThreshold;
    if (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 2) {
      issues.push('text exceeds box width');
      error = true;
    }
    if (!legalCopy && element.clientHeight > 0 && element.scrollHeight > element.clientHeight + verticalThreshold) {
      issues.push('text exceeds box height');
      error = true;
    }
    if (outside.horizontal) {
      issues.push('text renders outside its box');
      error = true;
    }
    if (hasForcedWordBreak(element)) {
      issues.push('word is breaking across lines');
      error = true;
    }
    if (scaled) {
      issues.push('font scaled from ' + Math.round(declared) + 'px to ' + Math.round(actual) + 'px');
      if (actual < declared * 0.75) {
        error = true;
      }
    }
    return {
      status: error ? 'error' : (scaled ? 'warning' : 'ok'),
      issues: issues
    };
  }

  function mergeFieldResults(results) {
    var status = 'ok';
    var issues = [];
    results.forEach(function(result) {
      if (!result) return;
      if (result.status === 'error') status = 'error';
      if (result.status === 'warning' && status !== 'error') status = 'warning';
      result.issues.forEach(function(issue) {
        if (issues.indexOf(issue) === -1) issues.push(issue);
      });
    });
    return { status: status, issues: issues };
  }

  function inspectAllFields() {
    var out = {};
    Object.keys(FIELD_TARGETS).forEach(function(fieldName) {
      var results = [];
      FIELD_TARGETS[fieldName].forEach(function(selector) {
        document.querySelectorAll(selector).forEach(function(element) {
          var result = inspectElement(element);
          if (result) results.push(result);
        });
      });
      out[fieldName] = mergeFieldResults(results);
    });
    return out;
  }

  function afterFontsAndLayout(callback) {
    var fontsReady = document.fonts && document.fonts.ready
      ? document.fonts.ready.catch(function() {})
      : Promise.resolve();
    fontsReady.then(function() {
      window.requestAnimationFrame(function() {
        window.requestAnimationFrame(callback);
      });
    });
  }

  function initAdValidator() {
    if (!document.querySelector('[data-dco-state]')) return;
    window.addEventListener('message', function(event) {
      var data = event.data || {};
      if (data.type !== 'SSE_DCO_VALIDATE') return;
      if (typeof window.applySseDcoRuntimeState === 'function') {
        window.applySseDcoRuntimeState(data.row || {});
      }
      afterFontsAndLayout(function() {
        var target = event.source || window.parent;
        if (!target) return;
        target.postMessage({
          type: 'SSE_DCO_VALIDATION_RESULT',
          requestId: data.requestId,
          size: currentSize(),
          results: inspectAllFields()
        }, '*');
      });
    });
  }

  ready(function() {
    initPreviewValidator();
    initAdValidator();
  });
})();`;

export const renderClientPreviewPage = (document: Record<string, unknown>, options: ClientPreviewPackageOptions = {}) => {
  const includeValidator = options.includeValidator !== false;
  const slug = exportSlugForDocument(document);
  const sizes = canvasMetaForClient(document);
  const initialRow = clientInitialRow(document);
  const initialSize = sizes[0] || { size: '', width: 0, height: 0, src: '' };
  const initialBackground = imageFieldUrl(initialRow[backgroundImageFieldName(initialSize.size)]);
  const sizeOptions = sizes.map((item) => (
    `<option value="${escapeAttr(item.size)}">${escapeHtml(item.size)}</option>`
  )).join('');
  const offerCountOptions = (documentHasZeroOffers(document) ? [0, 1, 2, 3] : [1, 2, 3])
    .map((count) => `<option value="${count}">${count}</option>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>SSE DCO client preview</title>
    <link rel="stylesheet" href="https://use.typekit.net/grv2rfu.css">
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0f13;
        --panel: #141b23;
        --panel-2: #1d2731;
        --line: #2b3846;
        --ink: #edf7f7;
        --muted: #99a8b5;
        --teal: #16c7b7;
        --pink: #ff6b9d;
        --blue: rgb(0, 41, 117);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: 100vh;
        min-height: 100vh;
        overflow: hidden;
        background: var(--bg);
        color: var(--ink);
        font-family: "museo-sans", sans-serif;
        font-weight: 300;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 18px 24px;
        border-bottom: 1px solid var(--line);
        background: #10161d;
      }
      .header-title {
        margin: 0;
        color: var(--ink);
        font-family: "museo-sans", sans-serif;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
      }
      .brand-lockup {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .brand-logo {
        display: block;
        width: auto;
        flex: 0 0 auto;
      }
      .brand-logo-bg {
        height: 22px;
      }
      .brand-logo-sse {
        height: 26px;
      }
      .brand-divider {
        color: var(--muted);
        font-size: 20px;
        font-weight: 300;
        line-height: 1;
        flex: 0 0 auto;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(400px, 460px) minmax(0, 1fr);
        height: calc(100vh - 76px);
        min-height: 0;
      }
      .controls {
        border-right: 1px solid var(--line);
        background: var(--panel);
        padding: 14px 16px;
        overflow-y: auto;
        min-height: 0;
      }
      .preview {
        display: flex;
        flex-direction: column;
        padding: 22px;
        overflow: hidden;
        min-height: 0;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
      }
      h2 {
        margin: 16px 0 8px;
        color: var(--teal);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h3 {
        margin: 4px 0 8px;
        color: var(--ink);
        font-size: 13px;
        font-weight: 400;
      }
      label {
        display: grid;
        grid-template-columns: 82px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 300;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      label span {
        line-height: 1.15;
      }
      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #101821;
        color: var(--ink);
        font: inherit;
        font-size: 14px;
        font-weight: 300;
        min-height: 34px;
        padding: 7px 9px;
        text-transform: none;
        outline: none;
      }
      textarea {
        min-height: 54px;
        resize: vertical;
      }
      .field-tall {
        align-items: start;
      }
      .field-tall span {
        padding-top: 8px;
      }
      input:focus,
      textarea:focus,
      select:focus {
        border-color: var(--teal);
        box-shadow: 0 0 0 2px rgba(22, 199, 183, 0.18);
      }
      label.is-disabled span {
        color: rgba(153, 168, 181, 0.72);
      }
      input:disabled,
      textarea:disabled,
      select:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        color: var(--muted);
        border-color: rgba(43, 56, 70, 0.72);
        box-shadow: none;
      }
      input:disabled:focus,
      textarea:disabled:focus,
      select:disabled:focus {
        border-color: rgba(43, 56, 70, 0.72);
        box-shadow: none;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .offer-block {
        border: 1px solid var(--line);
        border-radius: 6px;
        padding: 10px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.025);
      }
      .offer-block.is-hidden {
        display: none;
      }
      .preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .kicker {
        display: block;
        margin-bottom: 6px;
        color: var(--teal);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .preview-head p {
        margin: 6px 0 0;
        max-width: 620px;
        color: var(--muted);
      }
      .preview-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .zoom-controls {
        display: flex;
        align-items: center;
        gap: 3px;
        flex: 0 0 auto;
      }
      .zoom-controls button {
        display: grid;
        min-width: 24px;
        height: 24px;
        place-items: center;
        padding: 0 7px;
        border: 1px solid var(--line);
        border-radius: 5px;
        background: #101821;
        color: var(--ink);
        cursor: pointer;
        font-family: inherit;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
      }
      .zoom-controls button:hover,
      .zoom-controls button[aria-pressed="true"] {
        border-color: var(--teal);
        background: rgba(22, 199, 183, 0.12);
        color: var(--teal);
      }
      .zoom-readout {
        min-width: 36px;
        color: var(--muted);
        font-size: 10px;
        font-weight: 500;
        text-align: right;
      }
      .ad-card {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        overflow: hidden;
      }
      .ad-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--line);
        color: var(--muted);
        font-size: 12px;
      }
      .ad-card-head strong {
        color: var(--ink);
        font-weight: 500;
      }
      .replay-button,
      .restore-defaults-button {
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #101821;
        color: var(--ink);
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        font-weight: 400;
        min-height: 34px;
        padding: 7px 12px;
      }
      .replay-button:hover,
      .replay-button:focus-visible,
      .restore-defaults-button:hover,
      .restore-defaults-button:focus-visible {
        border-color: var(--teal);
        outline: none;
      }
      .ad-viewport {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        min-height: 0;
        padding: 18px;
        overflow: auto;
        background:
          linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
          #10161d;
        background-size: 20px 20px;
      }
      .ad-frame-shell {
        flex: 0 0 auto;
        margin: 0 auto;
        overflow: hidden;
        background: #fff;
        isolation: isolate;
      }
      iframe {
        display: block;
        border: 0;
        background: white;
        transform-origin: top left;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
      }
      @media (max-width: 900px) {
        body {
          height: auto;
          overflow: auto;
        }
        .layout {
          grid-template-columns: 1fr;
          height: auto;
        }
        .controls {
          border-right: 0;
          border-bottom: 1px solid var(--line);
          max-height: none;
        }
      }
      @media (max-width: 540px) {
        header {
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }
        h1 {
          font-size: 22px;
        }
        .controls,
        .preview {
          padding: 16px;
        }
        label {
          grid-template-columns: 1fr;
          gap: 5px;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand-lockup" aria-label="Boys and Girls and SSE">
        <img class="brand-logo brand-logo-bg" src="brand/BGlogo_SVG.svg" alt="Boys and Girls">
        <span class="brand-divider" aria-hidden="true">|</span>
        <img class="brand-logo brand-logo-sse" src="brand/SSELogoWhite.svg" alt="SSE">
      </div>
      <p class="header-title">DCO Preview</p>
    </header>
    <main class="layout">
      <form class="controls" id="controls">
        <h2>Ad</h2>
        <label><span>Size</span>
          <select name="Ad_Size">
            ${sizeOptions}
          </select>
        </label>
        <label><span>Background</span><input name="background_image_url" value="${escapeAttr(initialBackground)}" placeholder="Use packaged background for this size"></label>

        <h2>Headlines</h2>
        <label class="field-tall"><span>Heading 1</span><textarea name="heading1_text">${escapeHtml(initialRow.heading1_text)}</textarea></label>
        <label class="field-tall"><span>Heading 2</span><textarea name="heading2_text">${escapeHtml(initialRow.heading2_text)}</textarea></label>
        <label data-heading3-field class="field-tall ${initialRow.include_roundel_frame_bool ? '' : 'is-disabled'}"><span>Heading 3</span><textarea name="heading3_text" ${initialRow.include_roundel_frame_bool ? '' : 'disabled'}>${escapeHtml(initialRow.heading3_text)}</textarea></label>
        <label data-heading4-field class="field-tall"><span>Heading 4</span><textarea name="heading4_text">${escapeHtml(initialRow.heading4_text || '')}</textarea></label>

        <h2>Offers</h2>
        <label><span>Number</span>
          <select name="offer_count_num">
            ${offerCountOptions}
          </select>
        </label>

        ${[1, 2, 3].map((index) => `
        <section class="offer-block" data-offer-block="${index}">
          <h3>Offer ${index}</h3>
          <label><span>Value</span><input name="offer${index}_value_text" value="${escapeAttr(initialRow[`offer${index}_value_text`])}"></label>
          <label><span>Subline</span><input name="offer${index}_sub_text" value="${escapeAttr(initialRow[`offer${index}_sub_text`])}"></label>
        </section>`).join('')}

        <h2>CTA</h2>
        <label><span>Type</span>
          <select name="cta_type_enum">
            <option value="roundel">Circle</option>
            <option value="rectangle">Rectangle</option>
          </select>
        </label>
        <label><span>Text</span><input name="cta_text" value="${escapeAttr(initialRow.cta_text)}"></label>

        <h2>Roundel Frame</h2>
        <label><span>Include</span><input type="checkbox" name="include_roundel_frame_bool" value="true" ${initialRow.include_roundel_frame_bool ? 'checked' : ''}></label>
        <label><span>Text</span><input name="roundel_text_text" value="${escapeAttr(initialRow.roundel_text_text)}"></label>
        <label><span>Value</span><input name="roundel_value_text" value="${escapeAttr(initialRow.roundel_value_text)}"></label>

        <h2>T&Cs</h2>
        <label><span>Format</span>
          <select name="tc_type_enum">
            <option value="tcs_only">T&Cs only</option>
            <option value="tcs_units">T&Cs with unit prices</option>
          </select>
        </label>
        <label class="field-tall"><span>T&C text</span><textarea name="tc_terms_text">${escapeHtml(initialRow.tc_terms_text)}</textarea></label>
        <label class="field-tall"><span>Unit price text</span><textarea name="tc_units_text">${escapeHtml(initialRow.tc_units_text)}</textarea></label>
      </form>
      <section class="preview">
        <div class="preview-head">
          <div>
            <span class="kicker">Active format</span>
            <h1 data-active-size-label>${escapeHtml(initialSize.size)}</h1>
          </div>
          <div class="preview-actions">
            <div class="zoom-controls" aria-label="Preview zoom">
              <button type="button" class="zoom-button" data-zoom-step="-1" aria-label="Zoom out">−</button>
              <button type="button" class="zoom-button" data-zoom-mode="fit" aria-label="Fit to viewport" aria-pressed="true">Fit</button>
              <button type="button" class="zoom-button" data-zoom-mode="1" aria-label="100% zoom">1x</button>
              <button type="button" class="zoom-button" data-zoom-mode="2" aria-label="200% zoom">2x</button>
              <button type="button" class="zoom-button" data-zoom-step="1" aria-label="Zoom in">+</button>
              <span class="zoom-readout" data-zoom-readout>Fit</span>
            </div>
            <button class="restore-defaults-button" id="restore-defaults" type="button">Restore defaults</button>
            <button class="replay-button" id="replay-ad" type="button">Replay ad</button>
          </div>
        </div>
        <article class="ad-card">
          <div class="ad-card-head">
            <strong>Preview</strong>
            <span data-active-dimensions>${initialSize.width} x ${initialSize.height}</span>
          </div>
          <div class="ad-viewport">
            <div class="ad-frame-shell" data-ad-frame-shell>
              <iframe title="SSE DCO ${escapeAttr(initialSize.size)}" data-ad-frame src="${escapeAttr(initialSize.src)}" width="${initialSize.width}" height="${initialSize.height}"></iframe>
            </div>
          </div>
        </article>
      </section>
    </main>
    <script>
      (function() {
        var STORAGE_KEY = ${jsString('sse-dco-client-preview:' + slug)};
        var defaults = ${jsString(initialRow)};
        var defaultSize = ${jsString(initialSize.size)};
        var sizes = ${jsString(sizes)};
        var controls = document.getElementById('controls');
        var frame = document.querySelector('[data-ad-frame]');
        var frames = frame ? [frame] : [];
        var activeSizeLabel = document.querySelector('[data-active-size-label]');
        var activeDimensions = document.querySelector('[data-active-dimensions]');
        var replayButton = document.getElementById('replay-ad');
        var restoreDefaultsButton = document.getElementById('restore-defaults');
        var previewZoom = 'fit';
        var persistEnabled = false;
        var ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
        var backgroundSizes = ${jsString(CREATIVE_AD_SIZES)};
        var backgroundBySize = {};
        var trackedBackgroundSize = defaultSize || '';

        function previewImageFieldUrl(value) {
          if (value && typeof value === 'object' && value.Url !== undefined) {
            return String(value.Url || '').trim();
          }
          return String(value == null ? '' : value).trim();
        }

        function resetBackgroundMapFromDefaults() {
          backgroundSizes.forEach(function(size) {
            var fieldName = 'background_image_url_' + size;
            backgroundBySize[size] = previewImageFieldUrl(defaults[fieldName])
              || previewImageFieldUrl(defaults.background_image_url)
              || '';
          });
        }

        resetBackgroundMapFromDefaults();

        function syncBackgroundControl() {
          var input = document.querySelector('[name="background_image_url"]');
          if (input) input.value = backgroundBySize[trackedBackgroundSize] || '';
        }

        function field(name) {
          var control = controls.elements[name] || document.querySelector('[name="' + name + '"]');
          if (control && control.type === 'checkbox') return control.checked ? 'true' : 'false';
          return control ? control.value : defaults[name] || '';
        }

        function setControl(name, value) {
          var control = controls.elements[name];
          if (!control) return;
          if (control.type === 'checkbox') {
            control.checked = value === true || value === 'true' || value === 1 || value === '1';
            return;
          }
          control.value = value == null ? '' : String(value);
        }

        function selectedSizeMeta() {
          var selected = field('Ad_Size');
          return sizes.find(function(item) {
            return item.size === selected;
          }) || sizes[0];
        }

        function sizeExists(size) {
          return sizes.some(function(item) { return item.size === size; });
        }

        function rowFromControls() {
          backgroundBySize[trackedBackgroundSize] = field('background_image_url');
          var includeRoundelFrame = field('include_roundel_frame_bool') === 'true';
          var ctaType = includeRoundelFrame ? 'rectangle' : field('cta_type_enum');
          if (includeRoundelFrame && controls.elements.cta_type_enum) {
            controls.elements.cta_type_enum.value = 'rectangle';
          }
          var row = {
            heading1_text: field('heading1_text'),
            heading2_text: field('heading2_text'),
            heading3_text: field('heading3_text'),
            heading4_text: field('heading4_text'),
            offer_count_num: (function(value) {
              var parsed = parseInt(value, 10);
              if (!isFinite(parsed)) return 1;
              return Math.min(3, Math.max(0, parsed));
            })(field('offer_count_num')),
            offer1_value_text: field('offer1_value_text'),
            offer1_sub_text: field('offer1_sub_text'),
            offer2_value_text: field('offer2_value_text'),
            offer2_sub_text: field('offer2_sub_text'),
            offer3_value_text: field('offer3_value_text'),
            offer3_sub_text: field('offer3_sub_text'),
            cta_type_enum: ctaType,
            cta_text: field('cta_text'),
            include_roundel_frame_bool: includeRoundelFrame ? 'true' : 'false',
            roundel_text_text: field('roundel_text_text'),
            roundel_value_text: field('roundel_value_text'),
            tc_type_enum: field('tc_type_enum'),
            tc_terms_text: field('tc_terms_text'),
            tc_units_text: field('tc_units_text'),
          };
          backgroundSizes.forEach(function(size) {
            row['background_image_url_' + size] = previewImageFieldUrl(backgroundBySize[size]) || '';
          });
          return row;
        }

        function syncOfferControls(row) {
          Array.prototype.forEach.call(document.querySelectorAll('[data-offer-block]'), function(block) {
            block.classList.toggle('is-hidden', Number(block.dataset.offerBlock) > Number(row.offer_count_num));
          });
        }

        function syncHeadlineControls(row) {
          var heading3Field = document.querySelector('[data-heading3-field]');
          var heading3Input = document.querySelector('[name="heading3_text"]');
          var enabled = row.include_roundel_frame_bool === 'true';
          if (heading3Field) {
            heading3Field.classList.toggle('is-disabled', !enabled);
          }
          if (heading3Input) {
            heading3Input.disabled = !enabled;
          }
        }

        function applyRowToControls(row, size) {
          var nextSize = sizeExists(size) ? size : (defaultSize || (sizes[0] && sizes[0].size) || '');
          setControl('Ad_Size', nextSize);
          trackedBackgroundSize = nextSize;
          setControl('heading1_text', row.heading1_text);
          setControl('heading2_text', row.heading2_text);
          setControl('heading3_text', row.heading3_text);
          setControl('heading4_text', row.heading4_text);
          setControl('offer_count_num', row.offer_count_num);
          setControl('offer1_value_text', row.offer1_value_text);
          setControl('offer1_sub_text', row.offer1_sub_text);
          setControl('offer2_value_text', row.offer2_value_text);
          setControl('offer2_sub_text', row.offer2_sub_text);
          setControl('offer3_value_text', row.offer3_value_text);
          setControl('offer3_sub_text', row.offer3_sub_text);
          setControl('cta_type_enum', row.cta_type_enum);
          setControl('cta_text', row.cta_text);
          setControl('include_roundel_frame_bool', row.include_roundel_frame_bool);
          setControl('roundel_text_text', row.roundel_text_text);
          setControl('roundel_value_text', row.roundel_value_text);
          setControl('tc_type_enum', row.tc_type_enum);
          setControl('tc_terms_text', row.tc_terms_text);
          setControl('tc_units_text', row.tc_units_text);
          syncBackgroundControl();
          syncOfferControls(row);
          syncHeadlineControls(row);
        }

        function readStoredState() {
          try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
          } catch (error) {
            return null;
          }
        }

        function writeStoredState() {
          if (!persistEnabled) return;
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
              size: field('Ad_Size'),
              zoom: previewZoom,
              row: rowFromControls(),
              backgroundBySize: backgroundBySize,
            }));
          } catch (error) {}
        }

        function restoreDefaults() {
          resetBackgroundMapFromDefaults();
          applyRowToControls(defaults, defaultSize);
          previewZoom = 'fit';
          updateZoomButtons();
          try {
            window.localStorage.removeItem(STORAGE_KEY);
          } catch (error) {}
          updateAds();
        }

        function hydrateFromStorageOrDefaults() {
          var stored = readStoredState();
          if (stored && stored.row && typeof stored.row === 'object') {
            if (stored.backgroundBySize && typeof stored.backgroundBySize === 'object') {
              backgroundSizes.forEach(function(size) {
                if (Object.prototype.hasOwnProperty.call(stored.backgroundBySize, size)) {
                  backgroundBySize[size] = previewImageFieldUrl(stored.backgroundBySize[size]);
                }
              });
            } else {
              backgroundSizes.forEach(function(size) {
                var fieldName = 'background_image_url_' + size;
                if (stored.row[fieldName] != null) {
                  backgroundBySize[size] = previewImageFieldUrl(stored.row[fieldName]);
                }
              });
            }
            applyRowToControls(stored.row, stored.size || defaultSize);
            if (stored.zoom === 'fit' || ZOOM_LEVELS.indexOf(Number(stored.zoom)) !== -1) {
              previewZoom = stored.zoom === 'fit' ? 'fit' : Number(stored.zoom);
            }
            return;
          }
          applyRowToControls(defaults, defaultSize);
        }

        function sendRow(frame, row) {
          if (!frame.contentWindow) return;
          frame.contentWindow.postMessage({ type: 'SSE_DCO_PREVIEW_STATE', row: row }, '*');
        }

        function loadActiveAd(forceReplay) {
          if (!frame) return;
          var meta = selectedSizeMeta();
          if (!meta) return;
          if (activeSizeLabel) activeSizeLabel.textContent = meta.size;
          if (activeDimensions) activeDimensions.textContent = meta.width + ' x ' + meta.height;
          frame.title = 'SSE DCO ' + meta.size;
          frame.setAttribute('width', meta.width);
          frame.setAttribute('height', meta.height);
          var currentSrc = (frame.getAttribute('src') || '').split('?')[0];
          if (forceReplay || currentSrc !== meta.src) {
            frame.setAttribute('src', meta.src + (forceReplay ? '?replay=' + Date.now() : ''));
          }
          fitAdFrames();
        }

        function zoomLabel(zoom) {
          if (zoom === 'fit') return 'Fit';
          if (zoom === 1) return '1x';
          if (zoom === 2) return '2x';
          return Math.round(Number(zoom) * 100) + '%';
        }

        function updateZoomButtons() {
          Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-mode]'), function(button) {
            var mode = button.getAttribute('data-zoom-mode');
            var pressed = mode === 'fit'
              ? previewZoom === 'fit'
              : Number(mode) === Number(previewZoom);
            button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          });
          var readout = document.querySelector('[data-zoom-readout]');
          if (readout) readout.textContent = zoomLabel(previewZoom);
        }

        function setPreviewZoom(next) {
          previewZoom = next;
          updateZoomButtons();
          fitAdFrames();
          writeStoredState();
        }

        function nextZoomLevel(current, direction) {
          var index = ZOOM_LEVELS.findIndex(function(level) { return level >= current; });
          if (index < 0) index = ZOOM_LEVELS.length - 1;
          if (direction > 0) {
            return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, current >= ZOOM_LEVELS[index] ? index + 1 : index)];
          }
          return ZOOM_LEVELS[Math.max(0, current <= ZOOM_LEVELS[index] ? index - 1 : index)];
        }

        function previewScale(frameWidth, frameHeight, viewport) {
          if (previewZoom === 'fit') {
            var availableWidth = Math.max(1, viewport.clientWidth - 2);
            var availableHeight = Math.max(1, viewport.clientHeight - 2);
            return Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);
          }
          return Number(previewZoom);
        }

        function fitAdFrames() {
          frames.forEach(function(frame) {
            var shell = frame.closest('[data-ad-frame-shell]');
            var viewport = frame.closest('.ad-viewport');
            if (!shell || !viewport) return;
            var frameWidth = Number(frame.getAttribute('width')) || frame.offsetWidth || 1;
            var frameHeight = Number(frame.getAttribute('height')) || frame.offsetHeight || 1;
            var scale = previewScale(frameWidth, frameHeight, viewport);
            shell.style.width = Math.ceil(frameWidth * scale) + 'px';
            shell.style.height = Math.ceil(frameHeight * scale) + 'px';
            frame.style.width = frameWidth + 'px';
            frame.style.height = frameHeight + 'px';
            frame.style.transform = 'scale(' + scale + ')';
          });
        }

        function updateAds() {
          var row = rowFromControls();
          syncOfferControls(row);
          syncHeadlineControls(row);
          loadActiveAd(false);
          fitAdFrames();
          frames.forEach(function(frame) {
            sendRow(frame, row);
          });
          writeStoredState();
        }

        function replayAd() {
          loadActiveAd(true);
        }

        controls.addEventListener('input', updateAds);
        controls.addEventListener('change', function(event) {
          if (event.target && event.target.name === 'Ad_Size') {
            backgroundBySize[trackedBackgroundSize] = field('background_image_url');
            trackedBackgroundSize = field('Ad_Size');
            syncBackgroundControl();
          }
          updateAds();
        });
        frames.forEach(function(frame) {
          frame.addEventListener('load', updateAds);
        });
        if (replayButton) replayButton.addEventListener('click', replayAd);
        if (restoreDefaultsButton) restoreDefaultsButton.addEventListener('click', restoreDefaults);
        Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-mode]'), function(button) {
          button.addEventListener('click', function() {
            var mode = button.getAttribute('data-zoom-mode');
            setPreviewZoom(mode === 'fit' ? 'fit' : Number(mode));
          });
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-step]'), function(button) {
          button.addEventListener('click', function() {
            var direction = Number(button.getAttribute('data-zoom-step'));
            var current = previewZoom === 'fit' ? 1 : Number(previewZoom);
            setPreviewZoom(nextZoomLevel(current, direction));
          });
        });
        window.addEventListener('resize', fitAdFrames);
        hydrateFromStorageOrDefaults();
        updateZoomButtons();
        fitAdFrames();
        persistEnabled = true;
        updateAds();
      })();
    </script>
${includeValidator ? `    <script>
      window.__SSE_DCO_CLIENT_PREVIEW__ = ${jsString({
        sizes,
        fields: clientValidationFields(),
      })};
    </script>
    <script src="preview-validator.js"></script>` : ''}
  </body>
</html>
`;
};

export const buildClientPreviewPackageEntries = async (document: Record<string, unknown>, options: ClientPreviewPackageOptions = {}) => {
  const renderMode = options.renderMode || 'font';
  const includeValidator = options.includeValidator !== false && renderMode === 'font';
  const useCdnAssets = options.assetMode === 'cdn';
  const slug = exportSlugForDocument(document);
  const assetUrlMap = useCdnAssets ? CDN_ASSET_URLS : undefined;
  const fontUrlMap = renderMode === 'outline' ? undefined : (useCdnAssets ? CDN_FONT_URLS : undefined);
  const entries: PackageEntry[] = [];
  const sizes = Object.keys(document.sizes || {});
  for (const size of sizes) {
    const baseHtml = await renderStudioReadyHtml(document, size, {
      assetBasePath: '../',
      assetUrlMap,
      fontBasePath: renderMode === 'outline' ? undefined : '../assets/fonts/',
      fontUrlMap,
      previewValidatorScriptPath: includeValidator ? '../../preview-validator.js' : undefined,
      renderMode,
      presentationSnapshot: options.presentationSnapshots?.[size] || null,
    });
    entries.push({
      path: `ads/html/${slug}_${size}.html`,
      data: baseHtml,
    });
    if (renderMode === 'font') {
      for (const variant of clientVariantMatrix(document)) {
        const row = rowForClientVariant(document, variant);
        entries.push({
          path: `ads/html/${slug}_${size}_${clientVariantSlug(variant)}.html`,
          data: renderWipHtml(baseHtml, row),
        });
      }
    }
  }

  for (const assetPath of collectClientAssetPaths(document)) {
    if (assetUrlMap?.[assetPath]) continue;
    // Outline HTML inlines SVGs as data URIs — don't ship duplicate files.
    if (renderMode === 'outline' && isSvgAssetPath(assetPath)) continue;
    entries.push({
      path: `ads/${assetPath}`,
      data: await fs.readFile(path.resolve(projectRoot, assetPath)),
    });
  }

  if (renderMode === 'font') {
    for (const font of CLIENT_FONT_FILES) {
      if (fontUrlMap?.[font.filename]) continue;
      entries.push({
        path: `ads/assets/fonts/${font.filename}`,
        data: await fs.readFile(await font.resolveSourcePath()),
      });
    }
  }

  for (const brandFile of CLIENT_PREVIEW_BRAND_FILES) {
    entries.push({
      path: brandFile.path,
      data: await fs.readFile(brandFile.sourcePath()),
    });
  }

  entries.push({
    path: 'preview-page.html',
    data: renderClientPreviewPage(document, { includeValidator }),
  });

  if (includeValidator) {
    entries.push({
      path: 'preview-validator.js',
      data: renderClientPreviewValidatorScript(),
    });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
};

export const buildBasePackageEntries = async (document: Record<string, unknown>, options: BasePackageOptions = {}) => {
  const assetMode = options.assetMode || 'packaged';
  const useCdnAssets = assetMode === 'cdn';
  const useEmbedAssets = assetMode === 'embed';
  const useCanonicalAgency = assetMode === 'canonical-agency';
  const inlineSvgs = useEmbedAssets || useCanonicalAgency;
  const useCdnFont = useCdnAssets || useEmbedAssets || useCanonicalAgency;
  const renderMode = options.renderMode || 'font';
  const assetUrlMap = inlineSvgs
    ? buildEmbedSvgAssetUrlMap(document)
    : useCdnAssets
      ? CDN_ASSET_URLS
      : undefined;
  const fontUrlMap = renderMode === 'outline'
    ? undefined
    : (useCdnFont ? CDN_FONT_URLS : undefined);
  const entries: PackageEntry[] = [];
  const sizes = Object.keys(document.sizes || {});
  // Canonical (embed): `{size}.html` + `assets/` at zip root.
  // Agency packaged/CDN/canonical-agency: `ads/{size}/index.html` (+ optional `ads/assets/`).
  const htmlPathForSize = (size: string) => (
    useEmbedAssets ? `${size}.html` : `ads/${size}/index.html`
  );
  const packagedAssetEntryPath = (assetPath: string) => (
    useEmbedAssets ? assetPath : `ads/${assetPath}`
  );
  const assetBasePath = useEmbedAssets ? '' : '../';
  const fontBasePath = renderMode === 'outline'
    ? undefined
    : (useEmbedAssets ? 'assets/fonts/' : '../assets/fonts/');

  for (const size of sizes) {
    entries.push({
      path: htmlPathForSize(size),
      data: await renderStudioReadyHtml(document, size, {
        assetBasePath,
        assetUrlMap,
        // Fonts with a CDN_FONT_URLS entry use that absolute URL and are not
        // packaged; anything unmapped stays relative under assets/fonts/.
        fontBasePath,
        fontUrlMap,
        // Embed/canonical ships bg JPEGs beside the HTML; Studio can still
        // override via data-dco-field. Agency modes leave src empty for feed-only bgs.
        includePackagedBackground: useEmbedAssets,
        includePreviewBridge: false,
        includeStudioDynamicContent: renderMode === 'font',
        // Embed: packaged relative bg paths. Canonical-agency: empty (feed only).
        // Packaged/CDN: default hiker CDN sample for Studio preview.
        studioBackgroundUrlForSize: useEmbedAssets
          ? (adSize) => {
            const sizeCreative = (document.sizes || {})[adSize] as
              | { assets?: { background?: string } }
              | undefined;
            return String(sizeCreative?.assets?.background || '');
          }
          : useCanonicalAgency
            ? () => ''
            : undefined,
        renderMode,
        presentationSnapshot: options.presentationSnapshots?.[size] || null,
      }),
    });
  }

  // Embed: package non-SVG assets (backgrounds) at `assets/…`.
  // Packaged: SVGs/fonts under `ads/assets/` (bgs from Studio feed); outline
  // skips SVGs because renderStudioReadyHtml inlines them.
  // CDN / canonical-agency: no static assets in the ZIP (SVGs inlined or CDN).
  const packagedAssetPaths = useEmbedAssets
    ? collectClientAssetPaths(document).filter((assetPath) => !isSvgAssetPath(assetPath))
    : (useCdnAssets || useCanonicalAgency)
      ? []
      : collectBasePackageAssetPaths(document).filter((assetPath) => (
        renderMode !== 'outline' || !isSvgAssetPath(assetPath)
      ));
  for (const assetPath of packagedAssetPaths) {
    if (assetUrlMap?.[assetPath]) continue;
    entries.push({
      path: packagedAssetEntryPath(assetPath),
      data: await fs.readFile(path.resolve(projectRoot, assetPath)),
    });
  }

  if (renderMode === 'font') {
    for (const font of CLIENT_FONT_FILES) {
      if (fontUrlMap?.[font.filename]) continue;
      entries.push({
        path: useEmbedAssets
          ? `assets/fonts/${font.filename}`
          : `ads/assets/fonts/${font.filename}`,
        data: await fs.readFile(await font.resolveSourcePath()),
      });
    }
  }

  entries.push({
    path: 'mapping.txt',
    data: renderMappingTxt(),
  });

  return entries.sort((a, b) => a.path.localeCompare(b.path));
};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (buffer: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = () => {
  const date = new Date();
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, day };
};

export const createZipBuffer = (entries: PackageEntry[]) => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const { time, day } = dosDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.path.replace(/^\/+/, '').replace(/\\/g, '/'));
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data));
    const crc = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
};

export const buildClientPreviewZip = async (document: Record<string, unknown>, options: ClientPreviewPackageOptions = {}) => (
  createZipBuffer(await buildClientPreviewPackageEntries(document, options))
);

export const buildBasePackageZip = async (document: Record<string, unknown>, options: BasePackageOptions = {}) => (
  createZipBuffer(await buildBasePackageEntries(document, options))
);
