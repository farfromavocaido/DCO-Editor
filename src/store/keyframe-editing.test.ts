// @ts-nocheck
import {expect,test} from 'vitest';
import {useEditorStore} from './editor-store';
import {findCreativeTarget} from '@/lib/creative-model';
const setup=()=>{
 const document={campaign:{id:'test'},variantModel:{dimensions:[]},clock:{durationS:10,beats:{}},sizes:{'200x100':{canvas:{width:200,height:100},layers:[{id:'a',kind:'shape',base:{left:0,top:10,width:20,height:20},clips:[{id:'move',preset:'custom',keyframes:[{at:0,translate:[0,0]},{at:50,translate:[10,0]},{at:100,translate:[20,0]}]}]},{id:'b',kind:'shape',base:{left:100,top:50,width:40,height:30},clips:[]}]}}};
 useEditorStore.setState({creativeDocument:document,size:'200x100',selectedLayerId:'a',selectedTargetId:'a',selectedTargetIds:['a'],selectedClipId:'move',selectedKeyframe:null,history:[],historyIndex:-1,fieldEdit:null,feedDraft:{rows:[{}],selectedIndex:0},layoutDiagnostics:[],percent:50});return document;
};
test('keyframe edits are one undoable document transaction and do not edit another layer',()=>{
 const before=setup();useEditorStore.getState().selectKeyframe('a','move',1,50);useEditorStore.getState().editSelectedKeyframe({at:{value:6,unit:'seconds'},opacity:.5});
 expect(useEditorStore.getState().percent).toBe(60);expect(useEditorStore.getState().creativeDocument.sizes['200x100'].layers[1]).toEqual(before.sizes['200x100'].layers[1]);
 expect(useEditorStore.getState().history).toHaveLength(1);useEditorStore.getState().undo();expect(useEditorStore.getState().creativeDocument).toEqual(before);
});
test('multiple selected items align their centres to each other, not to the canvas',()=>{
 const before=setup();useEditorStore.getState().setCanvasSelection('a',['a','b']);useEditorStore.getState().alignSelectedTarget('center-h');
 const d=useEditorStore.getState().creativeDocument,a=findCreativeTarget(d,'200x100','a',[]),b=findCreativeTarget(d,'200x100','b',[]);
 expect(a.values.left+a.values.width/2).toBe(70);expect(b.values.left+b.values.width/2).toBe(70);
 useEditorStore.getState().undo();expect(useEditorStore.getState().creativeDocument).toEqual(before);
});
test('centre alignment retains half-pixel precision for odd-sized elements',()=>{
 const d=setup();d.sizes['200x100'].layers[0].base={left:29,top:0,width:121,height:20};d.sizes['200x100'].layers[1].base={left:42,top:0,width:102,height:20};useEditorStore.setState({creativeDocument:structuredClone(d)});
 useEditorStore.getState().setCanvasSelection('a',['a','b']);useEditorStore.getState().alignSelectedTarget('center-h');const next=useEditorStore.getState().creativeDocument;
 for(const id of ['a','b']){const v=findCreativeTarget(next,'200x100',id,[]).values;expect(v.left+v.width/2).toBe(89.5);}
});
