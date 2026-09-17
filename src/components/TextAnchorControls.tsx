// @ts-nocheck
'use client';
import {captureTextAnchor} from '@/lib/text-anchor';
import {useEditorStore} from '@/store/editor-store';
export function TextAnchorControls({target,canvasHeight,onChange,controlledBy}){
 const anchor=target.fit?.anchor;
 if(controlledBy)return <span className="inspector-note" title="The layout rule positions this text after fitting. Detach it to use a separate pin.">Position follows {controlledBy}</span>;
 return <div className="inspector-grid" aria-label="Text anchoring"><label className="inspector-field"><span title="Pin a visible text edge. More lines grow away from that fixed point.">Pin text</span><select aria-label="Text anchor" value={anchor?.edge||''} onChange={e=>{try{onChange('anchor',e.target.value?captureTextAnchor(target.id,e.target.value):null);}catch(error){useEditorStore.getState().setStatus(error.message,'warn');}}}><option value="">Not pinned</option><option value="end">Bottom edge</option><option value="center">Vertical centre</option><option value="start">Top edge</option></select></label>{anchor&&<label className="inspector-field"><span>{anchor.edge==='end'?'Bottom inset (px)':'Anchor Y (px)'}</span><input aria-label="Text anchor position" type="number" step="any" value={Math.round((anchor.edge==='end'?canvasHeight-anchor.position:anchor.position)*100)/100} onChange={e=>onChange('anchor',{...anchor,position:anchor.edge==='end'?canvasHeight-Number(e.target.value):Number(e.target.value)})}/></label>}</div>;
}
