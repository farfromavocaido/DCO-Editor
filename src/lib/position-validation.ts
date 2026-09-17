// @ts-nocheck
import {campaignVariantModel} from './campaign-variants';
export function validatePositionControls(document){
 const known=new Set(campaignVariantModel(document).dimensions.flatMap(d=>d.options.map(o=>o.scope)));
 function visit(value){if(!value||typeof value!=='object')return;if(value.fit?.anchor){const a=value.fit.anchor;if(!['start','center','end'].includes(a.edge)||!Number.isFinite(a.position))throw new Error('Text anchor needs a valid edge and position');}for(const child of Object.values(value))if(typeof child==='object')visit(child);}
 visit(document);
 for(const size of Object.values(document.sizes||{}))for(const layer of size.layers||[])for(const clip of layer.clips||[])for(const edit of clip.geometryEdits||[]){if(String(edit.scope||'').split('.').filter(Boolean).some(s=>!known.has(s)))throw new Error('Motion edit uses an unknown campaign condition');for(const [index,fields]of Object.entries(edit.frames||{}))if(!Number.isInteger(Number(index))||Number(index)<0||Number(index)>=clip.keyframes?.length)throw new Error('Motion edit references a missing keyframe');for(const values of [edit.offset||{},...Object.values(edit.frames||{})])for(const [field,value]of Object.entries(values))if(!['left','top','width','height'].includes(field)||!Number.isFinite(value))throw new Error('Motion edits require valid geometry offsets');}
}
