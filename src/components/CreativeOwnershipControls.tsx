// @ts-nocheck
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findCreativeTarget, resetCreativeTargetField } from '@/lib/creative-model';
import { createCreativeOwnershipDefinition, detachCreativeOwnership, ownershipScopeIsActive, setCreativeOwnershipField, sharedCreativeFieldReach } from '@/lib/creative-ownership';
import { campaignConcreteDestinations, resolveOwnershipVersionRow, copyOwnershipSelection, replaceOwnershipDestinationLocals, replaceOwnershipDestinationLinks, selectedOwnershipValues, suppliedOwnershipFields, validOwnershipProperty } from '@/lib/ownership-ui';
import { campaignVariantModel, campaignScopes } from '@/lib/campaign-variants';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';
import { OwnershipProductionPreview } from './OwnershipProductionPreview';
import { categories, labels } from './ownership-properties';
const geometry = ['left','top','width','height'];
const text = value => typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'Default');
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
const primaryDimension = dimension => dimension.header !== false && !dimension.derived;
const sourceName = source => source?.kind === 'sharedDefinition' ? `Link: ${source.name}` : source?.kind === 'localOverride' ? 'Local value' : 'Campaign default';

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
  const memberships = (document.sharedDefinitions || []).flatMap(definition => definition.members.filter(member => member.size === size && member.targetId === target.id && ownershipScopeIsActive(member.scope,scopes)).filter(member => Object.values(suppliedOwnershipFields(definition,member)).some(fields => fields.length)).map(member => ({definition,member})));
  const run = (next,message) => { apply(next,message); setNotice(message); setError(''); };
  const property = validOwnershipProperty(target,domain,field);
  const editFields = edit ? ['values','fit'].flatMap(domain => [...new Set([...Object.keys(edit[domain] || {}),...Object.keys(edit.perSize?.[size]?.[domain] || {})])].map(field => `${domain}:${field}`)) : [];
  const [editDomain,editKey] = field.split(':');
  const editSource = (editDomain === 'fit' ? target.fitProvenance : target.valueProvenance)?.[editKey];
  const editReach = sharedCreativeFieldReach(document,editSource);
  const parsed = draft === 'true' ? true : draft === 'false' ? false : draft !== '' && Number.isFinite(Number(draft)) ? Number(draft) : draft;
  return <section className="inspector-section ownership-controls"><h3>Copy properties</h3><div className="ownership-body">

    <div className="inspector-actions"><button onClick={() => setOperation('from')}>Copy from…</button><button onClick={() => setOperation('to')}>Copy to…</button></div>
    <h3 title="Linked properties update together. Unlink keeps the current appearance.">Linked properties</h3>
    {memberships.map(({definition,member}) => <div className="relationship-link" key={`${definition.id}/${member.scope}`}><strong>{definition.name}</strong><p>{['values','fit'].flatMap(domain => suppliedOwnershipFields(definition,member)[domain].map(field => labels[field] || field)).join(', ') || 'No linked properties'}</p><details><summary>{definition.members.length} members</summary>{definition.members.map((item,index) => <p key={index}>{memberDescription(document,item)}</p>)}</details><div className="inspector-actions"><button onClick={() => {setEdit(definition);setField('');setDraft('');}}>Edit shared…</button><button onClick={() => run(detachCreativeOwnership(document,definition.id,member),'Unlinked; appearance kept')}>Unlink — keep appearance</button></div></div>)}
    {!memberships.length && <p className="inspector-note">Not linked.</p>}
    <button onClick={() => setOperation('link')}>Link properties…</button>
    {edit && <div className="relationship-link"><strong>Edit shared: {edit.name}</strong><p>Changes apply to linked members. Existing local exceptions stay in place.</p>{editReach.members.length > 0 && <p>Affects {editReach.members.length} members: {editReach.members.map(member => memberDescription(document,member)).join('; ')}. {editReach.localExceptions.length ? `${editReach.localExceptions.length} members have local exceptions.` : ''}</p>}<select aria-label="Shared property" value={field} onChange={event => setField(event.target.value)}><option value="">Choose a property</option>{editFields.map(key => <option key={key} value={key}>{labels[key.split(':')[1]] || key}</option>)}</select><input aria-label="Shared value" value={draft} onChange={event => setDraft(event.target.value)} /><button disabled={!field || draft === ''} onClick={() => {try {const [domain,key] = field.split(':');run(setCreativeOwnershipField(document,size,target.id,scopes,domain,key,parsed,'shared',edit.id),'Updated linked property');setEdit(null);} catch(cause){setError(cause.message);}}}>Apply shared edit</button><button onClick={() => setEdit(null)}>Cancel</button></div>}
    <details><summary>Use defaults</summary><p className="inspector-note">Remove a local override so this version uses its inherited value.</p><select aria-label="Default property type" value={domain} onChange={event => setDomain(event.target.value)}><option value="values">Layout / style</option><option value="fit">Text fitting</option></select><select aria-label="Default property" value={property} onChange={event => setField(event.target.value)}>{Object.keys(target[domain] || {}).map(key => <option key={key} value={key}>{labels[key] || key}</option>)}</select><button disabled={!property} onClick={() => run(resetCreativeTargetField(document,size,target.id,scopes,domain,property),'Using inherited value')}>Use inherited value</button></details>
    {notice && <p role="status">{notice} <button onClick={() => {undo();setNotice('');}}>Undo</button></p>}{error && <p role="alert">{error}</p>}
    {operation && createPortal(<OwnershipTransaction key={`${target.id}/${size}/${operation}`} {...{document,size,target,scopes,operation}} onCancel={() => setOperation(null)} onApply={(next,count) => {run(next,operation === 'link' ? `Linked ${count} versions` : `Copied to ${count} versions`);setOperation(null);}} />,window.document.body)}
  </div></section>;
}

function OwnershipTransaction({document,size,target,scopes,operation,onCancel,onApply}) {
  const row = useEditorStore(selectPreviewFeedRow);
  const feedRows = useEditorStore(state => state.feedDraft?.rows) || document.feed?.sampleRows || [];
  const percent = useEditorStore(state => state.percent);
  const model = campaignVariantModel(document);
  const [step,setStep] = useState(0);
  const [previewPercent,setPreviewPercent] = useState(percent);
  const [sourceSize,setSourceSize] = useState(size);
  const [sourceChoices,setSourceChoices] = useState(Object.fromEntries(model.dimensions.filter(dimension => !dimension.derived).map(dimension => [dimension.id,dimension.options.find(option => tokens(option.scope).every(token => scopes.includes(token)))?.value ?? dimension.defaultValue])));
  const [choices,setChoices] = useState(Object.fromEntries(model.dimensions.filter(dimension => !dimension.derived).map(dimension => [dimension.id,[dimension.options.find(option => tokens(option.scope).every(token => scopes.includes(token)))?.value ?? dimension.defaultValue]])));
  const [formats,setFormats] = useState([size]);
  const [selected,setSelected] = useState([]);
  const [name,setName] = useState('');
  const [keepGeometry,setKeepGeometry] = useState(true);
  const [reviewIndex,setReviewIndex] = useState(0);
  const dialog = useRef(null);
  useEffect(() => {const previous = window.document.activeElement; dialog.current?.focus(); return () => previous?.focus?.();},[]);
  const requestedSourceScopes = operation === 'to' ? scopes : model.dimensions.filter(dimension => !dimension.derived).flatMap(dimension => tokens(dimension.options.find(option => option.value === sourceChoices[dimension.id])?.scope));
  const sourceState = useMemo(() => {try {const resolved=resolveOwnershipVersionRow(document,row,requestedSourceScopes,feedRows);return {...resolved,scopes:campaignScopes(document,resolved.row),error:''};} catch(cause){return {row,scopes:requestedSourceScopes,error:cause.message};}},[document,row,feedRows,JSON.stringify(requestedSourceScopes)]);
  const sourceScopes = sourceState.scopes;
  const source = findCreativeTarget(document,sourceSize,target.id,sourceScopes);
  const sourceRow = sourceState.row;
  const toggle = (values,value) => values.includes(value) ? values.filter(item => item !== value) : [...values,value];
  const computed = useMemo(() => {
    try {
      if (sourceState.error) throw new Error(sourceState.error);
      const destinations = operation === 'from' ? [{size,targetId:target.id,scope:[...scopes].sort().join('.')}] : campaignConcreteDestinations(document,target.id,formats,choices,row,feedRows);
      if (!destinations.length) throw new Error('Choose at least one valid value in every dimension and a format.');
      if (!selected.length) return {destinations,next:null,error:''};
      if (operation !== 'link') return {destinations,next:copyOwnershipSelection(document,sourceSize,target.id,sourceScopes,selected,destinations),error:''};
      const bundle = selectedOwnershipValues(source,selected);
      if (!Object.values(bundle).some(values => Object.keys(values).length)) throw new Error('Choose at least one authored property.');
      const members = [...destinations];
      const sourceMember = {size:sourceSize,targetId:target.id,scope:[...sourceScopes].sort().join('.')};
      if (!members.some(member => member.size === sourceMember.size && ownershipScopeIsActive(member.scope,sourceScopes))) members.push(sourceMember);
      const definition = {id:'relationship-preview',name:name.trim() || 'New linked properties',...bundle,members,perSize:{}};
      if (keepGeometry) for (const format of [...new Set(members.map(member => member.size))]) definition.perSize[format] = {values:Object.fromEntries(Object.entries(findCreativeTarget(document,format,target.id,sourceScopes)?.values || {}).filter(([key]) => geometry.includes(key) && selected.includes(`values:${key}`)))};
      const fields = member => suppliedOwnershipFields(definition,member);
      const next = createCreativeOwnershipDefinition(replaceOwnershipDestinationLocals(replaceOwnershipDestinationLinks(document,members,fields),members,fields),definition);
      return {destinations,next,error:''};
    } catch(cause) {return {destinations:[],next:null,error:cause.message};}
  },[document,sourceSize,target.id,JSON.stringify(sourceScopes),JSON.stringify(scopes),selected,formats,choices,keepGeometry,name,operation,size,row,feedRows]);
  const destination = computed.destinations[Math.min(reviewIndex,computed.destinations.length-1)];
  const destinationState = useMemo(() => {try {return {...(destination ? resolveOwnershipVersionRow(document,row,tokens(destination.scope),feedRows) : {row}),error:''};}catch(cause){return {row,error:cause.message};}},[document,row,feedRows,destination?.scope]);
  const destinationRow = destinationState.row;
  const before = destination && findCreativeTarget(document,destination.size,target.id,campaignScopes(document,destinationRow));
  const after = destination && computed.next && findCreativeTarget(computed.next,destination.size,target.id,campaignScopes(document,destinationRow));
  const availableFormats = Object.keys(document.sizes).filter(format => findCreativeTarget(document,format,target.id,sourceScopes));
  const dimensionPicker = (dimension,sourcePicker=false) => <div className="copy-choice-row" key={dimension.id}><span>{dimension.label}</span>{sourcePicker ? <select aria-label={`Source ${dimension.label}`} value={String(sourceChoices[dimension.id])} onChange={event => setSourceChoices({...sourceChoices,[dimension.id]:dimension.options.find(option => String(option.value) === event.target.value)?.value})}>{dimension.options.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select> : <div className="copy-chips">{dimension.options.map(option => <button type="button" key={String(option.value)} aria-pressed={(choices[dimension.id] || []).includes(option.value)} onClick={() => setChoices({...choices,[dimension.id]:toggle(choices[dimension.id] || [],option.value)})}>{option.label}</button>)}</div>}</div>;
  const total = computed.destinations.length;
  const selectionNames = categories.filter(category=>Object.keys(category.fields).some(key=>selected.includes(`${category.domain}:${key}`))).map(category=>category.name).join(', ');
  const title = operation === 'link' ? 'Link properties' : operation === 'from' ? 'Copy into this version' : 'Copy to other versions';
  const applyChange = () => {let next=computed.next;if(operation==='link'){next=structuredClone(next);next.sharedDefinitions.at(-1).id=`shared-${crypto.randomUUID()}`;}onApply(next,total);};
  const preview = (doc,feed,format,label,large=false) => <OwnershipProductionPreview document={doc} row={feed} size={format} percent={previewPercent} label={label} targetId={target.id} maxHeight={large?360:180} maxWidth={large?340:220} onRevealTime={label==='Before'?setPreviewPercent:undefined}/>;
  return <div className="relationship-backdrop" onKeyDown={event => {if(event.key === 'Escape') onCancel(); if(event.key === 'Tab'){const items = [...dialog.current.querySelectorAll('button:not(:disabled),input,select,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey && window.document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && window.document.activeElement===last){event.preventDefault();first?.focus();}}}}><div className="relationship-dialog copy-wizard" role="dialog" aria-modal="true" aria-labelledby="relationship-title" ref={dialog} tabIndex={-1}>
    <header><div><h2 id="relationship-title">{title}</h2><p>{readable(target.label || target.id)}</p></div><button aria-label="Close comparison" onClick={onCancel}>×</button></header>
    <nav className="copy-steps" aria-label="Copy progress">{['Versions','Properties','Review'].map((label,index)=><span key={label} aria-current={step===index?'step':undefined}>{index+1}. {label}</span>)}</nav>
    <div className="copy-route"><div><small>FROM</small><strong>{sourceSize.replace('x',' × ')}</strong><span>{versionDescription(document,sourceScopes.join('.'))}</span></div><span aria-hidden="true">→</span><div><small>TO</small><strong>{operation==='from'?size.replace('x',' × '):`${total} ${total===1?'version':'versions'}`}</strong><span>{operation==='from'?versionDescription(document,scopes.join('.')):formats.join(' · ')}</span></div></div>
    <div className="copy-step-body">
    {step===0 && <section><h3>{operation==='from'?'Which version should supply the values?':'Where should these values go?'}</h3>
      {operation==='from' ? <><label>Source format <select aria-label="Source format" value={sourceSize} onChange={event=>setSourceSize(event.target.value)}>{availableFormats.map(format=><option key={format}>{format}</option>)}</select></label>{model.dimensions.filter(d=>!d.derived).map(d=>dimensionPicker(d,true))}</> : <>
        <div className="copy-choice-row"><span>Size</span><div className="copy-chips">{availableFormats.map(format=><button key={format} aria-pressed={formats.includes(format)} onClick={()=>setFormats(toggle(formats,format))}>{format.replace('x',' × ')}</button>)}</div></div>
        {model.dimensions.filter(primaryDimension).map(d=>dimensionPicker(d))}
        {model.dimensions.some(d=>!d.derived&&!primaryDimension(d)) && <details><summary>More version choices</summary>{model.dimensions.filter(d=>!d.derived&&!primaryDimension(d)).map(d=>dimensionPicker(d))}</details>}
      </>}
      {sourceState.synthesized && <p role="status">No saved sample for this version; using the current copy.</p>}
      {operation==='link' && <label>Link name <input aria-label="Link name" placeholder="e.g. Roundel layout" value={name} onChange={event=>setName(event.target.value)}/></label>}
    </section>}
    {step===1 && <section><h3>What should {operation==='link'?'stay linked':'be copied'}?</h3><div className="copy-bundles">{categories.map(category=>{
      const entries=Object.entries(category.fields).filter(([key])=>source?.[category.domain]?.[key]!==undefined);
      if(!entries.length)return null;
      const keys=entries.map(([key])=>`${category.domain}:${key}`),count=keys.filter(key=>selected.includes(key)).length;
      return <div className="copy-bundle" key={category.name}><button aria-pressed={count===keys.length} onClick={()=>setSelected(count===keys.length?selected.filter(key=>!keys.includes(key)):[...new Set([...selected,...keys])])}><strong>{category.name}</strong><span>{count?`${count} selected`:entries.map(([,label])=>label).join(', ')}</span></button><details><summary>Choose individual properties</summary>{entries.map(([key,label])=><label key={key}><input type="checkbox" checked={selected.includes(`${category.domain}:${key}`)} onChange={()=>setSelected(toggle(selected,`${category.domain}:${key}`))}/>{label}<small>{text(source[category.domain][key])}</small></label>)}</details></div>;
    })}</div>{operation==='link'&&<label><input type="checkbox" checked={keepGeometry} onChange={event=>setKeepGeometry(event.target.checked)}/>Keep each size’s current position and dimensions</label>}</section>}
    {step===2 && destination && <section><div className="copy-review-heading"><h3>{selectionNames}</h3>{total>1&&<select aria-label="Review destination" value={Math.min(reviewIndex,total-1)} onChange={event=>setReviewIndex(Number(event.target.value))}>{computed.destinations.map((member,index)=><option key={index} value={index}>{memberDescription(document,member)}</option>)}</select>}</div><p className="copy-review-version">{memberDescription(document,destination)}</p>
      {destinationState.synthesized&&<p role="status">No saved sample for this destination; showing the current copy.</p>}
      <div className="copy-review-previews">{preview(document,destinationRow,destination.size,'Before',true)}{computed.next&&preview(computed.next,destinationRow,destination.size,'After',true)}</div>
      <label className="copy-timeline">Preview time <input aria-label="Comparison timeline" type="range" min="0" max="100" value={previewPercent} onChange={event=>setPreviewPercent(Number(event.target.value))}/>{((previewPercent/100)*Number(document.clock?.durationS||15)).toFixed(1)}s</label>
      <details className="copy-value-details"><summary>Changed values · {selected.length} properties</summary><table><thead><tr><th>Property</th><th>Before</th><th>After</th></tr></thead><tbody>{selected.map(key=>{const [domain,field]=key.split(':');return <tr key={key}><th>{labels[field]||field}</th><td>{text(before?.[domain]?.[field])}<small>{sourceName(before?.[domain==='values'?'valueProvenance':'fitProvenance']?.[field])}</small></td><td>{text(after?.[domain]?.[field])}</td></tr>;})}</tbody></table></details>
      {operation==='link'&&<p>Linked as “{name}”.</p>}
    </section>}
    {(computed.error||destinationState.error)&&<p role="alert" className="ownership-error">{computed.error||destinationState.error}</p>}
    </div>
    <footer><button onClick={step?()=>setStep(step-1):onCancel}>{step?'Back':'Cancel'}</button>{step<2?<button className="ownership-primary" disabled={step===0?(!total||!!sourceState.error||(operation==='link'&&!name.trim())):(!computed.next||!selected.length||!!computed.error)} onClick={()=>setStep(step+1)}>{step===0?'Choose properties':'Review changes'}</button>:<button className="ownership-primary" disabled={!computed.next||!!computed.error||!!destinationState.error} onClick={applyChange}>{operation==='link'?'Link':'Copy'} to {total} {total===1?'version':'versions'}</button>}</footer>
  </div></div>;
}
