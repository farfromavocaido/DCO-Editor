// @ts-nocheck
import {expect,test} from 'vitest';
import {layoutAnimations,layoutSequenceCases,layoutSequencePlans,validateLayoutTransition,exitSegments,transitionCases} from './layout-transitions';
import {responsiveLayoutSource} from './responsive-layout';
const doc={campaign:{id:'test'},variantModel:{dimensions:[]},clock:{durationS:10,loop:true,beats:{start:0,end:100}},sizes:{'300x250':{canvas:{width:300,height:250},layers:[{id:'mark',clips:[]},{id:'legal',clips:[{id:'fade',preset:'fade',start:10,end:60,params:{enter_duration_pct:10,fade_pct:10}}]}]}}};
const rule={id:'area',name:'Area',enabled:true,type:'distribute',targets:[{size:'300x250',targetId:'mark'},{size:'300x250',targetId:'legal'}],axis:'y',single:'center',minGap:0,overflow:'authored',area:{height:200,width:200},startingArrangement:'present',layoutAnimations:[{id:'in',kind:'enter',subjectId:'legal',clipId:'fade',segmentIndex:0,start:'with',duration:'follow'},{id:'out',kind:'exit',subjectId:'legal',clipId:'fade',segmentIndex:0,start:'with',duration:'follow'}]};
const members=[{id:'mark',extent:40,fullStart:0},{id:'legal',extent:20,fullStart:180}];
test('entrance and exit share timing and return to a clean opening pose',()=>{
 validateLayoutTransition(doc,rule);const t=layoutSequenceCases(doc,'300x250',rule)[0];expect(t.initialAbsent).toEqual(['legal']);expect(t.events.map(e=>[e.start,e.end])).toEqual([[10,20],[50,60]]);
 const p=layoutSequencePlans(rule,t,members).find(p=>p.targetId==='mark');expect(p.keyframes.map(f=>f.translate)).toEqual(['0px 80px','0px 80px','0px 0px','0px 0px','0px 80px','0px 80px']);
 expect(layoutSequencePlans(rule,t,[members[0]])[0].keyframes.every(f=>f.translate==='0px 80px')).toBe(true);
 expect(()=>new Function('return '+responsiveLayoutSource())()).not.toThrow();
 const serialized=new Function('return ('+layoutSequencePlans.toString()+')')();expect(serialized(rule,t,members)).toEqual(layoutSequencePlans(rule,t,members));
});
test('legacy conversion retains exit and explicit return timings',()=>{
 const old={...rule,startingArrangement:undefined,layoutAnimations:undefined,transition:{subjectId:'legal',clipId:'fade',exitIndex:0,start:'with',duration:'follow',return:{mode:'animate',startS:9,endS:10}}};
 const before=JSON.stringify(old),entries=layoutAnimations(old);expect(JSON.stringify(old)).toBe(before);expect(entries.map(a=>a.kind)).toEqual(['exit','return']);
 const legacy=transitionCases(doc,'300x250',old)[0],next=layoutSequenceCases(doc,'300x250',{...old,layoutAnimations:entries})[0];expect(next.events.map(e=>[e.start,e.end])).toEqual([[legacy.start,legacy.end],[legacy.returnStart,legacy.returnEnd]]);
 const p=layoutSequencePlans(rule,next,members).find(p=>p.targetId==='mark');expect(p.keyframes.at(-1).translate).toBe('0px 0px');
});
test('returns are optional, overlaps are flagged, disabled entries ignored',()=>{
 const out=rule.layoutAnimations[1],exitOnly={...rule,startingArrangement:'all',layoutAnimations:[out]};
 validateLayoutTransition(doc,exitOnly);const timing=layoutSequenceCases(doc,'300x250',exitOnly)[0];expect(layoutSequencePlans(exitOnly,timing,members).find(p=>p.targetId==='mark').keyframes.at(-1).translate).toBe('0px 80px');
 const entryOnly={...rule,layoutAnimations:[rule.layoutAnimations[0]]};validateLayoutTransition(doc,entryOnly);const entryTiming=layoutSequenceCases(doc,'300x250',entryOnly)[0];const plan=layoutSequencePlans(entryOnly,entryTiming,members).find(p=>p.targetId==='mark');expect(plan.keyframes[0].translate).toBe('0px 80px');expect(plan.keyframes.at(-1).translate).toBe('0px 0px');
 expect(()=>layoutSequenceCases(doc,'300x250',{...rule,layoutAnimations:[...rule.layoutAnimations,{...out,id:'overlap'}]})).toThrow(/overlap/);
 expect(()=>validateLayoutTransition(doc,{...rule,layoutAnimations:[...rule.layoutAnimations,{id:'draft',enabled:false}]})).not.toThrow();
});
test('entrance can happen before or after the selected segment',()=>{
 const entry=rule.layoutAnimations[0],noLoop={...doc,clock:{...doc.clock,loop:false}};
 for(const [start,expected] of [['before',[0,10]],['after',[20,30]]]){const t=layoutSequenceCases(noLoop,'300x250',{...rule,layoutAnimations:[{...entry,start}]})[0];expect([t.events[0].start,t.events[0].end]).toEqual(expected);}
 expect(exitSegments(doc,'300x250','legal','fade',[])).toEqual([{start:50,end:60}]);
});
