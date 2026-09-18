'use client';

import { useEffect, useState } from 'react';
import { campaignFontFaces, validateCampaignFonts, type CampaignFontFace, type CampaignFontStyle, resolveCampaignFontFace } from '@/lib/campaign-fonts';

type FontAsset = { asset: string; family?: string; weight?: number; style?: 'normal' | 'italic'; error?: string };
type Props = { document: { fonts?: unknown }; campaignId: string; onChange: (fonts: CampaignFontFace[]) => void };
export function FontManager({ document, campaignId, onChange }: Props) {
  const [assets, setAssets] = useState<FontAsset[]>([]);
  const [draft, setDraft] = useState<CampaignFontFace | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/fonts?campaign=${encodeURIComponent(campaignId)}`;
  const faces = campaignFontFaces(document);
  useEffect(() => { let active = true; fetch(endpoint).then(r => r.json()).then(data => { if (active) setAssets(data.assets || []); }).catch(() => { if (active) setMessage('Could not load font files'); }); return () => { active = false; }; }, [endpoint]);
  const selectAsset = (asset: string) => {
    const selected = assets.find(item => item.asset === asset);
    if (draft && selected) setDraft({ ...draft, asset, family: selected.family || draft.family, weight: selected.weight || draft.weight, style: selected.style || draft.style });
    setMessage('');
  };
  const request = async (body: FormData | object) => {
    const response = await fetch(endpoint, body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Font request failed'); return result;
  };
  const save = async () => {
    if (!draft) return; setBusy(true); setMessage('');
    try {
      const next = [...faces.filter(face => face.id !== draft.id), draft]; validateCampaignFonts({ fonts: next });
      await request({ action: 'validate', face: draft }); onChange(next); setDraft(null); setMessage('Font saved. Save the campaign to keep these changes.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
  };
  const fieldStyle = { width: '100%', minHeight: 30, marginTop: 4 };
  return <section className="font-manager" aria-label="Campaign fonts" style={{ padding: 12, fontSize: 12 }}>
    <span className="font-help" title="Use identical local and hosted font files for preview, outlines and CDN delivery." aria-label="Font file guidance">Font files ⓘ</span>
    {faces.map(face => <button type="button" key={face.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, marginBottom: 6 }} onClick={() => { setDraft({ ...face }); setMessage(''); }}>{face.family} · {face.weight} · {face.style}</button>)}
    <button type="button" onClick={() => { setDraft({ id: `font-${crypto.randomUUID()}`, family: '', weight: 400, style: 'normal', asset: '' }); setMessage(''); }}>Add font face</button>
    {draft && <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      <label>Family<input style={fieldStyle} value={draft.family} onChange={e => { setDraft({ ...draft, family: e.target.value }); setMessage(''); }} /></label>
      <label>Weight<input style={fieldStyle} type="number" min="1" max="1000" value={draft.weight} onChange={e => { setDraft({ ...draft, weight: Number(e.target.value) }); setMessage(''); }} /></label>
      <label>Style<select style={fieldStyle} value={draft.style} onChange={e => { setDraft({ ...draft, style: e.target.value as CampaignFontFace['style'] }); setMessage(''); }}><option value="normal">Normal</option><option value="italic">Italic</option><option value="oblique">Oblique</option></select></label>
      <label>Local file<select style={fieldStyle} value={draft.asset} onChange={e => selectAsset(e.target.value)}><option value="">Choose a font file</option>{assets.map(asset => <option key={asset.asset} value={asset.asset} disabled={!!asset.error}>{asset.asset}{asset.error ? ' (unreadable)' : ''}</option>)}</select></label>
      <label>Upload font<input style={fieldStyle} type="file" accept=".otf,.ttf,.woff" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return; setBusy(true); setMessage('');
        try { const body = new FormData(); body.set('file', file); const result = await request(body); setAssets(previous => [...previous, result]); setDraft({ ...draft, ...result }); }
        catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); }
      }} /></label>
      <label>CDN URL<input style={fieldStyle} type="url" value={draft.cdnUrl || ''} placeholder="https://…/font.otf" onChange={e => { setDraft({ ...draft, cdnUrl: e.target.value }); setMessage(''); }} /></label>
      <button type="button" disabled={busy || !draft.cdnUrl || !draft.asset} onClick={async () => { setBusy(true); setMessage('Checking the local and CDN files…'); try { await request({ action: 'verify', face: draft }); setMessage('Verified: local and CDN files are identical.'); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }}>Verify local and CDN match</button>
      <div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={busy} onClick={save}>Save face</button><button type="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button></div>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
export function FontSelector({ document, value, onChange }: { document: { fonts?: unknown }; value: CampaignFontStyle; onChange: (style: { fontFamily: string; fontWeight: number; fontStyle: string }) => void }) {
  const faces = campaignFontFaces(document); let selected = '';
  try { selected = resolveCampaignFontFace(document, value).id; } catch { /* Keep unavailable state visible. */ }
  return <label>Font<select aria-label="Font face" value={selected} onChange={event => { const face = faces.find(item => item.id === event.target.value); if (face) onChange({ fontFamily: face.family, fontWeight: face.weight, fontStyle: face.style }); }}>
    {!selected && <option value="">Unavailable font — choose a face</option>}
    {faces.map(face => <option key={face.id} value={face.id}>{face.family} · {face.weight} · {face.style}</option>)}
  </select></label>;
}
