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
    <label className="inspector-field"><span title="Automatic adjusts offer spacing and plus/text positions. Manual keeps the current layout for this version. Switching back restores the arrangement from before the manual session.">Offer layout</span>
      <select aria-label="Active offer arrangement" title="Automatic adjusts spacing. Manual lets you position the offers yourself. Applies to this version." value={mode} disabled={busy||renderMode!=='font'} onChange={async event=>{
        setBusy(true);setError('');
        try{await setArrangement(event.target.value);}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}finally{setBusy(false);}
      }}><option value="auto">Automatic</option><option value="manual">Manual</option></select>
    </label>
    {renderMode!=='font'?<button type="button" onClick={()=>setRenderMode('font')}>Switch to Dynamic text to measure arrangement</button>:null}
    {busy?<p role="status">Measuring the production arrangement…</p>:null}
    {error?<p role="alert">{error}</p>:null}
  </div>;
}
