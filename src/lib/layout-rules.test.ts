import {expect,it} from 'vitest';
import {validateLayoutRules} from './layout-rules';
const fixture=()=>({variantModel:{dimensions:[{id:'state',field:'state',label:'State',defaultValue:'a',options:[{value:'a',label:'A',scope:'a'},{value:'b',label:'B',scope:'b'}]}]},sizes:{'300x250':{layers:[{id:'title'},{id:'mark'}]}},layoutRules:[] as any[]});
const spacing=(id:string,targetId:string,reference:string)=>({id,name:id,type:'spacing',enabled:true,targets:[{size:'300x250',targetId}],axis:'y',targetEdge:'end',reference:{targetId:reference,edge:'start'},gap:-8,gapUnit:'px',onMissing:'authored'});
it('rejects cycles and overlapping ownership but accepts mutually exclusive conditions',()=>{
 const d=fixture();d.layoutRules=[spacing('one','title','mark'),spacing('two','mark','title')];expect(()=>validateLayoutRules(d)).toThrow(/Circular/);
 d.layoutRules=[spacing('one','title','canvas'),{...spacing('two','title','mark'),when:['b']}];expect(()=>validateLayoutRules(d)).toThrow(/Conflicting/);
 d.layoutRules[0].when=['a'];expect(()=>validateLayoutRules(d)).not.toThrow();
});
it('retains disabled rules without making them owners or dependencies',()=>{
 const d=fixture();d.layoutRules=[spacing('one','title','mark'),{...spacing('two','mark','title'),enabled:false}];expect(()=>validateLayoutRules(d)).not.toThrow();
});
it('requires an explicit absence policy and real targets in every linked format',()=>{
 const d=fixture();d.layoutRules=[{...spacing('one','title','mark'),onMissing:undefined}];expect(()=>validateLayoutRules(d)).toThrow(/absent/);
 d.layoutRules=[{...spacing('one','title','mark'),targets:[{size:'728x90',targetId:'title'}]}];expect(()=>validateLayoutRules(d)).toThrow(/Unknown/);
});

it('allows opposite relationships in mutually exclusive states',()=>{
 const d=fixture();d.layoutRules=[{...spacing('one','title','mark'),when:['a']},{...spacing('two','mark','title'),when:['b']}];expect(()=>validateLayoutRules(d)).not.toThrow();
});
it('rejects measurement feedback and overlapping area ownership',()=>{
 const d=fixture();d.layoutRules=[{id:'loop',name:'Loop',type:'conditional',enabled:true,targets:[{size:'300x250',targetId:'title'}],condition:{targetId:'title',test:'lines-at-least',value:2},values:{width:100}}];expect(()=>validateLayoutRules(d)).toThrow(/own measurement/);
 d.layoutRules[0].condition.test='has-text';expect(()=>validateLayoutRules(d)).not.toThrow();
 d.layoutRules=[{id:'area',name:'Area',type:'distribute',enabled:true,targets:[{size:'300x250',targetId:'title'},{size:'300x250',targetId:'mark'}],areas:{'300x250':{left:0,top:0,width:100,height:100}},axis:'y',single:'center',minGap:0,overflow:'authored'},spacing('gap','title','canvas')];expect(()=>validateLayoutRules(d)).toThrow(/Conflicting/);
});
it('a condition can keep the original true placement and supply only an otherwise placement',()=>{
 const d=fixture();d.layoutRules=[{id:'fallback',name:'Otherwise',type:'conditional',enabled:true,targets:[{size:'300x250',targetId:'mark'}],condition:{targetId:'title',test:'has-text'},values:{},otherwise:{top:40}}];expect(()=>validateLayoutRules(d)).not.toThrow();
});
