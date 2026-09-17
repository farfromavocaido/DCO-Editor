import { MUSEO_CDN_URL, MUSEO_FONT_FILENAME } from './brand-font';

export type CampaignFontFace = {
  id: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
  asset: string;
  cdnUrl?: string;
};
export type CampaignFontStyle = { fontFamily?: unknown; fontWeight?: unknown; fontStyle?: unknown };
const legacyFace: CampaignFontFace = { id: 'museo-700-normal', family: 'Museo', weight: 700, style: 'normal', asset: `fonts/${MUSEO_FONT_FILENAME}`, cdnUrl: MUSEO_CDN_URL };
const familyKey = (value: unknown) => String(value ?? '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
export const fontWeightNumber = (value: unknown, fallback = 400) => value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value) || fallback;

/** Absent registry is a read-only compatibility view; never materialize it on load/save. */
export function campaignFontFaces(document: { fonts?: unknown }): CampaignFontFace[] {
  if (document.fonts === undefined) return [{ ...legacyFace }];
  validateCampaignFonts(document);
  return (document.fonts as CampaignFontFace[]).map(face => ({ ...face }));
}
export function validateCampaignFonts(document: { fonts?: unknown }) {
  if (document.fonts === undefined) return;
  if (!Array.isArray(document.fonts)) throw new Error('Fonts must be an array');
  const ids = new Set<string>(); const faces = new Set<string>();
  for (const candidate of document.fonts) {
    const face = candidate as CampaignFontFace;
    if (!face || typeof face.id !== 'string' || !face.id.trim() || ids.has(face.id)) throw new Error('Each font needs a unique id');
    if (typeof face.family !== 'string' || !face.family.trim() || /[<>\r\n]/.test(face.family)) throw new Error('Font family is required and must be plain text');
    if (!Number.isInteger(face.weight) || face.weight < 1 || face.weight > 1000) throw new Error('Font weight must be between 1 and 1000');
    if (!['normal', 'italic', 'oblique'].includes(face.style)) throw new Error('Font style must be normal, italic or oblique');
    if (typeof face.asset !== 'string' || !/^fonts\/[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(otf|ttf|woff)$/i.test(face.asset)) throw new Error('Font asset must be a local fonts/ OTF, TTF or WOFF file');
    if (face.cdnUrl) {
      let url: URL; try { url = new URL(face.cdnUrl); } catch { throw new Error('Font CDN URL must be an absolute HTTP(S) URL'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Font CDN URL must be an absolute HTTP(S) URL without credentials');
    }
    const key = `${familyKey(face.family)}:${face.weight}:${face.style}`;
    if (faces.has(key)) throw new Error(`Duplicate font face: ${face.family} ${face.weight} ${face.style}`);
    ids.add(face.id); faces.add(key);
  }
}
export function resolveCampaignFontFace(document: { fonts?: unknown }, values: CampaignFontStyle): CampaignFontFace {
  const faces = campaignFontFaces(document);
  // Legacy documents relied on Museo even where inherited weight was omitted.
  if (document.fonts === undefined) return faces[0];
  const family = familyKey(values.fontFamily ?? faces[0]?.family);
  const familyFaces = faces.filter(item => familyKey(item.family) === family);
  // Existing creative layers may omit weight. Preserve their established face
  // when a campaign later registers additional weights for that family.
  const weight = fontWeightNumber(values.fontWeight, familyFaces[0]?.weight ?? 400);
  const style = String(values.fontStyle || 'normal');
  const face = faces.find(item => familyKey(item.family) === family && item.weight === weight && item.style === style)
    // A normal-weight browser run uses the sole registered face without synthesising bold.
    || (weight === 400 && familyFaces.length === 1 && familyFaces[0].style === style ? familyFaces[0] : undefined);
  if (!face) throw new Error(`Font face unavailable: ${String(values.fontFamily || family)} ${weight} ${style}`);
  return face;
}
export const campaignFontAssetUrl = (face: CampaignFontFace) => `/assets/${face.asset.split('/').map(encodeURIComponent).join('/')}`;
const cssString = (value: string) => JSON.stringify(value).replace(/</g, '\\3c ');
export function campaignFontFaceCss(document: { fonts?: unknown }, source: 'local' | 'cdn' | ((face: CampaignFontFace) => string) = 'local') {
  return campaignFontFaces(document).map(face => {
    const url = typeof source === 'function' ? source(face) : source === 'cdn' ? face.cdnUrl : campaignFontAssetUrl(face);
    if (!url) throw new Error(`No CDN URL configured for ${face.family} ${face.weight} ${face.style}`);
    return `@font-face{font-family:${cssString(face.family)};src:url(${cssString(url)});font-weight:${face.weight};font-style:${face.style};font-display:block;}`;
  }).join('\n');
}
