'use client';

import {textFitMembers} from '@/lib/text-fit-members';
import {useEditorStore} from '@/store/editor-store';
import { normalizeFitConfig } from '@/lib/text-fit-rules';

type Props = { fit: Record<string, unknown>; effectiveRule?: Record<string, unknown>; onChange: (field: string, value: unknown) => void };

/** Opting in is deliberate; simply opening the inspector never migrates a frame. */
export function TextFitPolicyControls({ fit = {}, effectiveRule, onChange }: Props) {
  const document=useEditorStore(s=>s.creativeDocument),size=useEditorStore(s=>s.size),targetId=useEditorStore(s=>s.selectedTargetId),scopes=useEditorStore.getState().activeScopes();
  const members=textFitMembers(document,size,targetId,scopes);
  const normalized = effectiveRule || normalizeFitConfig(fit);
  return <div className="inspector-grid" aria-label="Text frame policy">
    <label className="inspector-field"><span>Text frame</span>
      <select value={String(normalized.frame || '')} onChange={event => onChange('frame', event.target.value)}>
        {!normalized.frame&&<option value="" disabled>Legacy fitting</option>}<option value="fixed">Fixed frame</option><option value="auto">Content height</option>
      </select>
    </label>
    {normalized.frame ? <>
      <label className="inspector-field"><span>Wrapping</span><select value={normalized.wrap ? 'wrap' : 'single'} onChange={event => onChange('wrap', event.target.value === 'wrap')}>
        <option value="single">Single line</option><option value="wrap">Multiline</option>
      </select></label>
      <label className="inspector-field"><span>Font sizing</span><select value={normalized.allowShrink === false || normalized.static ? 'fixed' : 'shrink'} onChange={event => onChange('allowShrink', event.target.value === 'shrink')}>
        <option value="fixed">Fixed size</option><option value="shrink">Shrink to minimum</option>
      </select></label>
      <label className="inspector-field"><span>Overflow</span><select value={String(normalized.overflow || 'clip')} onChange={event => onChange('overflow', event.target.value)}>
        <option value="clip">Clip</option><option value="visible">Visible</option>{!normalized.wrap&&<option value="ellipsis">Ellipsis</option>}
      </select></label>
      <label className="inspector-field"><span>Fit equalisation</span><select value={normalized.shared ? 'shared' : 'independent'} onChange={event => onChange('shared', event.target.value === 'shared')}>
        <option value="independent">Independent</option><option value="shared">Shared size</option>
      </select></label>
      {normalized.shared&&<span className="inspector-note" title="Shares the final font size with these state-active elements. Empty text is skipped at runtime; fades do not detach members.">Matches: {members.length?members.map((m:{label:string})=>m.label).join(", "):"No other active members"}</span>}
      {normalized.shared ? <label className="inspector-field"><span>Fit group name (optional)</span><input value={String(normalized.sharedGroup || '')} onChange={event => onChange('sharedGroup', event.target.value)} placeholder="Current text family" /></label> : null}
    </> : null}
  </div>;
}
