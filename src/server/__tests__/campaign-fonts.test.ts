import { describe, test, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { campaignFontFaces, resolveCampaignFontFace, validateCampaignFonts, campaignFontFaceCss, type CampaignFontFace } from '@/lib/campaign-fonts';
import { uploadCampaignFont, loadCampaignFont, verifyCampaignFontCdn, campaignFontPath } from '../campaign-fonts';
import { outlineFittedText } from '../text-outline';
import { buildBasePackageEntries } from '../creative-exporter';
const require = createRequire(import.meta.url);
const ot = require('opentype.js') as typeof import('opentype.js');
function fontBytes(weight: number, width: number) {
  const path = new ot.Path(); path.moveTo(0, 0); path.lineTo(width, 0); path.lineTo(width, 700); path.lineTo(0, 700); path.close();
  const font = new ot.Font({ familyName: 'Test family', styleName: weight === 700 ? 'Bold' : 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs: [new ot.Glyph({ name: '.notdef', advanceWidth: 300, path: new ot.Path() }), new ot.Glyph({ name: 'A', unicode: 65, advanceWidth: width + 20, path })] });
  font.tables.os2.usWeightClass = weight;
  return Buffer.from(font.toArrayBuffer());
}
const files: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(files.splice(0).map(file => fs.unlink(file))); });
async function face(weight: number, width: number): Promise<CampaignFontFace> {
  const result = await uploadCampaignFont('test.otf', fontBytes(weight, width));
  const entry = { id: `test-${weight}`, family: 'Test family', weight, style: 'normal' as const, asset: result.asset, cdnUrl: 'https://example.com/test.otf' };
  files.push(campaignFontPath(entry)); return entry;
}
describe('campaign fonts', () => {
  test('legacy fallback is read-only and preserves Museo', () => {
    const document = {}; expect(campaignFontFaces(document)[0].family).toBe('Museo'); expect(document).toEqual({});
  });
  test('resolves separate weights in one family and outlines the selected local file', async () => {
    const regular = await face(400, 200); const bold = await face(700, 700); const document = { fonts: [regular, bold] };
    expect(resolveCampaignFontFace(document, { fontFamily: 'Test family', fontWeight: 700 })).toEqual(bold);
    expect(campaignFontFaceCss(document, 'local')).toContain('font-weight:400');
    expect(campaignFontFaceCss(document, 'local')).toContain('font-weight:700');
    const options = { text: 'A', fontSize: 20, width: 100, lockMetrics: true };
    const a = await outlineFittedText({ ...options, fontFace: regular }); const b = await outlineFittedText({ ...options, fontFace: bold });
    expect(a.svg).not.toBe(b.svg); expect(a.svg).toContain('<path');
  });
  test('unavailable faces, invalid paths and missing files fail visibly; CSS descriptors remain authorable', async () => {
    const regular = await face(400, 200);
    expect(() => resolveCampaignFontFace({ fonts: [regular] }, { fontFamily: 'Missing', fontWeight: 400 })).toThrow(/unavailable/);
    expect(() => resolveCampaignFontFace({ fonts: [regular] }, { fontFamily: regular.family, fontWeight: 700 })).toThrow(/unavailable/);
    expect(() => validateCampaignFonts({ fonts: [{ ...regular, asset: 'fonts/../other.otf' }] })).toThrow(/asset/);
    expect(() => validateCampaignFonts({ fonts: [{ ...regular, asset: 'fonts/test.woff2' }] })).toThrow(/asset/);
    await expect(loadCampaignFont({ ...regular, weight: 700 })).resolves.toBeDefined();
    await expect(outlineFittedText({ text: 'A', fontSize: 20, width: 100, fontFace: { ...regular, asset: 'fonts/absent.otf' } })).rejects.toThrow();
  });
  test('uploads never overwrite an existing font and corrupt files are rejected', async () => {
    const first = await face(400, 200); const original = await fs.readFile(campaignFontPath(first));
    const second = await face(400, 500);
    expect(second.asset).not.toBe(first.asset);
    expect(await fs.readFile(campaignFontPath(first))).toEqual(original);
    await expect(uploadCampaignFont('invalid.otf', Buffer.from('not a font'))).rejects.toThrow(/parsed/);
  });
  test('CDN verification compares exact files and rejects mismatches', async () => {
    const regular = await face(400, 200); const bytes = await fs.readFile(campaignFontPath(regular));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)));
    expect((await verifyCampaignFontCdn(regular)).verified).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async()=>new Response(fontBytes(700, 700))));
    await expect(verifyCampaignFontCdn(regular)).rejects.toThrow(/differ/);
    await expect(buildBasePackageEntries({fonts:[regular],sizes:{}},{assetMode:'embed'})).rejects.toThrow(/differ/);
  });
});
