// @ts-nocheck
'use client';
import { useState } from 'react';
import { resetCreativeTargetField } from '@/lib/creative-model';
import { copyCreativeOwnership, createCreativeOwnershipDefinition, detachCreativeOwnership, linkCreativeOwnership, ownershipScopeIsActive, resetCreativeOwnershipField, setCreativeOwnershipField } from '@/lib/creative-ownership';
import { useEditorStore } from '@/store/editor-store';

const sourceLabel = (source) => source?.kind === 'sharedDefinition' ? `Shared: ${source.name}` : source?.kind === 'localOverride' ? `Local: ${source.scope || 'all states'}` : source?.kind === 'variantRule' ? `Rule: ${source.scope || 'all states'}` : source?.kind || 'Default';
const fieldNames = (text) => [...new Set(text.split(',').map((field) => field.trim()).filter(Boolean))];

/** Explicit relationships; selecting or grouping a target never creates a link. */
export function CreativeOwnershipControls({ document, size, target, scopes }) {
  const apply = useEditorStore((state) => state.applyCreativeOwnershipDocument);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [valuesFields, setValuesFields] = useState('fontSize,lineHeight');
  const [fitFields, setFitFields] = useState('mode,maxLines,minFontSize');
  const [stateOnly, setStateOnly] = useState(true);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('values');
  const [field, setField] = useState('fontSize');
  const [draft, setDraft] = useState('');
  const selectedSource = document.sharedDefinitions?.find((item) => item.id === sourceId);
  const membership = { size, targetId: target.id, scope: stateOnly ? [...new Set(scopes)].sort().join('.') : '' };
  const activeMemberships = (document.sharedDefinitions || []).flatMap((definition) => definition.members.filter((member) => member.size === size && member.targetId === target.id && ownershipScopeIsActive(member.scope, scopes)).map((member) => ({ definition, member })));
  const fields = { values: fieldNames(valuesFields), fit: fieldNames(fitFields) };
  const provenance = domain === 'fit' ? target.fitProvenance : target.valueProvenance;
  const current = (domain === 'fit' ? target.fit : target.values)?.[field];
  const run = (operation) => { try { apply(operation()); setError(''); } catch (failure) { setError(failure.message); } };
  const parsedDraft = draft === 'true' ? true : draft === 'false' ? false : draft !== '' && Number.isFinite(Number(draft)) ? Number(draft) : draft;
  const create = () => {
    if (!name.trim()) throw new Error('Name the shared definition.');
    const values = Object.fromEntries(fields.values.filter((key) => target.values?.[key] !== undefined).map((key) => [key, target.values[key]]));
    const fit = Object.fromEntries(fields.fit.filter((key) => target.fit?.[key] !== undefined).map((key) => [key, target.fit[key]]));
    if (!Object.keys(values).length && !Object.keys(fit).length) throw new Error('Choose at least one authored property or fit field.');
    const id = `shared-${crypto.randomUUID()}`;
    const next = createCreativeOwnershipDefinition(document, { id, name: name.trim(), values, fit, members: [membership] });
    setSourceId(id); setName(''); return next;
  };
  return <details className="inspector-section">
    <summary>Ownership and sharing</summary>
    <p className="inspector-note">Fields show their effective source. Regular edits create a local exception for named shared values. Shared edits below deliberately affect the listed members.</p>
    <div className="inspector-grid">
      <label>Property domain<select value={domain} onChange={(event) => { setDomain(event.target.value); setField(event.target.value === 'fit' ? 'maxLines' : 'fontSize'); }}><option value="values">Layout / style</option><option value="fit">Text fit</option></select></label>
      <label>Property<select value={field} onChange={(event) => setField(event.target.value)}>{Object.keys(domain === 'fit' ? target.fit || {} : target.values || {}).map((key) => <option key={key}>{key}</option>)}</select></label>
    </div>
    <p className="inspector-note">{field}: {String(current ?? 'default')} · {sourceLabel(provenance?.[field])}</p>
    <label>New value<input value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
    <div className="inspector-actions">
      <button type="button" onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,scopes,domain,field,parsedDraft,'local'))}>Set local value</button>
      <button type="button" disabled={!['localOverride','variantRule'].includes(provenance?.[field]?.kind)} onClick={() => run(() => resetCreativeTargetField(document,size,target.id,scopes,domain,field))}>Reset local field</button>
      <button type="button" disabled={provenance?.[field]?.kind !== 'sharedDefinition'} onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,scopes,domain,field,parsedDraft,'shared',provenance[field].definitionId))}>Edit shared source</button>
    </div>
    <label><input type="checkbox" checked={stateOnly} onChange={(event) => setStateOnly(event.target.checked)} /> Current state only for new memberships</label>
    <label>Layout / style fields<input value={valuesFields} onChange={(event) => setValuesFields(event.target.value)} /></label>
    <label>Fit fields<input value={fitFields} onChange={(event) => setFitFields(event.target.value)} /></label>
    <label>New shared name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" onClick={() => run(create)}>Create shared source from these fields</button>
    <label>Existing source<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose source</option>{(document.sharedDefinitions || []).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>
    {selectedSource ? <><p className="inspector-note">Affected members: {selectedSource.members.map((member) => `${member.size} ${member.targetId} (${member.scope || 'all states'})`).join('; ') || 'none'}</p><button type="button" onClick={() => run(() => linkCreativeOwnership(document,sourceId,membership))}>Link selected target</button><button type="button" onClick={() => run(() => copyCreativeOwnership(document,sourceId,membership))}>Copy once</button></> : null}
    {activeMemberships.map(({definition,member}) => <div key={`${definition.id}/${member.scope}`}><p className="inspector-note">Linked to {definition.name}: {definition.members.length} members. Scope: {member.scope || 'all states'}</p><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member,fields))}>Detach listed fields, preserve values</button><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member))}>Detach membership, preserve values</button></div>)}
    {error ? <p role="alert">{error}</p> : null}
  </details>;
}
