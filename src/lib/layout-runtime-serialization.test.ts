import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {expect,test} from 'vitest';

test('Pages/tsx emits a self-contained layout sequence which executes without build helpers',()=>{
 const source=execFileSync(process.execPath,['--import','tsx','--input-type=module','--eval',"import {layoutSequencePlansSource} from './src/lib/layout-transitions.ts';console.log(layoutSequencePlansSource());"],{cwd:process.cwd(),encoding:'utf8'});
 const plans=vm.runInNewContext(source)({id:'area',axis:'y',area:{height:200},single:'center',minGap:0,overflow:'authored'},{durationMs:10000,loop:true,initialAbsent:['terms'],events:[{kind:'enter',subjectId:'terms',start:10,end:20},{kind:'exit',subjectId:'terms',start:70,end:80}]},[{id:'logo',extent:40,fullStart:0},{id:'terms',extent:20,fullStart:180}]);
 const logo=plans.find((p:{targetId:string})=>p.targetId==='logo');
 expect(logo.keyframes.map((f:{translate:string})=>f.translate)).toEqual(['0px 80px','0px 80px','0px 0px','0px 0px','0px 80px','0px 80px']);
});
