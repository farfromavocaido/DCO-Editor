'use client';
import { useState } from 'react';
import { campaignVersionLabel } from '@/lib/campaign-variants';
import { OwnershipProductionPreview } from '@/components/OwnershipProductionPreview';

/** Saved generic campaign review; uses the very same production renderer as editing/export. */
export function CampaignQaReview({document,revision}:{document:any;revision:string}) {
  const [percent,setPercent]=useState(75);
  const [size,setSize]=useState(Object.keys(document.sizes)[0]);
  const rows=document.feed?.sampleRows?.length ? document.feed.sampleRows : [{}];
  return <main className="campaign-qa"><header><h1>{document.campaign?.name || 'Campaign'} QA</h1><p>Saved document {revision.slice(0,12)} · sample copy · unsaved editor changes are not included.</p><a href="/">Editor</a> <button onClick={()=>window.location.reload()}>Refresh saved campaign</button></header>
    <div className="campaign-qa-controls"><label>Format <select aria-label="Format" value={size} onChange={event=>setSize(event.target.value)}>{Object.keys(document.sizes).map(s=><option key={s}>{s}</option>)}</select></label><label>Timeline {percent}% <input type="range" min="0" max="100" value={percent} onChange={event=>setPercent(Number(event.target.value))}/></label></div>
    <section className="campaign-qa-grid">{rows.map((row:any,index:number)=><article key={index}><h2>{campaignVersionLabel(document,row) || 'Default version'}</h2><p>{row.Unique_ID || `Sample ${index+1}`}</p><OwnershipProductionPreview document={document} row={row} size={size} percent={percent} label={`QA ${index+1}`}/></article>)}</section>
  </main>;
}
