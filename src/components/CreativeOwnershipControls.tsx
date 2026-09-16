// @ts-nocheck
'use client';
import { useState } from 'react';
import { findCreativeTarget, resetCreativeTargetField } from '@/lib/creative-model';
import { createCreativeOwnershipDefinition, detachCreativeOwnership, linkCreativeOwnership, ownershipScopeIsActive, setCreativeOwnershipField, sharedCreativeFieldReach } from '@/lib/creative-ownership';
import { ownershipDestinations, validOwnershipProperty, copyOwnershipSelection, replaceOwnershipDestinationLocals, suppliedOwnershipFields } from '@/lib/ownership-ui';
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
const sourceLabel = (source) => source?.kind === 'sharedDefinition' ? `Inherited from ${source.name} · ${source.sourceLevel === 'format' ? `${source.format} override` : 'definition default'}` : source?.kind === 'localOverride' ? `Local: ${scopeLabel(source.scope)}` : source?.kind === 'variantRule' ? `Variant: ${scopeLabel(source.scope)}` : source?.kind === 'classRule' ? 'Template style' : source?.kind === 'layerFit' ? 'Base fitting' : 'Base layer';
const geometryFields = ['left','top','width','height'];
const fieldKey = (domain,field) => `${domain}:${field}`;

export function CreativeOwnershipControls({ document, size, target, scopes }) {
  const apply = useEditorStore((state) => state.applyCreativeOwnershipDocument);
  const [name, setName] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [selectedFields,setSelectedFields] = useState(['values:fontSize','values:lineHeight','fit:mode','fit:maxLines','fit:minFontSize']);
  const [selectedDimensions,setSelectedDimensions] = useState([]);
  const [counts,setCounts] = useState([Number(scopes.find(scope => /^offers-/.test(scope))?.split('-')[1] || 0)]);
  const [action,setAction] = useState('copy');
  const [formats,setFormats] = useState([size]);
  const [preserveFormats,setPreserveFormats] = useState(true);
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('values');
  const [requestedField, setField] = useState('fontSize');
  const field = validOwnershipProperty(target, domain, requestedField);
  const [draft, setDraft] = useState('');
  const selectedSource = document.sharedDefinitions?.find((item) => item.id === sourceId);
  const chosenScopes = scopes.filter((scope) => dimensions.some((dimension) => selectedDimensions.includes(dimension.id) && dimension.matches(scope)));
  const eligibleFormats = Object.keys(document.sizes || {}).filter((format) => Boolean(findCreativeTarget(document,format,target.id,scopes)));
  const chosenFormats = eligibleFormats.filter((format) => formats.includes(format));
  const memberships = ownershipDestinations(target.id, chosenFormats, counts, chosenScopes);
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
  const requireFormats = () => { if (!memberships.length) throw new Error('Choose at least one format and offer count.'); };
  const create = () => {
    requireFormats();
    if (!name.trim()) throw new Error('Name the shared definition.');
    const source = sourceValues(size);
    if (!Object.keys(source.values).length && !Object.keys(source.fit).length) throw new Error('Choose at least one authored field.');
    const id = `shared-${crypto.randomUUID()}`;
    const sourceMember = ownershipDestinations(target.id, [size], [Number(scopes.find(scope => /^offers-/.test(scope))?.split('-')[1] || 0)], chosenScopes)[0];
    const allMembers = [...memberships];
    if (!allMembers.some(member => member.size === sourceMember.size && member.scope === sourceMember.scope)) allMembers.push(sourceMember);
    const definition = {id,name:name.trim(),...source,members:allMembers,perSize:{}};
    if (preserveFormats) for (const format of chosenFormats) {
      const formatSource = sourceValues(format);
      definition.perSize[format] = Object.fromEntries(['values','fit'].map((key)=>[key,Object.fromEntries(Object.entries(formatSource[key]).filter(([field,value])=>geometryFields.includes(field)))]));
    }
    const next = createCreativeOwnershipDefinition(replaceOwnershipDestinationLocals(document,allMembers,member => suppliedOwnershipFields(definition,member)),definition);
    setSourceId(id); setName(''); return next;
  };
  const link = () => {
    requireFormats();
    let next = structuredClone(document);
    if (preserveFormats) {
      const definition = next.sharedDefinitions.find((item)=>item.id===sourceId);
      definition.perSize ||= {};
      for (const format of chosenFormats) {
        // Shared format layouts are reused by existing members. Only initialise a new format.
        if (definition.members.some((member)=>member.size===format)) continue;
        const wanted = {values:Object.keys(definition.values || {}),fit:Object.keys(definition.fit || {})};
        const currentFormat = sourceValues(format,{values:wanted.values.filter(field => geometryFields.includes(field)),fit:[]});
        definition.perSize[format] = {...definition.perSize[format],...currentFormat};
      }
    }
    const definition = next.sharedDefinitions.find(item => item.id === sourceId);
    next = replaceOwnershipDestinationLocals(next,memberships,member => suppliedOwnershipFields(definition,member));
    for (const member of memberships) next = linkCreativeOwnership(next,sourceId,member);
    return next;
  };
  return <details className="inspector-section ownership-controls">
    <summary>Copy &amp; share properties</summary>
    <div className="ownership-body">
    <p className="inspector-note">Edit this version using the fields above and below. Copy values once, or keep selected properties linked.</p>
    <div className="ownership-tabs" role="group" aria-label="Property action">
      <button type="button" aria-pressed={action === 'copy'} onClick={() => setAction('copy')}>Copy to</button>
      <button type="button" aria-pressed={action === 'share'} onClick={() => setAction('share')}>Share with</button>
    </div>
    <p className="inspector-note">{action === 'copy' ? 'Replaces chosen destination properties, including local values. Future edits stay independent.' : 'Replaces chosen destination properties, including local values, with a live named link. Other properties stay independent.'}</p>
    <fieldset><legend>Offer counts</legend><div className="ownership-choices">
      {[0,1,2,3].map(count => <label key={count}><input type="checkbox" checked={counts.includes(count)} onChange={() => toggle(counts,setCounts,count)} />{count} {count === 1 ? 'offer' : 'offers'}</label>)}
    </div></fieldset>
    <fieldset><legend>Formats</legend><div className="ownership-choices">{eligibleFormats.map(format => <label key={format}><input type="checkbox" checked={formats.includes(format)} onChange={() => toggle(formats,setFormats,format)} />{format}{format === size ? ' · current' : ''}</label>)}</div></fieldset>
    <details className="ownership-advanced"><summary>Advanced conditions</summary>
      <p className="inspector-note">Optionally restrict each destination to a current condition.</p>
      {dimensions.filter(dimension => dimension.id !== 'offers' && scopes.some(dimension.matches)).map(dimension => <label key={dimension.id}><input type="checkbox" checked={selectedDimensions.includes(dimension.id)} onChange={() => toggle(selectedDimensions,setSelectedDimensions,dimension.id)} />Only {scopeLabel(scopes.filter(dimension.matches).join('.'))}</label>)}
    </details>
    <p className="ownership-scope">{counts.length && chosenFormats.length ? `${[...counts].sort().join(', ')} offers · ${chosenFormats.join(', ')} · ${chosenScopes.length ? `only ${scopeLabel(chosenScopes.join('.'))}` : 'all other conditions'}` : 'Choose an offer count and a format.'}</p>
    <fieldset><legend>Properties</legend>
      {categories.map(category => {
        const available = Object.entries(category.fields).filter(([field]) => target[category.domain]?.[field] !== undefined);
        if (!available.length) return null;
        const keys = available.map(([field]) => fieldKey(category.domain,field));
        return <details key={category.name} className="ownership-category"><summary>{category.name}<span>{keys.filter(key => selectedFields.includes(key)).length}/{keys.length}</span></summary>
          <label><input type="checkbox" checked={keys.every(key => selectedFields.includes(key))} onChange={event => setSelectedFields(event.target.checked ? [...new Set([...selectedFields,...keys])] : selectedFields.filter(key => !keys.includes(key)))} />All {category.name.toLowerCase()}</label>
          {available.map(([field,label]) => <label key={field}><input type="checkbox" checked={selectedFields.includes(fieldKey(category.domain,field))} onChange={() => toggle(selectedFields,setSelectedFields,fieldKey(category.domain,field))} />{label}</label>)}
        </details>;
      })}
    </fieldset>
    {action === 'copy' ? <button className="ownership-primary" type="button" onClick={() => run(() => copyOwnershipSelection(document,size,target.id,scopes,selectedFields,memberships))}>Copy selected properties</button> : <>
      <label><input type="checkbox" checked={preserveFormats} onChange={event => setPreserveFormats(event.target.checked)} />Keep each format’s position and size</label>
      <label className="inspector-field"><span>Shared style name</span><input placeholder="e.g. Offer typography" value={name} onChange={event => setName(event.target.value)} /></label>
      <button className="ownership-primary" type="button" onClick={() => run(create)}>Create live link</button>
      <details className="ownership-advanced"><summary>Use an existing shared style</summary>
        <label className="inspector-field"><span>Shared style</span><select value={sourceId} onChange={event => setSourceId(event.target.value)}><option value="">Choose a style</option>{(document.sharedDefinitions || []).map(definition => <option key={definition.id} value={definition.id}>{definition.name}</option>)}</select></label>
        {selectedSource ? <><p className="inspector-note">Links all properties in {selectedSource.name}: {Object.keys(selectedSource.values || {}).concat(Object.keys(selectedSource.fit || {})).map(key => labels[key] || key).join(', ')}.</p><button type="button" onClick={() => run(link)}>Link destinations</button></> : null}
      </details>
    </>}
    {activeMemberships.length ? <details className="ownership-advanced"><summary>Make independent · {activeMemberships.length} active links</summary>{activeMemberships.map(({definition,member}) => <div key={`${definition.id}/${member.scope}`}><p className="inspector-note">{definition.name} · {scopeLabel(member.scope)}</p><div className="inspector-actions"><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member,fields))}>Make selected properties independent</button><button type="button" onClick={() => run(() => detachCreativeOwnership(document,definition.id,member))}>Make all independent</button></div></div>)}</details> : null}
    <details className="ownership-advanced"><summary>Property inheritance</summary>
      <div className="inspector-grid"><label className="inspector-field"><span>Type</span><select aria-label="Property type" value={domain} onChange={event => {setDomain(event.target.value);setDraft('');}}><option value="values">Layout / style</option><option value="fit">Text fitting</option></select></label><label className="inspector-field"><span>Property</span><select aria-label="Property" value={field} onChange={event => {setField(event.target.value);setDraft('');}}>{Object.keys(target[domain] || {}).map(key => <option key={key} value={key}>{labels[key] || key}</option>)}</select></label></div>
      <p className="inspector-note">{field ? `${labels[field] || field}: ${typeof current === 'object' ? JSON.stringify(current) : String(current ?? 'default')} · ${sourceLabel(provenance?.[field])}` : 'No authored properties of this type.'}</p>
      <label className="inspector-field"><span>New value</span><input value={draft} onChange={event => setDraft(event.target.value)} /></label>
      <div className="inspector-actions"><button type="button" disabled={!field || draft === ''} onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,scopes,domain,field,parsedDraft,'local'))}>Edit this version</button><button type="button" disabled={!['localOverride','variantRule'].includes(provenance?.[field]?.kind)} onClick={() => run(() => resetCreativeTargetField(document,size,target.id,scopes,domain,field))}>Use inherited value</button><button type="button" disabled={draft === '' || provenance?.[field]?.kind !== 'sharedDefinition'} onClick={() => run(() => setCreativeOwnershipField(document,size,target.id,scopes,domain,field,parsedDraft,'shared',provenance[field].definitionId))}>Edit linked value</button></div>
      {sharedReach.members.length ? <p className="inspector-note">Linked edit affects: {sharedReach.members.map(memberLabel).join('; ')}{sharedReach.localExceptions.length ? `. ${sharedReach.localExceptions.length} local exceptions keep their values.` : ''}</p> : null}
    </details>
    {error ? <p className="ownership-error" role="alert">{error}</p> : null}
    </div>
  </details>;
}
