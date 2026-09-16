'use client';

import { useState } from 'react';
import { offerArrangementMode } from '@/lib/offer-arrangement';
import { useEditorStore } from '@/store/editor-store';

type Props = {document:Record<string,any>;size:string;target:{id:string;members?:string[]};scopes:string[]};
export function OfferArrangementControls({document,size,target,scopes}:Props) {
  const renderMode=useEditorStore(state=>state.previewRenderMode);
  const setRenderMode=useEditorStore(state=>state.setPreviewRenderMode);
  const setArrangement=useEditorStore(state=>state.setActiveOfferArrangement);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const related=[target.id,...(target.members || [])].some(id=>id==='group:offers-block'||/^(offer-slot-|plus-)\d+/.test(id));
  if(!related) return null;
  const mode=offerArrangementMode(document,size,scopes);
  return <div className="offer-arrangement-controls">
    <label className="inspector-field"><span>Active offer arrangement · this preview state</span>
      <select aria-label="Active offer arrangement" value={mode} disabled={busy||renderMode!=='font'} onChange={async event=>{
        setBusy(true);setError('');
        try{await setArrangement(event.target.value);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setBusy(false);}
      }}><option value="auto">Automatic</option><option value="manual">Manual</option></select>
    </label>
    <p className="inspector-note">{mode==='manual'
      ? 'You own slot, plus and subline positions for this preview state. Automatic spacing and subline positioning are off.'
      : 'Automatic layout can adjust offer spacing, plus positions and side-by-side subline X. Choose Manual to preserve the current arrangement and move these items.'}</p>
    <p className="inspector-note">Applies to the whole active offer arrangement. Other preview states are unchanged. Returning to Automatic restores the authored arrangement before this manual session.</p>
    {renderMode!=='font'?<button type="button" onClick={()=>setRenderMode('font')}>Switch to Dynamic text to measure arrangement</button>:null}
    {busy?<p role="status">Measuring the production arrangement…</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
