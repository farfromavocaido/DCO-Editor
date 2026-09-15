import { it, expect } from 'vitest';
import { createCanvasGroup, removeCanvasGroup } from './canvas-groups';
import { dragTargetIdsForSelection, resolveSelectionMeta, selectionHierarchy } from './selection-groups';
const fixture = () => ({version:1,sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'frame',kind:'shape',base:{left:5,top:10,width:50,height:50},clips:[{id:'frame-in',preset:'fade',start:0,end:100}]},{id:'copy',kind:'text',base:{left:10,top:20,width:40,height:30},clips:[{id:'copy-in',preset:'fadeUp',params:{enter_dy:20},start:5,end:90}]}]}}});
it('groups arbitrary targets without changing their world geometry, clips, or shared styles', () => {
 const doc = fixture();
 const next = createCanvasGroup(doc,'300x250',{id:'canvas-group:roundel',name:'Roundel',members:['frame','copy']});
 expect(next.sizes['300x250'].layers).toEqual(doc.sizes['300x250'].layers);
 expect(next.sharedDefinitions).toBeUndefined();
 expect(dragTargetIdsForSelection('canvas-group:roundel',['canvas-group:roundel'],0,next,'300x250')).toEqual(['frame','copy']);
 const meta = resolveSelectionMeta(next,'300x250','canvas-group:roundel',['canvas-group:roundel'],0);
 expect(meta.kind).toBe('group');
 expect(meta.bounds).toMatchObject({left:5,top:10,width:50,height:50});
 expect(selectionHierarchy('copy',0,next,'300x250')).toEqual(['canvas-group:roundel','copy']);
 expect(removeCanvasGroup(next,'300x250','canvas-group:roundel').sizes['300x250'].layers).toEqual(doc.sizes['300x250'].layers);
});
it('rejects invalid members and overlapping group membership', () => {
 const doc = fixture();
 expect(() => createCanvasGroup(doc,'300x250',{id:'canvas-group:bad',name:'Bad',members:['frame','missing']})).toThrow();
 const next = createCanvasGroup(doc,'300x250',{id:'canvas-group:one',name:'One',members:['frame','copy']});
 expect(() => createCanvasGroup(next,'300x250',{id:'canvas-group:two',name:'Two',members:['frame','copy']})).toThrow(/already/i);
});
