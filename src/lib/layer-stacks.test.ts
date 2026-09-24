// @ts-nocheck
import {framesMatchAuthored} from './timeline-render-model';
import {expect,test} from 'vitest';
import {sharedLayerTree,moveLayerIntoStack,updateStackEffects,wrapStackHtml} from './layer-stacks';
import {motionGeometry,editMotionGeometry} from './motion-geometry';
import {makeMotionIndependent,activeMotionOverride,validateMotionOverrides} from './motion-overrides';
const fixture=()=>({campaign:{id:'test'},variantModel:{dimensions:[]},clock:{durationS:10,beats:{}},sizes:{square:{canvas:{width:200,height:100},layers:['a','b','c'].map((id,i)=>({id,kind:'image',zIndex:i,base:{left:i*20,top:0,width:20,height:20},clips:[]})),timelineFolders:[{id:'stack',name:'Stack',members:[]}]}}});
test('sidebar and timeline share front-to-back order and drag membership is undoable data',()=>{
 const d=fixture(),before=structuredClone(d),next=moveLayerIntoStack(d,'square','b','stack');
 expect(d).toEqual(before);expect(next.sizes.square.timelineFolders[0].members).toEqual(['b']);
 expect(sharedLayerTree(next,'square').flatMap(e=>e.layer?[e.layer.id]:e.layers.map(l=>l.id))).toEqual(['b','c','a']);
 const removed=moveLayerIntoStack(next,'square','b','');expect(removed.sizes.square.timelineFolders[0].members).toEqual([]);
});
test('shared stack effects are opt-in and cannot silently cross another layer',()=>{
 const d=fixture(),creative=d.sizes.square,body='<main class="stage"><p id="a"><span>A</span></p><img id="b" src="x"><p id="c">C</p><a id="clickbox"></a></main>';
 expect(wrapStackHtml(body,creative)).toBe(body);
 creative.timelineFolders[0].members=['a','c'];expect(()=>updateStackEffects(d,'square','stack',{enabled:true})).toThrow(/together/);
 creative.timelineFolders[0].members=['b','c'];const enabled=updateStackEffects(d,'square','stack',{enabled:true,x:12,y:-4,opacity:.4});
 const html=wrapStackHtml(body,enabled.sizes.square);expect(html).toContain('transform:translate(12px,-4px);opacity:0.4');expect(html).toContain('<img id="b" src="x"><p id="c">C</p>'.replace('><p','>\n<p'));expect(html.match(/id="a"/g)).toHaveLength(1);expect(html.match(/id="b"/g)).toHaveLength(1);
});
test('independent motion is scoped to the chosen version and leaves authored clips untouched',()=>{
 const d=fixture(),clip={preset:'custom',keyframes:[{at:0,opacity:0},{at:20,opacity:0},{at:30,opacity:1},{at:60,opacity:1},{at:70,opacity:0},{at:100,opacity:0}]};
 const {document:next}=makeMotionIndependent(d,'square','a',clip,['offers-0','frames-3']);
 const layer=next.sizes.square.layers[0];expect(activeMotionOverride(layer,['offers-1','frames-3'])).toBeNull();
 expect(activeMotionOverride(layer,['offers-0','frames-3']).keyframes.map(f=>f.at)).toEqual([20,30,60,70]);
 expect(layer.clips).toEqual(d.sizes.square.layers[0].clips);expect(d.sizes.square.layers[0].motionOverrides).toBeUndefined();expect(()=>validateMotionOverrides(next)).not.toThrow();
});

test('canvas geometry edits target the active independent motion instead of an unused authored clip',()=>{
 const d=fixture(),clip={preset:'custom',keyframes:[{at:0,left:0,opacity:1},{at:100,left:20,opacity:1}]};
 const {document:next}=makeMotionIndependent(d,'square','a',clip,['offers-0','frames-3']);
 const edited=editMotionGeometry(next,'square','a',['offers-0','frames-3'],50,'left',30);
 expect(motionGeometry(edited,'square','a',['offers-0','frames-3'],50).values.left).toBe(30);
 expect(edited.sizes.square.layers[0].clips).toEqual(d.sizes.square.layers[0].clips);
});

test('resolved-motion comparison tolerates browser matrix rounding but detects a different schedule',()=>{
 const authored=[{at:0,scale:1,opacity:0,translate:[0,0]},{at:50,scale:1.15,opacity:1,translate:[30,0]}];
 expect(framesMatchAuthored([{at:50,scale:1.149999976,opacity:1,translate:[30,0]}],authored)).toBe(true);
 expect(framesMatchAuthored([{at:25,scale:1.15,opacity:1,translate:[30,0]}],authored)).toBe(false);
});
