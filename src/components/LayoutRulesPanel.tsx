'use client';

import {ContentPlacementControls,conditionLabels} from './ContentPlacementControls';
import { useEffect, useState } from 'react';
import {useEditorStore} from '@/store/editor-store';
import { campaignVariantModel } from '@/lib/campaign-variants';
import type { CampaignDimension } from '@/lib/campaign-variants';
import { editableTargetsForLayer } from '@/lib/creative-model';
import styles from './LayoutRulesPanel.module.css';

type Edge = 'start' | 'center' | 'end';
type Rule = {
  id: string; name: string; type: 'conditional' | 'spacing' | 'distribute'; enabled: boolean;
  targets: { size: string; targetId: string; scope?: string }[];
  condition?: any;otherwise?:Record<string,string|number>;when?: string[]; values?: Record<string, string | number>;
  axis?: 'x' | 'y'; targetEdge?: Edge; reference?: { targetId: string; edge: Edge };
  gap?: number; gapUnit?: 'px' | 'em' | 'percent'; onMissing?: 'authored' | 'canvas'; fallbackEdge?: Edge; fallbackGap?: number;
};
type Diagnostic = {facts?:any;branch?:string; id: string; targetId: string; size: string; status: 'disabled' | 'inactive' | 'active' | 'missing' | 'error'; message?: string };
type CreativeDocument = { layoutRules?: Rule[]; sizes: Record<string, { layers: Record<string, any>[] }>; [key: string]: any };
type Props = {
  document: CreativeDocument; size: string; targetId: string; scopes: string[]; diagnostics?: Diagnostic[];
  onChange: (document: CreativeDocument) => void; onSelectRule?: (id: string | null) => void; onFreeze?: (id: string) => void;
};
const newId = () => `layout-${globalThis.crypto.randomUUID()}`;
const numericFields = ['left', 'top', 'width', 'height'];
const edgeLabel = (edge: Edge, axis = 'y') => edge === 'center' ? 'Centre' : axis === 'x' ? edge === 'start' ? 'Left' : 'Right' : edge === 'start' ? 'Top' : 'Bottom';

export function LayoutRulesPanel({ document, size, targetId, scopes, diagnostics = [], onChange, onSelectRule, onFreeze }: Props) {
  const [draft, setDraft] = useState<Rule | null>(null);
  const [error, setError] = useState('');
  const [copyTarget, setCopyTarget] = useState('');
  const rules = document.layoutRules || [];
  const dimensions = campaignVariantModel(document).dimensions as CampaignDimension[];
  const targets = (document.sizes[size]?.layers || []).flatMap(layer => [
    { id: String(layer.id), label: String(layer.name || layer.label || layer.id) },
    ...editableTargetsForLayer(layer).map((child: any) => ({ id: child.id, label: `${layer.name || layer.label || layer.id} / ${child.label || child.name || child.childId}` })),
  ]);
  const destinations = Object.entries(document.sizes).flatMap(([format, creative]) => creative.layers.flatMap(layer => [{ id: String(layer.id), label: String(layer.name || layer.label || layer.id) }, ...editableTargetsForLayer(layer).map((child: any) => ({id:child.id,label:`${layer.name || layer.label || layer.id} / ${child.label || child.childId}`}))].filter(target => format !== size || target.id !== targetId).map(target => ({size:format,targetId:target.id,label:`${format} · ${target.label}`}))));
  const destination = destinations.find(target => JSON.stringify([target.size,target.targetId]) === copyTarget);
  const applicable = rules.filter(rule => rule.type!=='distribute'&& rule.targets.some(target => target.size === size && target.targetId === targetId));
  const publish = (nextRules: Rule[]) => {
    try { onChange({ ...document, layoutRules: nextRules }); setError(''); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const replace = (rule: Rule) => publish(rules.map(previous => previous.id === rule.id ? rule : previous));
  const start = (type: Rule['type']) => {
    setError('');
    setDraft({ id: newId(), name: type === 'spacing' ? 'Keep a gap' : 'Conditional placement', type, enabled: true, targets: [{ size, targetId }], when: [],
      ...(type==='conditional'?{condition:{targetId:'',test:'has-text'}}:{}),
      ...(type === 'spacing' ? { axis: 'y', targetEdge: 'start', reference: { targetId: 'canvas', edge: 'start' }, gap: 16, gapUnit: 'px', onMissing: 'authored' } : { values: {} }) });
  };
  useEffect(()=>{if(useEditorStore.getState().layoutRuleStart===targetId){start('conditional');useEditorStore.setState({layoutRuleStart:null});}},[targetId]);
  const patch = (value: Partial<Rule>) => setDraft(previous => previous ? { ...previous, ...value } : previous);
  const currentMembership = (target: Rule['targets'][number]) => target.size === size && target.targetId === targetId;
  const removeMembership = (rule: Rule) => rules.flatMap(item => item.id !== rule.id ? [item] : item.targets.some(target => !currentMembership(target)) ? [{ ...item, targets: item.targets.filter(target => !currentMembership(target)) }] : []);
  const diagnosticFor = (rule: Rule) => diagnostics.find(item => item.id === rule.id && item.size === size && item.targetId === targetId && item.status === 'active') || diagnostics.find(item => item.id === rule.id && item.size === size && item.targetId === targetId);
  const statusFor = (rule: Rule) => !rule.enabled ? 'disabled' : diagnosticFor(rule)?.status || 'inactive';
  const conditionText = (rule: Rule) => rule.condition?`${targets.find(t=>t.id===rule.condition.targetId)?.label||rule.condition.targetId} ${(conditionLabels as Record<string,string>)[rule.condition.test]}${rule.condition.value!==undefined&&(rule.condition.test.startsWith('lines')||rule.condition.test==='height-at-least')?' '+rule.condition.value:''}`:(rule.when || []).map(scope => {
    const dimension = dimensions.find(item => item.options.some(option => option.scope === scope));
    return dimension ? `${dimension.label}: ${dimension.options.find(option => option.scope === scope)?.label}` : scope;
  }).join(' + ') || 'All campaign states';
  return <div className={styles.panel}>

    {applicable.map(rule => {
      const diagnostic = diagnosticFor(rule);
      const status = statusFor(rule);
      return <article className={styles.rule} key={rule.id}>
        <div className={styles.ruleHeader}><button type="button" className={styles.ruleTitle} onClick={() => onSelectRule?.(rule.id)}>{rule.name}</button><span className={styles.status} data-status={status}>{status === 'inactive' ? 'Enabled · inactive' : status === 'missing' ? 'Reference absent' : status === 'active' ? 'Active' : status === 'disabled' ? 'Disabled' : 'Needs attention'}</span></div>
        <p className={styles.note}>{rule.type === 'spacing' ? `${edgeLabel(rule.targetEdge || 'start', rule.axis)} ink → ${rule.reference?.targetId === 'canvas' ? 'canvas' : targets.find(target => target.id === rule.reference?.targetId)?.label || rule.reference?.targetId} · ${rule.gap ?? 0} ${rule.gapUnit === 'percent' ? '%' : rule.gapUnit || 'px'}` : `Sets ${Object.keys(rule.values || {}).join(', ')}`}</p>
        <p className={styles.note}>{conditionText(rule)} · {rule.targets.length > 1 ? `Linked to ${rule.targets.length} targets` : 'This element'}</p>
        {diagnostic?.facts&&<span className={styles.note}>Now: {diagnostic.facts.hasText?'text present':'empty'} · {diagnostic.facts.lines} fitted lines · {diagnostic.branch==='when'?'placement A':'placement B'}</span>}
        {diagnostic?.message && <p className={styles.note}>{diagnostic.message}</p>}
        {rule.enabled && !(rule.when || []).every(scope => scopes.includes(scope)) && <p className={styles.note}>The current campaign state does not match these conditions.</p>}
        <div className={styles.actions}>
          <button type="button" onClick={() => { setDraft(structuredClone(rule)); onSelectRule?.(rule.id); setError(''); }}>Edit</button>
          <button type="button" onClick={() => replace({ ...rule, enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button>
          {rule.targets.length > 1 && <button type="button" onClick={() => publish([...removeMembership(rule), { ...structuredClone(rule), id: newId(), name: `${rule.name} · local`, targets: rule.targets.filter(currentMembership) }])}>Unlink</button>}
          {onFreeze && <button type="button" disabled={status !== 'active'} title="Keep the measured position as an authored value and remove this element from the rule" onClick={() => {try {onFreeze(rule.id);setError('');} catch(cause) {setError(cause instanceof Error?cause.message:String(cause));}}}>{rule.type === 'conditional' ? 'Freeze values' : 'Freeze position'}</button>}
          <button type="button" onClick={() => { if (publish(removeMembership(rule))) { if (draft?.id === rule.id) setDraft(null); onSelectRule?.(null); } }}>Delete</button>
        </div>
        <div className={styles.copy}><select aria-label={`Copy destination for ${rule.name}`} value={copyTarget} onChange={event => setCopyTarget(event.target.value)}><option value="">Choose element and format…</option>{destinations.map(target => <option key={JSON.stringify([target.size,target.targetId])} value={JSON.stringify([target.size,target.targetId])}>{target.label}</option>)}</select>
          <button type="button" disabled={!destination} onClick={() => publish([...rules, { ...structuredClone(rule), id: newId(), name: `${rule.name} · copy`, targets: [{ size: destination!.size, targetId: destination!.targetId, scope: rule.targets.find(currentMembership)?.scope }] }])}>Copy</button>
          <button type="button" disabled={!destination || rule.targets.some(target => target.size === destination.size && target.targetId === destination.targetId)} onClick={() => replace({ ...rule, targets: [...rule.targets, { size: destination!.size, targetId: destination!.targetId, scope: rule.targets.find(currentMembership)?.scope }] })}>Link</button>
        </div>
      </article>;
    })}
    {!draft && <div className={styles.actions}><button type="button" onClick={() => start('conditional')}>+ Conditional placement</button><button type="button" onClick={() => start('spacing')}>+ Keep a gap</button></div>}
    {draft && <form className={styles.draft} onSubmit={event => {
      event.preventDefault();
      if (draft.type === 'conditional' && !Object.keys({...draft.values,...(draft.condition?draft.otherwise:{})}).length) { setError('Choose at least one placement value.'); return; }
      if (publish(rules.some(rule => rule.id === draft.id) ? rules.map(rule => rule.id === draft.id ? draft : rule) : [...rules, draft])) { onSelectRule?.(draft.id); setDraft(null); }
    }}>
      <strong>{rules.some(rule => rule.id === draft.id) ? 'Edit' : 'New'} {draft.type === 'spacing' ? 'gap' : 'conditional placement'}</strong>
      {draft.targets.length > 1 && <p className={styles.note}>Changes apply to all {draft.targets.length} linked targets. Unlink first to edit only this element.</p>}
      <label className={styles.field}><span>Name</span><input required value={draft.name} onChange={event => patch({ name: event.target.value })} /></label>
      <details><summary title="Optionally limit this rule to particular campaign versions">Limit to campaign versions</summary><fieldset><legend>When all choices match</legend>{dimensions.map(dimension => <label className={styles.field} key={dimension.id}><span>{dimension.label}</span><select aria-label={dimension.label} value={draft.when?.find(scope => dimension.options.some(option => option.scope === scope)) || ''} onChange={event => patch({ when: [...(draft.when || []).filter(scope => !dimension.options.some(option => option.scope === scope)), ...(event.target.value ? [event.target.value] : [])] })}><option value="">Any value</option>{dimension.options.map(option => <option value={option.scope} key={option.scope}>{option.label}</option>)}</select></label>)}</fieldset></details>
      {draft.type === 'conditional' && <label className={styles.field}>Respond to<select aria-label="Condition source" value={draft.condition?'element':'campaign'} onChange={e=>patch({condition:e.target.value==='element'?{targetId:'',test:'has-text'}:undefined,otherwise:undefined,...(e.target.value==='element'?{values:Object.fromEntries(Object.entries(draft.values||{}).filter(([key])=>['left','top','width','height','visibility'].includes(key)))}:{})})}><option value="element">Another element’s content or layout</option><option value="campaign">Campaign choices</option></select></label>}
      {draft.type==='conditional'&&draft.condition?<ContentPlacementControls {...{draft,patch,document,size,targetId,targets}}/>:draft.type === 'conditional' ? <fieldset><legend>Placement overrides</legend><p className={styles.note}>Leave a field blank to keep its authored value.</p><div className={styles.grid}>{numericFields.map(field => <label key={field} className={styles.field}><span>{field[0].toUpperCase() + field.slice(1)} (px)</span><input type="number" step="any" value={draft.values?.[field] ?? ''} onChange={event => { const values = { ...draft.values }; if (event.target.value === '') delete values[field]; else values[field] = Number(event.target.value); patch({ values }); }} /></label>)}</div>
        {([['textAlign', 'Text alignment', ['left', 'center', 'right']], ['alignItems', 'Vertical alignment', ['flex-start', 'center', 'flex-end']], ['visibility', 'Visibility', ['visible', 'hidden']]] as const).map(([field, label, options]) => <label className={styles.field} key={field}><span>{label}</span><select aria-label={label} value={draft.values?.[field] ?? ''} onChange={event => { const values = { ...draft.values }; if (event.target.value) values[field] = event.target.value; else delete values[field]; patch({ values }); }}><option value="">Keep authored value</option>{options.map(option => <option key={option} value={option}>{({"flex-start":'Top',center:'Centre',"flex-end":'Bottom',left:'Left',right:'Right',visible:'Shown',hidden:'Hidden'})[option]||option}</option>)}</select></label>)}
      </fieldset> : <fieldset><legend>Visible ink spacing</legend>
        <label className={styles.field}><span>Axis</span><select aria-label="Axis" value={draft.axis} onChange={event => patch({ axis: event.target.value as 'x' | 'y' })}><option value="y">Vertical</option><option value="x">Horizontal</option></select></label>
        <label className={styles.field}><span>This element’s visible edge</span><select aria-label="This element’s visible edge" value={draft.targetEdge} onChange={event => patch({ targetEdge: event.target.value as Edge })}>{(['start', 'center', 'end'] as Edge[]).map(edge => <option key={edge} value={edge}>{edgeLabel(edge, draft.axis)}</option>)}</select></label>
        <label className={styles.field}><span>Relative to</span><select aria-label="Reference" value={draft.reference?.targetId} onChange={event => patch({ reference: { targetId: event.target.value, edge: draft.reference?.edge || 'start' } })}><option value="canvas">Canvas</option>{targets.filter(target => target.id !== targetId).map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
        <label className={styles.field}><span>Reference edge</span><select aria-label="Reference edge" value={draft.reference?.edge} onChange={event => patch({ reference: { targetId: draft.reference?.targetId || 'canvas', edge: event.target.value as Edge } })}>{(['start', 'center', 'end'] as Edge[]).map(edge => <option key={edge} value={edge}>{edgeLabel(edge, draft.axis)}</option>)}</select></label>
        <div className={styles.grid}><label className={styles.field}><span title="Positive moves down/right; negative moves up/left. Measured from visible artwork, excluding transparent padding.">Gap</span><input required type="number" step="any" value={draft.gap ?? 0} onChange={event => patch({ gap: Number(event.target.value) })} /></label><label className={styles.field}><span>Units</span><select aria-label="Units" value={draft.gapUnit || 'px'} onChange={event => patch({ gapUnit: event.target.value as Rule['gapUnit'] })}><option value="px">Pixels</option><option value="em">Multiple of text size</option><option value="percent">Percent of ad size</option></select></label></div>

        {draft.reference?.targetId !== 'canvas' && <><label className={styles.field}><span>If the reference is absent</span><select aria-label="If the reference is absent" value={draft.onMissing || 'authored'} onChange={event => patch({ onMissing: event.target.value as Rule['onMissing'] })}><option value="authored">Keep authored position</option><option value="canvas">Use a canvas edge</option></select></label>{draft.onMissing === 'canvas' && <div className={styles.grid}><label className={styles.field}><span>Canvas edge</span><select aria-label="Canvas edge" value={draft.fallbackEdge || 'start'} onChange={event => patch({ fallbackEdge: event.target.value as Edge })}>{(['start', 'center', 'end'] as Edge[]).map(edge => <option key={edge} value={edge}>{edgeLabel(edge, draft.axis)}</option>)}</select></label><label className={styles.field}><span>Fallback gap (same units)</span><input type="number" step="any" value={draft.fallbackGap ?? 0} onChange={event => patch({ fallbackGap: Number(event.target.value) })} /></label></div>}</>}
      </fieldset>}
      <label className={styles.checkbox}><input type="checkbox" checked={draft.enabled} onChange={event => patch({ enabled: event.target.checked })} />Enabled</label>

      <div className={styles.actions}><button className={styles.primary} type="submit" title="Update the production preview with this rule">Apply rule</button><button type="button" onClick={() => { setDraft(null); setError(''); }}>Cancel</button></div>
    </form>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}

/** Compact provenance affordance for position fields in the existing inspector. */
export function LayoutRuleSourceBadge({ name, active, linked = false, onClick }: { name: string; active: boolean; linked?: boolean; onClick?: () => void }) {
  return <button type="button" className={styles.sourceBadge} data-active={active} onClick={onClick} title={`${linked ? 'Linked rule' : 'Layout rule'}: ${name}${active ? ' controls this field' : ' is inactive in this preview'}`}>
    {linked ? 'Linked' : 'Rule'} · {name}{active ? '' : ' · inactive'}
  </button>;
}
