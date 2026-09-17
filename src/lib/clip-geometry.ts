// @ts-nocheck
const cache=new WeakMap();
export function resolveClipGeometry(clip,scopes=[]){
 if(!clip.geometryEdits?.length)return clip;
 const key=[...scopes].sort().join('.');let entries=cache.get(clip);if(!entries){entries=new Map();cache.set(clip,entries);}if(entries.has(key))return entries.get(key);
 const edits=clip.geometryEdits.filter(e=>String(e.scope||'').split('.').filter(Boolean).every(s=>scopes.includes(s)));
 if(!edits.length)return clip;
 const next={...clip,keyframes:clip.keyframes.map((frame,index)=>{const result={...frame};for(const field of ['left','top','width','height'])if(frame[field]!==undefined){result[field]=Number(frame[field])+edits.reduce((sum,e)=>sum+(Number(e.offset?.[field])||0)+(Number(e.frames?.[index]?.[field])||0),0);if(!Number.isFinite(result[field])||(['width','height'].includes(field)&&result[field]<=0))throw new Error('Motion edit produces an invalid dimension');}return result;})};entries.set(key,next);return next;
}
