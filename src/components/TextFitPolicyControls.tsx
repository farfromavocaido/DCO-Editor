'use client';

import { normalizeFitConfig } from '@/lib/text-fit-rules';

type Props = { fit: Record<string, unknown>; onChange: (field: string, value: unknown) => void };

/** Opting in is deliberate; simply opening the inspector never migrates a frame. */
export function TextFitPolicyControls({ fit = {}, onChange }: Props) {
  const normalized = normalizeFitConfig(fit);
  return <div className="inspector-grid" aria-label="Text frame policy">
    <label className="inspector-field"><span>Text frame</span>
      <select value={String(fit.frame || '')} onChange={event => onChange('frame', event.target.value)}>
        <option value="">Legacy fitting</option><option value="fixed">Fixed frame</option><option value="auto">Content height</option>
      </select>
    </label>
    {fit.frame ? <>
      <label className="inspector-field"><span>Wrapping</span><select value={normalized.wrap ? 'wrap' : 'single'} onChange={event => onChange('wrap', event.target.value === 'wrap')}>
        <option value="single">Single line</option><option value="wrap">Multiline</option>
      </select></label>
      <label className="inspector-field"><span>Font sizing</span><select value={normalized.allowShrink === false || normalized.static ? 'fixed' : 'shrink'} onChange={event => onChange('allowShrink', event.target.value === 'shrink')}>
        <option value="fixed">Fixed size</option><option value="shrink">Shrink to minimum</option>
      </select></label>
      <label className="inspector-field"><span>Overflow</span><select value={String(fit.overflow || 'clip')} onChange={event => onChange('overflow', event.target.value)}>
        <option value="clip">Clip</option><option value="visible">Visible</option><option value="ellipsis">Ellipsis</option>
      </select></label>
      <label className="inspector-field"><span>Fit equalisation</span><select value={normalized.shared ? 'shared' : 'independent'} onChange={event => onChange('shared', event.target.value === 'shared')}>
        <option value="independent">Independent</option><option value="shared">Shared size</option>
      </select></label>
      {normalized.shared ? <label className="inspector-field"><span>Fit group name (optional)</span><input value={String(fit.sharedGroup || '')} onChange={event => onChange('sharedGroup', event.target.value)} placeholder="Current text family" /></label> : null}
    </> : null}
  </div>;
}
