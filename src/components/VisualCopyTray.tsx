// @ts-nocheck
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findCreativeComponent, componentBounds, transferCreativeComponent, createComponentLink } from '@/lib/creative-components';
import { findCreativeTarget } from '@/lib/creative-model';
import { campaignScopes, campaignVariantModel, campaignRowForScopes } from '@/lib/campaign-variants';
import { campaignConcreteDestinations, resolveOwnershipVersionRow, copyOwnershipSelection, selectedOwnershipValues, suppliedOwnershipFields, replaceOwnershipDestinationLinks, replaceOwnershipDestinationLocals } from '@/lib/ownership-ui';
import { createCreativeOwnershipDefinition } from '@/lib/creative-ownership';
import { selectPreviewFeedRow, useEditorStore } from '@/store/editor-store';
import { OwnershipProductionPreview } from './OwnershipProductionPreview';
import { categories, labels } from './ownership-properties';
const parts = scope => String(scope || '').split('.').filter(Boolean);
const keyOf = member => `${member.size}/${parts(member.scope).sort().join('.')}`;
const geometry = ['left','top','width','height'];
const describe = (model,scope) => model.dimensions.filter(d=>!d.derived).flatMap(d=>{
  const option=d.options.find(o=>parts(scope).includes(o.scope));
  return option ? [`${d.label}: ${option.label}`] : [];
}).join(' · ');

/** All changes stay in this tray until the single apply action. */
export function VisualCopyTray({document,size,target,scopes,operation,onCancel,onApply}) {
  const row=useEditorStore(selectPreviewFeedRow);
  const draftRows=useEditorStore(state=>state.feedDraft?.rows);
  const rows=draftRows || document.feed?.sampleRows || [];
  const initialPercent=useEditorStore(state=>state.percent);
  const model=campaignVariantModel(document);
  const editable=model.dimensions.filter(d=>!d.derived);
  const componentId=target.componentId || (target.kind==='component'?target.id:null);
  const isComponent=Boolean(componentId);
  const component=isComponent?findCreativeComponent(document,size,componentId):null;
  const stateDimensions=model.dimensions.filter(d=>component?.stateDimensions?.includes(d.id));
  const stateTokens=new Set(stateDimensions.flatMap(d=>d.options.map(o=>o.scope)));
  const memberKey=member=>keyOf({...member,scope:parts(member.scope).filter(scope=>!isComponent||!stateTokens.has(scope)).join('.')});
  const [sizing,setSizing]=useState('destination');
  const [placements,setPlacements]=useState({});
  const [arrangement,setArrangement]=useState('');
  const [sourceMember,setSourceMember]=useState({size,targetId:target.id,scope:[...scopes].sort().join('.')});
  const [picks,setPicks]=useState(()=>operation==='from'?{[memberKey({size,scope:scopes.join('.')})]:{size,targetId:target.id,scope:scopes.join('.'),row}}:{});
  const [fields,setFields]=useState([]);
  const [filterSize,setFilterSize]=useState(isComponent?'*':size);
  const [filters,setFilters]=useState(Object.fromEntries(editable.map((d,i)=>[d.id,i===0&&!isComponent?'*':String(d.options.find(o=>scopes.includes(o.scope))?.value ?? d.defaultValue)])));
  const [filterOpen,setFilterOpen]=useState(false);
  const [showSelected,setShowSelected]=useState(false);
  const [sourcePicking,setSourcePicking]=useState(operation==='from');
  const [mode,setMode]=useState(operation==='link'?'link':'copy');
  const [name,setName]=useState('');
  const [keepGeometry,setKeepGeometry]=useState(true);
  const [after,setAfter]=useState(true);
  const [percent,setPercent]=useState(initialPercent);
  const [page,setPage]=useState(0);
  const [inspect,setInspect]=useState(null);
  const [error,setError]=useState('');
  const dialog=useRef(null);
  useEffect(()=>{const previous=window.document.activeElement;dialog.current?.focus();return()=>previous?.focus?.();},[]);
  const sourceState=useMemo(()=>resolveOwnershipVersionRow(document,row,parts(sourceMember.scope),rows),[document,row,rows,sourceMember]);
  const sourceScopes=useMemo(()=>campaignScopes(document,sourceState.row),[document,sourceState.row]);
  const source=isComponent?{values:componentBounds(document,sourceMember.size,componentId,sourceScopes)||{},fit:{}}:findCreativeTarget(document,sourceMember.size,target.id,sourceScopes);
  const availableSizes=Object.keys(document.sizes).filter(s=>isComponent || findCreativeTarget(document,s,target.id,scopes));
  const inventory=useMemo(()=>{
    try {
      const choices=Object.fromEntries(editable.map(d=>[d.id,filters[d.id]==='*'?d.options.map(o=>o.value):d.options.filter(o=>String(o.value)===filters[d.id]).map(o=>o.value)]));
      const members=campaignConcreteDestinations(document,target.id,filterSize==='*'?availableSizes:[filterSize],choices,row,rows);
      return {items:members.map(member=>({...member,...resolveOwnershipVersionRow(document,row,parts(member.scope),rows)})),error:''};
    } catch(cause){return {items:[],error:cause.message};}
  },[document,target.id,filterSize,filters,row,rows]);
  const picked=Object.values(picks);
  const proposal=useMemo(()=>{
    if(!picked.length || (!isComponent && !fields.length))return {document:null,error:''};
    try {
      if(isComponent) {
        const destinations=picked.map(({size,scope})=>({size,scope}));
        if(mode==='link')return {document:createComponentLink(document,{id:'component-link-preview',name:'New component link',componentId,source:{size:sourceMember.size,scope:sourceScopes.join('.')},destinations,sizing,placements}),error:''};
        return {document:transferCreativeComponent(document,{componentId,sourceSize:sourceMember.size,sourceScopes,destinations,sizing,placements}),error:''};
      }
      if(mode==='copy')return {document:copyOwnershipSelection(document,sourceMember.size,target.id,sourceScopes,fields,picked),error:''};
      const bundle=selectedOwnershipValues(source,fields);
      const members=[...picked,sourceMember].filter((m,i,a)=>a.findIndex(other=>memberKey(other)===memberKey(m))===i);
      const definition={id:'visual-link-preview',name:'New link',...bundle,members:members.map(({size,targetId,scope})=>({size,targetId,scope})),perSize:{}};
      if(keepGeometry)for(const format of [...new Set(members.map(m=>m.size))])definition.perSize[format]={values:Object.fromEntries(Object.entries(findCreativeTarget(document,format,target.id,sourceScopes)?.values||{}).filter(([key])=>geometry.includes(key)&&fields.includes(`values:${key}`)))};
      const owned=member=>suppliedOwnershipFields(definition,member);
      return {document:createCreativeOwnershipDefinition(replaceOwnershipDestinationLocals(replaceOwnershipDestinationLinks(document,members,owned),members,owned),definition),error:''};
    }catch(cause){return {document:null,error:cause.message};}
  },[document,sourceMember,sourceScopes,fields,picks,mode,keepGeometry,isComponent,componentId,sizing,placements]);
  const sourceKey=memberKey(sourceMember);
  const choose=member=>{
    setError('');
    const key=memberKey(member);
    if(sourcePicking){setSourceMember({size:member.size,targetId:target.id,scope:member.scope});setPicks(old=>Object.fromEntries(Object.entries(old).filter(([id])=>id!==key)));setSourcePicking(false);if(operation==='from')setShowSelected(true);return;}
    if(key===sourceKey)return;
    setPicks(old=>old[key]?Object.fromEntries(Object.entries(old).filter(([id])=>id!==key)):{...old,[key]:member});
  };
  const displayedItems=showSelected?picked:inventory.items;
  const visible=displayedItems.slice(page*8,page*8+8);
  const selectedNames=isComponent?(component?.name||'component').toLowerCase():categories.filter(c=>Object.keys(c.fields).some(key=>fields.includes(`${c.domain}:${key}`))).map(c=>c.name.toLowerCase()).join(' + ');
  const hiddenPicked=picked.filter(m=>!inventory.items.some(item=>memberKey(item)===memberKey(m))).length;
  const changeFilter=(update)=>{update();setPage(0);};
  const apply=()=>{if(!proposal.document)return;try{let next=proposal.document;if(mode==='link'){next=structuredClone(next);const definition=isComponent?next.componentLinks.at(-1):next.sharedDefinitions.at(-1);definition.id=`${isComponent?'component-link':'shared'}-${crypto.randomUUID()}`;definition.name=name.trim();}onApply(next,picked.length,mode);}catch(cause){setError(cause.message);}};
  const arrangementRows=useMemo(()=>new Map(),[document,rows,arrangement]);
  const previewRow=member=>{
    if(!arrangement)return member.row;
    const cacheKey=memberKey(member);if(arrangementRows.has(cacheKey))return arrangementRows.get(cacheKey);
    const dimension=stateDimensions.find(d=>d.options.some(o=>o.scope===arrangement));
    const viewScopes=[...parts(member.scope).filter(scope=>!dimension.options.some(o=>o.scope===scope)),arrangement];
    const resolved=resolveOwnershipVersionRow(document,member.row,viewScopes,rows).row;
    const feed=campaignRowForScopes(document,resolved,viewScopes);arrangementRows.set(cacheKey,feed);return feed;
  };
  const preview=(doc,member,label,large=false,reveal=false)=>{
    const definition=isComponent?findCreativeComponent(doc,member.size,componentId):null;
    const feed=previewRow(member);
    const editablePlacement=isComponent && label==='After' && picks[memberKey(member)] && proposal.document;
    const bounds=editablePlacement?componentBounds(doc,member.size,componentId,campaignScopes(doc,feed)):undefined;
    return <OwnershipProductionPreview document={doc} row={feed} size={member.size} percent={percent} label={label} targetId={target.id} targetIds={definition?.parts.map(p=>p.targetId)} maxHeight={large?360:240} maxWidth={label==='Source ad'?(window.innerWidth<900?180:240):large?340:230} onRevealTime={reveal?setPercent:undefined} editingBounds={bounds} preserveAspect={definition?.resize==='proportional'} onPlacementChange={editablePlacement?next=>{setSizing('destination');setPlacements(old=>({...old,[`${member.size}/${member.scope}`]:next}));}:undefined}/>;
  };
  const inspectBounds=isComponent&&inspect&&picks[memberKey(inspect)]&&proposal.document?componentBounds(proposal.document,inspect.size,componentId,campaignScopes(proposal.document,previewRow(inspect))):null;

  const closeInspect=()=>{setInspect(null);dialog.current?.focus();};
  useEffect(()=>{if(inspect)dialog.current?.querySelector('.visual-copy-compare button')?.focus();},[inspect]);
  const cardTitle=member=>{const d=editable[0];const option=d?.options.find(o=>parts(member.scope).includes(o.scope));return option?`${d.label}: ${option.label}`:'Default version';};
  const cardCaption=member=>[member.size.replace('x',' × '),...editable.slice(1).flatMap(d=>{const option=d.options.find(o=>parts(member.scope).includes(o.scope));return option&&!sourceScopes.includes(option.scope)?[`${d.label}: ${option.label}`]:[];})].join(' · ');
  return <div className="visual-copy-backdrop" onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();inspect?closeInspect():onCancel();}
    if(event.key==='Tab'){const items=[...dialog.current.querySelectorAll('button:not(:disabled),input,select,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length && !el.closest('[inert]'));const first=items[0],last=items.at(-1);if(event.shiftKey&&window.document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&window.document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><section className="visual-copy-tray" role="dialog" aria-modal="true" aria-label="Copy appearance" ref={dialog} tabIndex={-1}>
    <header><div><h2>{target.label || target.id}</h2><span>{operation==='from'?'Choose an appearance for this version':'Use this appearance in…'}</span></div><button aria-label="Close appearance tray" onClick={onCancel}>×</button></header>
    <div className="visual-copy-workspace" inert={inspect?true:undefined}>
      <aside className="visual-copy-source"><div className="visual-copy-section-title"><strong>{operation==='from'&&sourcePicking?'Current destination':'Source'}</strong><button aria-pressed={sourcePicking} onClick={()=>setSourcePicking(!sourcePicking)}>{sourcePicking?'Cancel source selection':'Change source'}</button></div>
        {preview(document,{...sourceMember,row:sourceState.row},operation==='from'&&sourcePicking?'Destination ad':'Source ad',true,true)}
        <strong>{sourceMember.size.replace('x',' × ')}</strong><p>{describe(model,sourceMember.scope)}</p>{sourceState.synthesized&&<small>Uses current sample copy.</small>}
        <label className="visual-copy-time">Animation time <input aria-label="Comparison timeline" type="range" min="0" max="100" value={percent} onChange={event=>setPercent(Number(event.target.value))}/><span>{(percent/100*Number(document.clock?.durationS||15)).toFixed(1)}s</span></label>
      </aside>
      <div className="visual-copy-destinations">
        <div className="visual-copy-tools"><strong>{sourcePicking?'Click an ad to use as the source':'Click the ads to change'}</strong><div><button aria-pressed={!after} onClick={()=>setAfter(false)}>Before</button><button aria-pressed={after} onClick={()=>setAfter(true)}>After</button><button aria-pressed={showSelected} onClick={()=>{setShowSelected(!showSelected);setPage(0);}}>Selected ({picked.length})</button><button aria-expanded={filterOpen} onClick={()=>setFilterOpen(!filterOpen)}>Filter ads</button></div></div>
        {isComponent ? <div className="component-transfer-options"><strong>Whole {component?.name?.toLowerCase()}</strong><select aria-label="Component sizing" value={sizing} onChange={event=>{setSizing(event.target.value);setPlacements({});}}><option value="destination">Fit destination component area</option><option value="source">Keep source size</option></select><span title="All parts, internal arrangements, typography and fitting transfer together">All parts &amp; fitting</span>{stateDimensions.map(d=><label key={d.id}>Preview <select aria-label={`Preview ${d.label}`} value={arrangement || d.options.find(o=>sourceScopes.includes(o.scope))?.scope} onChange={event=>setArrangement(event.target.value)}>{d.options.map(o=><option key={o.scope} value={o.scope}>{o.label}</option>)}</select></label>)}</div> : <>
        <div className="visual-copy-properties" role="group" aria-label="Properties to copy">{categories.filter(c=>c.name!=='Offer arrangement').map(category=>{
          const keys=Object.keys(category.fields).filter(key=>source?.[category.domain]?.[key]!==undefined).map(key=>`${category.domain}:${key}`);
          if(!keys.length)return null;
          const active=keys.every(key=>fields.includes(key));
          return <button key={category.name} aria-pressed={active} onClick={()=>setFields(old=>active?old.filter(key=>!keys.includes(key)):[...new Set([...old,...keys])])}>{category.name}</button>;
        })}<details><summary>Individual fields</summary>{categories.map(category=>Object.entries(category.fields).filter(([key])=>source?.[category.domain]?.[key]!==undefined).map(([key,label])=><label key={`${category.domain}:${key}`}><input type="checkbox" checked={fields.includes(`${category.domain}:${key}`)} onChange={()=>setFields(old=>old.includes(`${category.domain}:${key}`)?old.filter(k=>k!==`${category.domain}:${key}`):[...old,`${category.domain}:${key}`])}/>{label}</label>))}</details></div></>}

        {filterOpen&&<div className="visual-copy-filters"><label>Size<select aria-label="Filter size" value={filterSize} onChange={event=>changeFilter(()=>setFilterSize(event.target.value))}><option value="*">All sizes</option>{availableSizes.map(s=><option key={s}>{s}</option>)}</select></label>{editable.map(d=><label key={d.id}>{d.label}<select aria-label={`Filter ${d.label}`} value={filters[d.id]} onChange={event=>changeFilter(()=>setFilters({...filters,[d.id]:event.target.value}))}><option value="*">All</option>{d.options.map(o=><option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}</select></label>)}</div>}
        <div className="visual-copy-grid">{visible.map(member=>{
          const key=memberKey(member),isSource=key===sourceKey,isPicked=!!picks[key],proposed=isPicked&&after&&proposal.document;
          return <article key={key} className={`visual-copy-card ${isPicked?'is-picked':''} ${isSource?'is-source':''}`}>
            <button className="visual-copy-card-select" aria-label={`${sourcePicking?'Use as source':'Select'} ${member.size} ${describe(model,member.scope)}`} aria-pressed={isPicked} disabled={isSource&&(!sourcePicking||operation==='from')} onClick={()=>choose(member)}>
              <span className="visual-copy-card-state">{isSource?(operation==='from'&&sourcePicking?'Destination':'Source'):isPicked?(proposed?'Selected · After':'Selected · Before'):'Select ad'}</span>
              {preview(proposed||document,member,`${member.size} · ${describe(model,member.scope)}`)}
              <strong title={describe(model,member.scope)}>{cardTitle(member)}</strong><span>{cardCaption(member)}</span>{member.synthesized&&<small>Current sample copy</small>}
            </button><button className="visual-copy-enlarge" onClick={()=>setInspect(member)} aria-label={`Compare ${member.size} ${describe(model,member.scope)}`}>Compare larger ↗</button>
          </article>;
        })}</div>
        {!visible.length&&<p>{showSelected?'Select ads from the full tray first.':'No matching versions. Adjust the filters.'}</p>}
        {displayedItems.length>8&&<nav className="visual-copy-pages"><button disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>{page*8+1}–{Math.min(page*8+8,displayedItems.length)} of {displayedItems.length}</span><button disabled={(page+1)*8>=displayedItems.length} onClick={()=>setPage(page+1)}>Next</button></nav>}
        {(inventory.error||proposal.error||error)&&<p role="alert">{inventory.error||proposal.error||error}</p>}
      </div>
    </div>
    <footer inert={inspect?true:undefined}><div><strong>{picked.length} {picked.length===1?'ad':'ads'} selected</strong>{hiddenPicked>0&&<span> · {hiddenPicked} outside this filter</span>}<button disabled={!picked.length} onClick={()=>setPicks({})}>Clear</button></div><div className="visual-copy-apply">
      {mode==='link'?<><input aria-label="Link name" placeholder="Name this link" value={name} onChange={event=>setName(event.target.value)}/>{!isComponent&&<label title="Keep positions and dimensions separate between ad sizes"><input type="checkbox" checked={keepGeometry} onChange={event=>setKeepGeometry(event.target.checked)}/>Per-size layout</label>}<button onClick={()=>setMode('copy')}>Copy once instead</button></>:<button onClick={()=>setMode('link')}>Link instead…</button>}
      <button className="visual-copy-primary" disabled={!proposal.document||!!proposal.error||(mode==='link'&&!name.trim())} onClick={apply}>{mode==='link'?'Link':'Copy'} {selectedNames||'appearance'} to {picked.length} {picked.length===1?'ad':'ads'}</button>
    </div></footer>
    {inspect&&<div className="visual-copy-compare"><header><div><h3>Source → {describe(model,inspect.scope)}</h3><span>{inspect.size.replace('x',' × ')}</span></div><button aria-label="Close enlarged comparison" onClick={closeInspect}>×</button></header><div className="visual-copy-comparison-images">
      {preview(document,{...sourceMember,row:sourceState.row},'Source',true)}{preview(document,inspect,'Before',true)}{preview(picks[memberKey(inspect)]&&proposal.document?proposal.document:document,inspect,'After',true)}
    </div>{inspectBounds&&<div className="component-placement-fields"><span>Move or resize the outlined component in After</span>{['left','top','width','height'].map(field=><label key={field}>{({left:'X',top:'Y',width:'Width',height:'Height'})[field]}<input aria-label={`Proposed ${field}`} type="number" value={Math.round(inspectBounds[field]*100)/100} onChange={event=>{const value=Number(event.target.value);if(!Number.isFinite(value)||(['width','height'].includes(field)&&value<=0))return;const next={...inspectBounds,[field]:value};if(component.resize==='proportional'&&field==='width')next.height=inspectBounds.height*value/inspectBounds.width;if(component.resize==='proportional'&&field==='height')next.width=inspectBounds.width*value/inspectBounds.height;setSizing('destination');setPlacements(old=>({...old,[`${inspect.size}/${inspect.scope}`]:next}));}}/></label>)}</div>}<footer><span>{picks[memberKey(inspect)]?'Selected destination':'Select this ad to preview changes'}</span><button disabled={memberKey(inspect)===sourceKey} onClick={()=>choose(inspect)}>{sourcePicking?'Use as source':picks[memberKey(inspect)]?'Deselect ad':'Select ad'}</button><button onClick={closeInspect}>Done</button></footer></div>}
  </section></div>;
}
