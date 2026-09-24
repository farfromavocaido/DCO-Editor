// @ts-nocheck
import {creativeComponents} from './creative-components';
export const frontToBack = creative => [...(creative?.layers||[])].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));
export function sharedLayerTree(document,size){
 const creative=document?.sizes?.[size];if(!creative)return [];
 const layers=frontToBack(creative),defs=[...(creative.timelineFolders||[]).map(g=>({...g,folder:true})),...(creative.canvasGroups||[]).map(g=>({...g,canvas:true})),...creativeComponents(document,size).map(g=>({...g,component:true,members:g.parts.map(p=>p.targetId).filter(id=>!id.includes('::'))}))];
 const used=new Set(),groups=new Map(),result=[];
 for(const layer of layers){const group=defs.find(g=>g.members.includes(layer.id)&&(g.folder||stackIsContiguous(creative,g)));if(!group){result.push({kind:'layer',layer});continue;}
  if(!groups.has(group.id)){const entry={...group,kind:'folder',layers:[]};groups.set(group.id,entry);result.push(entry);}groups.get(group.id).layers.push(layer);used.add(group.id);
 }
 for(const group of defs.filter(g=>g.folder&&!used.has(g.id)))result.unshift({...group,kind:'folder',layers:[]});
 return result;
}
export function stackIsContiguous(creative,stack){const order=frontToBack(creative).map(l=>l.id),indices=stack.members.map(id=>order.indexOf(id)).filter(i=>i>=0).sort((a,b)=>a-b);return !indices.length||indices.at(-1)-indices[0]+1===indices.length;}
export function moveLayerIntoStack(document,size,layerId,stackId){
 const next=structuredClone(document),creative=next.sizes[size],layer=creative.layers.find(l=>l.id===layerId);if(!layer)throw new Error('Layer not found');
 const target=stackId?(creative.timelineFolders||[]).find(g=>g.id===stackId):null;if(stackId&&!target)throw new Error('Choose a layer stack');
 for(const folder of creative.timelineFolders||[])folder.members=folder.members.filter(id=>id!==layerId);
 if(target){
  const order=frontToBack(creative).filter(l=>l.id!==layerId),last=order.reduce((value,l,i)=>target.members.includes(l.id)?i:value,-1);
  order.splice(last>=0?last+1:0,0,layer);order.forEach((l,i)=>l.zIndex=order.length-1-i);target.members.push(layerId);
 }else {const order=frontToBack(creative).filter(l=>l.id!==layerId);order.push(layer);order.forEach((l,i)=>l.zIndex=order.length-1-i);}
 validateLayerStacks(next);return next;
}
export function updateStackEffects(document,size,id,patch){
 const next=structuredClone(document),stack=next.sizes[size].timelineFolders.find(g=>g.id===id);if(!stack)throw new Error('Stack not found');
 stack.effects={enabled:false,x:0,y:0,opacity:1,...stack.effects,...patch};validateLayerStacks(next);return next;
}
export function validateLayerStacks(document){
 for(const creative of Object.values(document.sizes||{})){
  const members=new Set();for(const stack of creative.timelineFolders||[]){
   if(!stack.id||!stack.name||!Array.isArray(stack.members))throw new Error('Stacks need a name and members');
   for(const id of stack.members){if(members.has(id)||!creative.layers.some(l=>l.id===id))throw new Error('A layer can belong to one stack');members.add(id);}
   if(stack.effects){const e=stack.effects;if(![e.x,e.y,e.opacity].every(Number.isFinite)||e.opacity<0||e.opacity>1)throw new Error('Enter valid stack position and opacity values');
    if(e.enabled&&!stackIsContiguous(creative,stack))throw new Error('Keep stack members together in layer order before enabling shared controls');
   }
  }
 }
}
const attr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
/** Wrap generated top-level layer elements only. No enabled stacks => byte-identical body. */
export function wrapStackHtml(body,creative){
 const stacks=(creative.timelineFolders||[]).filter(g=>g.effects?.enabled&&g.members.length);if(!stacks.length)return body;
 validateLayerStacks({sizes:{size:creative}});
 const open=body.match(/<main\b[^>]*>/),end=body.lastIndexOf('</main>');if(!open||end<0)throw new Error('Missing stage');
 const begin=open.index+open[0].length,inner=body.slice(begin,end),chunks=[];let depth=0,start=0;
 const tags=/<!--[^]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
 for(const match of inner.matchAll(tags)){if(!match[1])continue;const tag=match[0],closing=tag.startsWith('</'),single=/\/>$/.test(tag)||/^(img|br|hr|input|meta|link|source|wbr)$/i.test(match[1]);
  if(!closing&&depth===0)start=match.index;
  if(closing)depth--;else if(!single)depth++;
  if(depth===0){const html=inner.slice(start,match.index+tag.length),id=html.match(/^<[^>]*\bid="([^"]+)"/)?.[1];chunks.push({html,id});}
 }
 const domId=id=>attr(id==='terms-solo'?'TC_Solo':id.replace(/^offer-slot-(\d+)$/,'offer$1'));
 const emitted=new Set();const output=chunks.map(chunk=>{
  const stack=stacks.find(g=>g.members.map(domId).includes(chunk.id));if(!stack)return chunk.html;if(emitted.has(stack.id))return '';emitted.add(stack.id);
  const children=chunks.filter(c=>stack.members.map(domId).includes(c.id)).map(c=>c.html).join('\n');
  const e=stack.effects,z=Math.max(...creative.layers.filter(l=>stack.members.includes(l.id)).map(l=>l.zIndex||0));
  return `<div data-stack-root="${attr(stack.id)}" style="position:absolute;left:0;top:0;width:${creative.canvas.width}px;height:${creative.canvas.height}px;z-index:${z};transform:translate(${e.x}px,${e.y}px);opacity:${e.opacity}">${children}</div>`;
 }).join('\n');return body.slice(0,begin)+output+body.slice(end);
}
