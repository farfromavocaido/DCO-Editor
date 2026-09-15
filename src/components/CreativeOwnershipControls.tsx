// @ts-nocheck
'use client';
import { useState } from 'react';
import { findCreativeTarget, resetCreativeTargetField } from '@/lib/creative-model';
import { copyCreativeOwnership, createCreativeOwnershipDefinition, detachCreativeOwnership, linkCreativeOwnership, ownershipScopeIsActive, setCreativeOwnershipField, sharedCreativeFieldReach } from '@/lib/creative-ownership';
import { useEditorStore } from '@/store/editor-store';

const categories = [
  { name: 'Offer arrangement', domain: 'values', fields: { '--offer-layout-mode': 'Offer arrangement ownership' } },
  { name: 'Position', domain: 'values', fields: { left: 'Horizontal position', top: 'Vertical position' } },
  { name: 'Size', domain: 'values', fields: { width: 'Frame width', height: 'Frame height' } },
  { name: 'Colour', domain: 'values', fields: { color: 'Text colour', backgroundColor: 'Fill colour', borderColor: 'Border colour' } },
  { name: 'Typography', domain: 'values', fields: { fontFamily: 'Font family', fontSize: 'Font size', lineHeight: 'Line height', letterSpacing: 'Letter spacing', textAlign: 'Horizontal alignment', alignItems: 'Vertical alignment' } },
  { name: 'Text fitting', domain: 'fit', fields: { frame: 'Frame sizing', mode: 'Fitting mode', maxLines: 'Maximum lines', minFontSize: 'Minimum font size', minFontSizeRatio: 'Minimum size ratio', wrap: 'Allow wrapping', allowShrink: 'Allow shrinking', overflow: 'Overflow behaviour', shared: 'Equalise fitted size', tracking: 'Tracking adjustment' } },
];
const labels = Object.assign({}, ...categories.map((category) => category.fields));
const dimensions = [
  {id:'offers',label:'Offer count',matches:(scope)=>/^offers-/.test(scope)},
  {id:'cta',label:'CTA shape',matches:(scope)=>/^cta-/.test(scope)},
  {id:'roundel-copy',label:'Roundel copy mode',matches:(scope)=>/^roundel-(split|copy-only)$/.test(scope)},
  {id:'roundel-frame',label:'Roundel visibility',matches:(scope)=>/^roundel-frame-/.test(scope)},
  {id:'tc',label:'Legal copy mode',matches:(scope)=>/^tc-/.test(scope)},
  {id:'frames',label:'Frame count',matches:(scope)=>/^frames-/.test(scope)},
  {id:'ink',label:'Headline colour',matches:(scope)=>/^(navy|white)-headlines$/.test(scope)},
];
const scopeLabel = (scope) => String(scope || '').split('.').filter(Boolean).map((token)=>({
  'tc-solo':'single legal line','tc-prices':'prices and legal lines','cta-rect':'rectangular CTA','cta-roundel':'round CTA',
  'roundel-frame-on':'roundel shown','roundel-frame-off':'roundel hidden','roundel-copy-only':'copy-only roundel','roundel-split':'value and copy roundel',
  'navy-headlines':'navy headlines','white-headlines':'white headlines',
}[token] || token.replace(/^offers-(\d+)$/, '$1 offers').replace(/^frames-(\d+)$/, '$1 frames'))).join(', ') || 'all states';
const sourceLabel = (source) => source?.kind === 'sharedDefinition' ? `Shared: ${source.name} · ${source.sourceLevel === 'format' ? `${source.format} override` : 'definition default'}` : source?.kind === 'localOverride' ? `Local: ${scopeLabel(source.scope)}` : source?.kind === 'variantRule' ? `Variant: ${scopeLabel(source.scope)}` : source?.kind === 'classRule' ? 'Legacy shared class' : source?.kind === 'layerFit' ? 'Base fitting' : 'Base layer';
const geometryFields = ['left','top','width','height'];
const fieldKey = (domain,field) => `${domain}:${field}`;

export function CreativeOwnershipControls({ document, size, target, scopes }) {
  const apply = useEditorStore((state) => state.applyCreativeOwnershipDocument);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [selectedFields,setSelectedFields] = useState(['values:fontSize','values:lineHeight','fit:mode','fit:maxLines','fit:minFontSize']);
  const [selectedDimensions,setSelectedDimensions] = useState(['offers']);
  const [formats,setFormats] = useState([size]);
  const [preserveFormats,setPreserveFormats] = useState(true);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('values');
  const [field, setField] = useState('fontSize');
  const [draft, setDraft] = useState('');
  const selectedSource = document.sharedDefinitions?.find((item) => item.id === sourceId);
  const chosenScopes = scopes.filter((scope) => dimensions.some((dimension) => selectedDimensions.includes(dimension.id) && dimension.matches(scope)));
  const eligibleFormats = Object.keys(document.sizes || {}).filter((format) => Boolean(findCreativeTarget(document,format,target.id,scopes)));
  const chosenFormats = eligibleFormats.filter((format) => formats.includes(format));
  const memberships = chosenFormats.map((format) => ({ size:format, targetId:target.id, scope:chosenScopes.join('.') }));
  const activeMemberships = (document.sharedDefinitions || []).flatMap((definition) => definition.members.filter((member) => member.size === size && member.targetId === target.id && ownershipScopeIsActive(member.scope, scopes)).map((member) => ({ definition, member })));
  const fields = Object.fromEntries(['values','fit'].map((key)=>[key,selectedFields.filter((field)=>field.startsWith(`${key}:`)).map((field)=>field.split(':')[1])]));
  const provenance = domain === 'fit' ? target.fitProvenance : target.valueProvenance;
  const current = (domain === 'fit' ? target.fit : target.values)?.[field];
  const sharedReach = sharedCreativeFieldReach(document, provenance?.[field]);
  const memberLabel = (member) => `${member.size} · ${findCreativeTarget(document,member.size,member.targetId,[])?.label || member.targetId} · ${scopeLabel(member.scope)}`;
  const run = (operation) => { try { apply(operation()); setError(''); } catch (failure) { setError(failure.message); } };
  const parsedDraft = draft === 'true' ? true : draft === 'false' ? false : draft !== '' && Number.isFinite(Number(draft)) ? Number(draft) : draft;
  const toggle = (list,setList,value) => setList(list.includes(value) ? list.filter((item)=>item!==value) : [...list,value]);
  const sourceValues = (format, wantedFields=fields) => {
    const memberTarget = findCreativeTarget(document,format,target.id,scopes);
    return Object.fromEntries(['values','fit'].map((key)=>[key,Object.fromEntries(wantedFields[key].filter((field)=>memberTarget?.[key]?.[field] !== undefined).map((field)=>[field,memberTarget[key][field]]))]));
  };
  const requireFormats = () => { if (!memberships.length) throw new Error('Choose at least one format.'); };
  const create = () => {
    requireFormats();
    if (!name.trim()) throw new Error('Name the shared definition.');
    const source = sourceValues(size);
    if (!Object.keys(source.values).length && !Object.keys(source.fit).length) throw new Error('Choose at least one authored field.');
    const id = `shared-${crypto.randomUUID()}`;
    const definition = {id,name:name.trim(),...source,members:memberships,perSize:{}};
    if (preserveFormats) for (const format of chosenFormats) {
      const formatSource = sourceValues(format);
      definition.perSize[format] = Object.fromEntries(['values','fit'].map((key)=>[key,Object.fromEntries(Object.entries(formatSource[key]).filter(([field,value])=>geometryFields.includes(field) || JSON.stringify(value)!==JSON.stringify(source[key][field])))]));
    }
    const next = createCreativeOwnershipDefinition(document,definition);
    setSourceId(id); setName(''); return next;
  };
  const link = () => {
    requireFormats();
    let next = JSON.parse(JSON.stringify(document));
    if (preserveFormats) {
      const definition = next.sharedDefinitions.find((item)=>item.id===sourceId);
      definition.perSize ||= {};
      for (const format of chosenFormats) {
        // Shared format layouts are reused by existing members. Only initialise a new format.
        if (definition.members.some((member)=>member.size===format)) continue;
        const wanted = {values:Object.keys(definition.values || {}),fit:Object.keys(definition.fit || {})};
        const currentFormat = sourceValues(format,wanted);
        definition.perSize[format] = {...definition.perSize[format],...currentFormat};
      }
    }
    for (const member of memberships) next = linkCreativeOwnership(next,sourceId,member);
    return next;
  };
  return <details className="inspector-section">
    <summary>Ownership and sharing</summary>
    <p className="inspector-note">Choose exactly which properties, states and formats share values. Canvas groups and animation stay independent.</p>
    <div className="inspector-grid">
      <label>Property type<select value={domain} onChange={(event) => { setDomain(event.target.value); setField(event.target.value === 'fit' ? 'maxLines' : 'fontSize'); }}><option value="values">Layout / style</option><option value="fit">Text fitting</option></select></label>
      <label>Property<select value={field} onChange={(event) => setField(event.target.value)}>{Object.keys(domain === 'fit' ? target.fit || {} : target.values || {}).map((key) => <option key={key} value={key}>{labels[key] || key}</option>)}</select></label>
    </div>
    <p className="inspector-note">{labels[field] || field}: {typeof current === 'object' ? JSON.stringify(current) : String(current ?? 'default')} · {sourceLabel(provenance?.[field])}</p>
    <label>New value<input value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
    <div className="inspector-actions">
      <button type="button" onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,chosenScopes,domain,field,parsedDraft,'local'))}>Set local value</button>
      <button type="button" disabled={!['localOverride','variantRule'].includes(provenance?.[field]?.kind)} onClick={() => run(() => resetCreativeTargetField(document,size,target.id,scopes,domain,field))}>Reset local field</button>
      <button type="button" disabled={provenance?.[field]?.kind !== 'sharedDefinition'} onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,scopes,domain,field,parsedDraft,'shared',provenance[field].definitionId))}>Edit shared source</button>
    </div>
    {provenance?.[field]?.kind === 'sharedDefinition' ? <>
      <p className="inspector-note">{provenance[field].sourceLevel === 'format' ? `${provenance[field].format} shared override` : 'Shared definition default'} edit affects: {sharedReach.members.map(memberLabel).join('; ') || 'no members'}</p>
      {sharedReach.localExceptions.length ? <p className="inspector-note">Local exceptions can keep their current values: {sharedReach.localExceptions.map(({member,scopes}) => `${memberLabel(member)} (${scopes.map(scopeLabel).join('; ')})`).join('; ')}</p> : null}
    </> : null}
    <fieldset><legend>Apply in these states</legend>
      <p className="inspector-note">{scopeLabel(chosenScopes.join('.'))}. Unchecked conditions can vary independently.</p>
      {dimensions.filter((dimension)=>scopes.some(dimension.matches)).map((dimension)=><label key={dimension.id}><input type="checkbox" checked={selectedDimensions.includes(dimension.id)} onChange={()=>toggle(selectedDimensions,setSelectedDimensions,dimension.id)} />{dimension.label}: {scopeLabel(scopes.filter(dimension.matches).join('.'))}</label>)}
    </fieldset>
    <fieldset><legend>Formats for new links</legend>{eligibleFormats.map((format)=><label key={format}><input type="checkbox" checked={formats.includes(format)} onChange={()=>toggle(formats,setFormats,format)} />{format}{format===size?' (current)':''}</label>)}
      <label><input type="checkbox" checked={preserveFormats} onChange={(event)=>setPreserveFormats(event.target.checked)} />Keep each format’s current values</label>
    </fieldset>
    <fieldset><legend>Properties to share or detach</legend>
      {categories.map((category)=>{
        const available = Object.entries(category.fields).filter(([field])=>target[category.domain]?.[field] !== undefined);
        if (!available.length) return null;
        const keys = available.map(([field])=>fieldKey(category.domain,field));
        return <details key={category.name}><summary><label onClick={(event)=>event.stopPropagation()}><input type="checkbox" checked={keys.every((key)=>selectedFields.includes(key))} onChange={(event)=>setSelectedFields(event.target.checked ? [...new Set([...selectedFields,...keys])] : selectedFields.filter((key)=>!keys.includes(key)))} />{category.name}</label></summary>
          {available.map(([field,label])=><label key={field}><input type="checkbox" checked={selectedFields.includes(fieldKey(category.domain,field))} onChange={()=>toggle(selectedFields,setSelectedFields,fieldKey(category.domain,field))} />{label}</label>)}
        </details>;
      })}
    </fieldset>
    <label>New shared name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" onClick={() => run(create)}>Create shared source</button>
    <label>Existing source<select value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Choose source</option>{(document.sharedDefinitions || []).map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>
    {selectedSource ? <><p className="inspector-note">Members: {selectedSource.members.map(memberLabel).join('; ') || 'none'}</p><button type="button" onClick={() => run(link)}>Link selected formats</button><button type="button" onClick={() => run(() => {requireFormats();return memberships.reduce((next,member)=>copyCreativeOwnership(next,sourceId,member),document);})}>Copy once to selected formats</button></> : null}
    {activeMemberships.map(({definition,member}) => <div key={`${definition.id}/${member.scope}`}><p className="inspector-note">Linked to {definition.name}: {definition.members.length} members. {scopeLabel(member.scope)}</p><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member,fields))}>Detach chosen properties</button><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member))}>Detach this membership</button></div>)}
    {error ? <p role="alert">{error}</p> : null}
  </details>;
}
