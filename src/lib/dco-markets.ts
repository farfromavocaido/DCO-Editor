import { CREATIVE_AD_SIZES } from '@/lib/feed-background';

export type DcoMarketId = 'roi' | 'ni';

export type StudioDateValue = {
  RawValue: string;
  UtcValue: number;
};

export type StudioUrlValue = {
  Url: string;
};

export type DcoStudioSample = {
  _id: number;
  Unique_ID: string;
  Reporting_label: string;
  Increment: number;
  Region: string[];
  Audience: string[];
  Partner: string[];
  Campaign_type: string[];
  Product: string[];
  Preview_Active: boolean;
  Start_Date: StudioDateValue;
  End_Date: StudioDateValue;
  _00_Exit_URL: StudioUrlValue;
  heading1_text: string;
  heading2_text: string;
  heading3_text: string;
  heading4_text: string;
  offer_count_num: number;
  offer1_value_text: string;
  offer1_sub_text: string;
  offer2_value_text: string;
  offer2_sub_text: string;
  offer3_value_text: string;
  offer3_sub_text: string;
  tc_type_enum: string;
  tc_terms_text: string;
  tc_units_text: string;
  cta_type_enum: string;
  cta_text: string;
  include_roundel_frame_bool: boolean;
  roundel_text_text: string;
  roundel_value_text: string;
  include_heading4_enum: boolean;
  background_image_label: string;
  [key: string]: unknown;
};

export type DcoMarket = {
  id: DcoMarketId;
  label: string;
  profileId: number;
  profileElement: string;
  zipPrefix: string;
  outputsDir: string;
  studioSample: DcoStudioSample;
};

const DIY_BACKGROUND_ASSET_ROOT = 'https://s0.2mdn.net/creatives/assets/5648161';

const emptySizeTextOverrides = () => {
  const out: Record<string, string> = {};
  for (const base of [
    'heading1_text',
    'heading2_text',
    'heading3_text',
    'heading4_text',
    'tc_units_text',
  ]) {
    for (const size of CREATIVE_AD_SIZES) {
      out[`${base}_${size}`] = '';
    }
  }
  return out;
};

const diyBackgroundUrls = () => {
  const out: Record<string, StudioUrlValue> = {};
  for (const size of CREATIVE_AD_SIZES) {
    out[`background_image_url_${size}`] = {
      Url: `${DIY_BACKGROUND_ASSET_ROOT}/${size}_diy.jpg`,
    };
  }
  return out;
};

/** Official Studio enable-row for profile 10964545 / SSE_DCO_ROI_Delivery. */
const ROI_STUDIO_SAMPLE: DcoStudioSample = {
  _id: 0,
  Unique_ID: 'Adsu_ROI_Prospecting-Main-1_diy',
  Reporting_label: 'AlwaysOn_ADKE-DCO Launch_E_diy_30pcEle_upto-518_rect_TC-only',
  Increment: 1,
  Region: ['ROI'],
  Audience: ['Prospecting-Main'],
  Partner: ['Adsure'],
  Campaign_type: ['AlwaysOn'],
  Product: ['Elec'],
  Preview_Active: true,
  Start_Date: {
    RawValue: '06/01/2026 00:00+08:00',
    UtcValue: 1780243200000,
  },
  End_Date: {
    RawValue: '12/31/2026 00:00+08:00',
    UtcValue: 1798646400000,
  },
  _00_Exit_URL: {
    Url: 'https://sseairtricity.com/ie/home/products/electricity-top-discount?utm_campaign=SSE_DCO&utm_medium=display&utm_term=sse533&utm_content=AlwaysOn',
  },
  heading1_text: 'BIG DEAL energy ',
  heading2_text: 'A different kind of energy',
  heading3_text: 'Saving you',
  heading4_text: 'BIG DEAL energy',
  offer_count_num: 1,
  offer1_value_text: '30%',
  offer1_sub_text: 'OFF ELECTRICITY*',
  offer2_value_text: '',
  offer2_sub_text: '',
  offer3_value_text: '',
  offer3_sub_text: '',
  tc_type_enum: 'tcs_only',
  tc_terms_text: 'T&Cs apply',
  tc_units_text: '',
  cta_type_enum: 'rectangle',
  cta_text: 'Switch now',
  include_roundel_frame_bool: true,
  roundel_text_text: 'Up to',
  roundel_value_text: '\u20AC518',
  include_heading4_enum: true,
  background_image_label: 'diy',
  ...diyBackgroundUrls(),
  ...emptySizeTextOverrides(),
  heading2_text_320x50: 'A different kind <br> of energy',
};

/** Official Studio enable-row for profile 10962603 / SSE_DCO_NIR_Delivery. */
const NIR_STUDIO_SAMPLE: DcoStudioSample = {
  _id: 0,
  Unique_ID: 'Adsu_NIR_Prospecting-Main-1_diy',
  Reporting_label: 'AlwaysOn_ADKE-DCO Launch_E_diy_15pcEle_nu_rect_TC-only',
  Increment: 1,
  Region: ['NIR'],
  Audience: ['Prospecting-Main'],
  Partner: ['Adsure'],
  Campaign_type: ['AlwaysOn'],
  Product: ['Elec'],
  Preview_Active: true,
  Start_Date: {
    RawValue: '06/01/2026 00:00+08:00',
    UtcValue: 1780243200000,
  },
  End_Date: {
    RawValue: '12/31/2026 00:00+08:00',
    UtcValue: 1798646400000,
  },
  _00_Exit_URL: {
    Url: 'https://sseairtricity.com/ie/home/products/electricity-top-discount?utm_campaign=SSE_DCO&utm_medium=display&utm_term=sse533&utm_content=AlwaysOn',
  },
  heading1_text: 'Our very best discount',
  heading2_text: 'A different kind of energy',
  heading3_text: '',
  heading4_text: 'A different kind of energy',
  offer_count_num: 1,
  offer1_value_text: '15%',
  offer1_sub_text: 'OFF ELECTRICITY*',
  offer2_value_text: '',
  offer2_sub_text: '',
  offer3_value_text: '',
  offer3_sub_text: '',
  tc_type_enum: 'tcs_units',
  tc_terms_text: '*T&Cs apply',
  tc_units_text: 'Electricity unit rate: 34.67 Inc Vat 33.02 Ex Vat',
  cta_type_enum: 'rectangle',
  cta_text: 'Switch now',
  include_roundel_frame_bool: false,
  roundel_text_text: '',
  roundel_value_text: '',
  include_heading4_enum: true,
  background_image_label: 'diy',
  ...diyBackgroundUrls(),
  ...emptySizeTextOverrides(),
  heading2_text_320x50: 'A different kind <br> of energy',
  heading4_text_320x50: 'A different kind <br> of energy',
};

/**
 * Studio market bindings for the same SSE DCO creative.
 * Schema is identical; profile id / element / sample row differ (ROI vs NIR).
 */
export const DCO_MARKETS: DcoMarket[] = [
  {
    id: 'roi',
    label: 'ROI',
    profileId: 10964545,
    profileElement: 'SSE_DCO_ROI_Delivery',
    zipPrefix: 'SSE_DCO_ROI_canonical_agency',
    outputsDir: 'sse-dco',
    studioSample: ROI_STUDIO_SAMPLE,
  },
  {
    id: 'ni',
    label: 'NI',
    profileId: 10962603,
    profileElement: 'SSE_DCO_NIR_Delivery',
    zipPrefix: 'SSE_DCO_NIR_canonical_agency',
    outputsDir: 'sse-dco-nir',
    studioSample: NIR_STUDIO_SAMPLE,
  },
];

export const DEFAULT_DCO_MARKET_ID: DcoMarketId = 'roi';

const byId = new Map(DCO_MARKETS.map((market) => [market.id, market]));

export const listDcoMarkets = () => DCO_MARKETS;

export const getDcoMarket = (id: string | null | undefined): DcoMarket => {
  const market = byId.get((id || DEFAULT_DCO_MARKET_ID) as DcoMarketId);
  if (!market) throw new Error(`Unknown DCO market: ${id}`);
  return market;
};

export const isDcoMarketId = (value: string | null | undefined): value is DcoMarketId => (
  Boolean(value && byId.has(value as DcoMarketId))
);

/** Snippet field order matches Studio’s HTML5 enable code (easier agency diffs). */
export const STUDIO_DEV_DYNAMIC_FIELD_ORDER = [
  '_id',
  'Unique_ID',
  'Reporting_label',
  'Increment',
  'Region',
  'Audience',
  'Partner',
  'Campaign_type',
  'Product',
  'Preview_Active',
  'Start_Date',
  'End_Date',
  '_00_Exit_URL',
  'heading1_text',
  'heading2_text',
  'heading3_text',
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
  'heading4_text',
  'include_heading4_enum',
  'background_image_label',
  ...CREATIVE_AD_SIZES.map((size) => `background_image_url_${size}`),
  ...['heading1_text', 'heading2_text', 'heading3_text', 'heading4_text', 'tc_units_text']
    .flatMap((base) => CREATIVE_AD_SIZES.map((size) => `${base}_${size}`)),
] as const;
