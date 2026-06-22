// @ts-nocheck

/** Canonical ad sizes — keep in sync with creative document keys. */
export const CREATIVE_AD_SIZES = [
  '160x600',
  '300x250',
  '300x600',
  '320x50',
  '728x90',
  '970x250',
] as const;

export type CreativeAdSize = (typeof CREATIVE_AD_SIZES)[number];

export const backgroundImageFieldName = (size: string) => `background_image_url_${size}`;

export const isBackgroundImageField = (name: string) => (
  name === 'background_image_url' || /^background_image_url_/.test(name)
);

export const backgroundImageFieldDefinitions = () => CREATIVE_AD_SIZES.map((size) => ({
  name: backgroundImageFieldName(size),
  label: `Background ${size}`,
  type: 'image' as const,
  group: 'Assets',
  description: `Optional background image URL for ${size}. Leave blank to use the packaged default.`,
}));

export const emptyBackgroundImageValue = () => ({ Url: '' });

export const imageFieldUrl = (value: unknown) => {
  if (value && typeof value === 'object' && 'Url' in value) {
    return String((value as { Url?: string }).Url || '').trim();
  }
  return String(value ?? '').trim();
};

export const backgroundImageUrlForSize = (
  row: Record<string, unknown> | null | undefined,
  size: string,
) => {
  const sized = imageFieldUrl(row?.[backgroundImageFieldName(size)]);
  if (sized) return sized;
  return imageFieldUrl(row?.background_image_url);
};

export const backgroundFieldsFromRow = (row: Record<string, unknown> = {}) => {
  const out: Record<string, { Url: string }> = {};
  for (const size of CREATIVE_AD_SIZES) {
    const name = backgroundImageFieldName(size);
    out[name] = { Url: imageFieldUrl(row[name] ?? row.background_image_url) };
  }
  return out;
};

/** Agency Studio dev-sample backgrounds (Profile 10960467 / hiker set). Used in export snippets when feed Url is blank. */
export const STUDIO_DEV_SAMPLE_BACKGROUND_URLS: Partial<Record<CreativeAdSize, string>> = {
  '160x600': 'https://s0.2mdn.net/creatives/assets/5656026/160x600_hiker.jpg',
  '300x250': 'https://s0.2mdn.net/creatives/assets/5656026/300x250_hiker.jpg',
  '300x600': 'https://s0.2mdn.net/creatives/assets/5656026/300x600_hiker.jpg',
  '728x90': 'https://s0.2mdn.net/creatives/assets/5656026/728x90_hiker.jpg',
  '970x250': 'https://s0.2mdn.net/creatives/assets/5656026/970x250_hiker.jpg',
};

export const studioDevBackgroundUrl = (size: string, rowValue: unknown) => {
  const url = imageFieldUrl(rowValue);
  if (url) return url;
  return STUDIO_DEV_SAMPLE_BACKGROUND_URLS[size as CreativeAdSize] || '';
};
