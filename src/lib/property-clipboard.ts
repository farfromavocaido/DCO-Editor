import {setCreativeOwnershipField} from './creative-ownership';
import {replaceOwnershipDestinationLinks,replaceOwnershipDestinationLocals} from './ownership-ui';
const appearance=['left','top','width','height','color','backgroundColor','borderColor','borderRadius','borderWidth','opacity'];
const typography=['fontFamily','fontWeight','fontStyle','fontSize','lineHeight','letterSpacing','textAlign','alignItems'];
export function captureProperties(target:any){
 if(!target||['component','group','multi'].includes(target.kind))return null;
 return {label:target.label||target.id,values:Object.fromEntries([...appearance,...typography].filter(k=>target.values?.[k]!==undefined).map(k=>[k,structuredClone(target.values[k])])),fit:structuredClone(target.fit||{})};
}
export function pasteProperties(document:any,size:string,target:any,scopes:string[],clipboard:any){
 if(!clipboard||!captureProperties(target))throw new Error('Select an individual element to paste properties');
 const text=target.values?.fontSize!==undefined||['text','nested'].includes(target.kind);
 const values=Object.fromEntries(Object.entries(clipboard.values).filter(([k])=>appearance.includes(k)||text&&typography.includes(k)));
 const fit=text?structuredClone(clipboard.fit):{};
 if(fit.anchor?.referenceHeight){const h=document.sizes[size].canvas.height,a=fit.anchor;fit.anchor={...a,position:a.edge==='end'?h-(a.referenceHeight-a.position):a.edge==='center'?h/2+(a.position-a.referenceHeight/2):a.position,referenceHeight:h};}
 const fields={values:Object.keys(values),fit:Object.keys(fit)},members=[{size,targetId:target.id,scope:[...scopes].sort().join('.')}];
 let next=replaceOwnershipDestinationLocals(replaceOwnershipDestinationLinks(document,members,fields),members,fields);
 for(const [domain,bundle] of Object.entries({values,fit}))for(const [field,value] of Object.entries(bundle))next=setCreativeOwnershipField(next,size,target.id,scopes,domain as 'values'|'fit',field,value);
 return next;
}
