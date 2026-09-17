// @ts-nocheck
'use client';
import {inheritedPositionSharing,setInheritedPositionIndependent} from '@/lib/inherited-position';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { findCreativeTarget, resetCreativeTargetField } from '@/lib/creative-model';
import { detachCreativeOwnership, ownershipScopeIsActive, setCreativeOwnershipField, sharedCreativeFieldReach } from '@/lib/creative-ownership';
import { suppliedOwnershipFields, validOwnershipProperty } from '@/lib/ownership-ui';
import { campaignVariantModel } from '@/lib/campaign-variants';
import { useEditorStore } from '@/store/editor-store';
import { VisualCopyTray } from './VisualCopyTray';
import { labels } from './ownership-properties';
const tokens = scope => String(scope || '').split('.').filter(Boolean);
const readable = value => String(value || '').replace(/[-_]/g,' ').replace(/^./,letter=>letter.toUpperCase());
const versionDescription = (document,scope) => {
  const parts=tokens(scope);
  if (!parts.length) return 'All versions';
  return campaignVariantModel(document).dimensions.filter(dimension=>!dimension.derived).flatMap(dimension=>{
    const option=dimension.options.find(option=>parts.includes(option.scope));
    return option ? [`${dimension.label}: ${option.label}`] : [];
  }).join(' · ') || 'All versions';
};
const memberDescription = (document,member) => `${readable(findCreativeTarget(document,member.size,member.targetId,tokens(member.scope))?.label || member.targetId)} · ${member.size.replace('x','×')} · ${versionDescription(document,member.scope)}`;

export function CreativeOwnershipControls({document,size,target,scopes}) {
  const apply = useEditorStore(state => state.applyCreativeOwnershipDocument);
  const undo = useEditorStore(state => state.undo);
  const [operation,setOperation] = useState(null);
  const [notice,setNotice] = useState('');
  const [edit,setEdit] = useState(null);
  const [field,setField] = useState('');
  const [draft,setDraft] = useState('');
  const [error,setError] = useState('');
  const [domain,setDomain] = useState('values');
  const positionSharing=inheritedPositionSharing(document,size,target.id,scopes);
  const memberships = (document.sharedDefinitions || []).flatMap(definition => definition.members.filter(member => member.size === size && member.targetId === target.id && ownershipScopeIsActive(member.scope,scopes)).filter(member => Object.values(suppliedOwnershipFields(definition,member)).some(fields => fields.length)).map(member => ({definition,member})));
  const run = (next,message) => { apply(next,message); setNotice(message); setError(''); };
  const property = validOwnershipProperty(target,domain,field);
  const editFields = edit ? ['values','fit'].flatMap(domain => [...new Set([...Object.keys(edit[domain] || {}),...Object.keys(edit.perSize?.[size]?.[domain] || {})])].map(field => `${domain}:${field}`)) : [];
  const [editDomain,editKey] = field.split(':');
  const editSource = (editDomain === 'fit' ? target.fitProvenance : target.valueProvenance)?.[editKey];
  const editReach = sharedCreativeFieldReach(document,editSource);
  const parsed = draft === 'true' ? true : draft === 'false' ? false : draft !== '' && Number.isFinite(Number(draft)) ? Number(draft) : draft;
  return <section className="inspector-section ownership-controls"><h3>Copy properties</h3><div className="ownership-body">

    <div className="inspector-actions"><button onClick={() => setOperation('to')}>Copy appearance…</button></div>
    <h3 title="Linked properties update together. Unlink keeps the current appearance.">Linked properties</h3>
    {memberships.map(({definition,member}) => <div className="relationship-link" key={`${definition.id}/${member.scope}`}><strong>{definition.name}</strong><p>{['values','fit'].flatMap(domain => suppliedOwnershipFields(definition,member)[domain].map(field => labels[field] || field)).join(', ') || 'No linked properties'}</p><details><summary>{definition.members.length} members</summary>{definition.members.map((item,index) => <p key={index}>{memberDescription(document,item)}</p>)}</details><div className="inspector-actions"><button onClick={() => {setEdit(definition);setField('');setDraft('');}}>Edit shared…</button><button onClick={() => run(detachCreativeOwnership(document,definition.id,member),'Unlinked; appearance kept')}>Unlink — keep appearance</button></div></div>)}
    {positionSharing.length>0&&<div className="relationship-link"><strong>Inherited position sharing</strong>{positionSharing.map(item=><p key={item.field}>{item.field==='left'?'Horizontal':'Vertical'}: {item.independent?'Independent of':'Shared with'} {item.members.map(m=>m.label+(m.independent?' (local exception)':'')).join(', ')} <span title={versionDescription(document,item.source.scope)}>{size} · {versionDescription(document,item.source.scope)}</span></p>)}<div className="inspector-actions">{positionSharing.some(p=>!p.independent)&&<button onClick={()=>{try{run(setInheritedPositionIndependent(document,size,target.id,scopes,true),'Position is independent in this version');}catch(e){setError(e.message);}}}>Make position independent</button>}{positionSharing.some(p=>p.independent)&&<button title="Removes local position exceptions in this version. The element adopts the current shared position." onClick={()=>{try{run(setInheritedPositionIndependent(document,size,target.id,scopes,false),'Using shared position again');}catch(e){setError(e.message);}}}>Use shared position again</button>}</div></div>}
    {!memberships.length&&!positionSharing.length && <p className="inspector-note">No named links or inherited position sharing.</p>}
    <button onClick={() => setOperation('link')}>Link properties…</button>
    {edit && <div className="relationship-link"><strong>Edit shared: {edit.name}</strong><p>Changes apply to linked members. Existing local exceptions stay in place.</p>{editReach.members.length > 0 && <p>Affects {editReach.members.length} members: {editReach.members.map(member => memberDescription(document,member)).join('; ')}. {editReach.localExceptions.length ? `${editReach.localExceptions.length} members have local exceptions.` : ''}</p>}<select aria-label="Shared property" value={field} onChange={event => setField(event.target.value)}><option value="">Choose a property</option>{editFields.map(key => <option key={key} value={key}>{labels[key.split(':')[1]] || key}</option>)}</select><input aria-label="Shared value" value={draft} onChange={event => setDraft(event.target.value)} /><button disabled={!field || draft === ''} onClick={() => {try {const [domain,key] = field.split(':');run(setCreativeOwnershipField(document,size,target.id,scopes,domain,key,parsed,'shared',edit.id),'Updated linked property');setEdit(null);} catch(cause){setError(cause.message);}}}>Apply shared edit</button><button onClick={() => setEdit(null)}>Cancel</button></div>}
    <details><summary title="Remove a local override so this version uses its inherited value">Use defaults</summary><select aria-label="Default property type" value={domain} onChange={event => setDomain(event.target.value)}><option value="values">Layout / style</option><option value="fit">Text fitting</option></select><select aria-label="Default property" value={property} onChange={event => setField(event.target.value)}>{Object.keys(target[domain] || {}).map(key => <option key={key} value={key}>{labels[key] || key}</option>)}</select><button disabled={!property} onClick={() => run(resetCreativeTargetField(document,size,target.id,scopes,domain,property),'Using inherited value')}>Use inherited value</button></details>
    {notice && <p role="status">{notice} <button onClick={() => {undo();setNotice('');}}>Undo</button></p>}{error && <p role="alert">{error}</p>}
    {operation && createPortal(<VisualCopyTray key={`${target.id}/${size}/${operation}`} {...{document,size,target,scopes,operation}} onCancel={() => setOperation(null)} onApply={(next,count,mode) => {run(next,mode === 'link' ? `Linked ${count} versions` : `Copied to ${count} versions`);setOperation(null);}} />,window.document.body)}
  </div></section>;
}
