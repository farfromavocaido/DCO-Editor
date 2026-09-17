import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { campaignFontFaces, validateCampaignFonts, type CampaignFontFace } from '@/lib/campaign-fonts';
import { projectRoot } from './paths';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js') as typeof import('opentype.js');
const MAX_FONT_BYTES = 20 * 1024 * 1024;
export const campaignFontPath = (face: CampaignFontFace) => {
  validateCampaignFonts({ fonts: [face] });
  return path.join(projectRoot, 'assets', face.asset);
};
export function parseFontBytes(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_FONT_BYTES) throw new Error('Font must be between 1 byte and 20 MB');
  try { return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer); }
  catch { throw new Error('Font could not be parsed; use a valid OTF, TTF or WOFF file'); }
}
export function fontMetadata(font: ReturnType<typeof parseFontBytes>) {
  const tables = font.tables as Record<string, Record<string, number>>;
  return { family: (font.names as unknown as Record<string, { en?: string }>).preferredFamily?.en || font.names.fontFamily?.en || 'Unnamed font', weight: tables.os2?.usWeightClass || 400, style: ((tables.os2?.fsSelection || 0) & 1 || (tables.post?.italicAngle || 0) !== 0 ? 'italic' : 'normal') as 'normal' | 'italic' };
}
function checkFaceMetadata(face: CampaignFontFace, font: ReturnType<typeof parseFontBytes>) {
  const meta = fontMetadata(font);
  // CSS face descriptors are authored mappings. Internal weight/style metadata
  // supplies upload defaults, but does not override a campaign's established mapping.
  return meta;
}
const parsedFonts = new Map<string, { stamp: string; font: ReturnType<typeof parseFontBytes> }>();
export async function loadCampaignFont(face: CampaignFontFace) {
  const filename = campaignFontPath(face);
  const stat = await fs.stat(filename);
  const stamp = `${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  const cached = parsedFonts.get(filename);
  const font = cached?.stamp === stamp ? cached.font : parseFontBytes(await fs.readFile(filename));
  if (cached?.stamp !== stamp) parsedFonts.set(filename, { stamp, font });
  checkFaceMetadata(face, font);
  return font;
}
export async function validateCampaignFontFiles(document: { fonts?: unknown }) {
  for (const face of campaignFontFaces(document)) await loadCampaignFont(face);
}
export async function verifyCampaignFontCdn(face: CampaignFontFace) {
  const local = await fs.readFile(campaignFontPath(face));
  const metadata = checkFaceMetadata(face, parseFontBytes(local));
  if (!face.cdnUrl) throw new Error('Configure a CDN URL before verifying');
  const response = await fetch(face.cdnUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Font CDN returned HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Font CDN returned no file');
  const chunks: Uint8Array[] = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_FONT_BYTES) throw new Error('CDN font exceeds 20 MB'); chunks.push(value); } }
  finally { await reader.cancel(); }
  const remote = Buffer.concat(chunks); parseFontBytes(remote);
  const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  if (sha256(local) !== sha256(remote)) throw new Error('Local and CDN font files differ; use the exact same file for consistent preview, export and outlines');
  return { verified: true, sha256: sha256(local), metadata, checkedAt: new Date().toISOString() };
}
export async function listCampaignFontAssets() {
  const dir = path.join(projectRoot, 'assets/fonts');
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  return Promise.all(entries.filter(name => /\.(otf|ttf|woff)$/i.test(name)).map(async name => {
    try { const metadata = fontMetadata(parseFontBytes(await fs.readFile(path.join(dir, name)))); return { asset: `fonts/${name}`, ...metadata }; }
    catch { return { asset: `fonts/${name}`, error: 'Unreadable font file' }; }
  }));
}
export async function uploadCampaignFont(name: string, bytes: Buffer) {
  if (!/\.(otf|ttf|woff)$/i.test(name)) throw new Error('Use an OTF, TTF or WOFF font');
  const metadata = fontMetadata(parseFontBytes(bytes));
  const filename = `${path.basename(name, path.extname(name)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 70) || 'font'}-${randomUUID().slice(0, 8)}${path.extname(name).toLowerCase()}`;
  const dir = path.join(projectRoot, 'assets/fonts'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), bytes, { flag: 'wx' });
  return { asset: `fonts/${filename}`, ...metadata };
}

export const campaignFontAssets = (document: { fonts?: unknown }) => campaignFontFaces(document).map(face => ({ face, filename: path.basename(face.asset), sourcePath: campaignFontPath(face) }));
