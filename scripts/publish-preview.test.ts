import {expect,test} from 'vitest';
import {publishPreview} from './publish-preview';
const sha='123456789abcdef',url='https://github.com/example/repo/actions/runs/42';
function harness(fail=''){
 const calls:string[]=[],messages:string[]=[];
 const run=(cmd:string,args:string[])=>{
  const call=[cmd,...args].join(' ');calls.push(call);if(fail&&call.includes(fail))throw new Error('Simulated failure');
  if(call==='git branch --show-current')return 'main';
  if(call==='git rev-parse HEAD')return sha;
  if(call==='git ls-remote origin refs/heads/main')return sha+'\trefs/heads/main';
  if(call.startsWith('gh run list'))return JSON.stringify([{databaseId:42,url}]);
  if(call.startsWith('gh run view'))return JSON.stringify({conclusion:'success',headSha:sha});
  return '';
 };
 return {calls,messages,execute:()=>publishPreview(run,async()=>{},m=>messages.push(String(m)))};
}
test.each(['npm test','scripts/sync-zips.ts','npm run export:preview-site'])('failure in %s stops before gitup',async phase=>{
 const h=harness(phase);await expect(h.execute()).rejects.toThrow('Simulated failure');expect(h.calls).not.toContain('zsh -ic gitup');expect(h.messages.join(' ')).not.toContain('Published successfully');
});
test('watches only the pushed commit and announces the site after success',async()=>{
 const h=harness();await h.execute();expect(h.calls.find(c=>c.startsWith('gh run list'))).toContain('--commit '+sha);expect(h.calls).toContain('gh run watch 42 --exit-status --interval 10');expect(h.messages.at(-1)).toContain('https://farfromavocaido.github.io/DCO-Editor/');
});
test('failed deployment reports the workflow and never claims publication',async()=>{
 const h=harness('gh run watch');await expect(h.execute()).rejects.toThrow(url);expect(h.messages.join(' ')).not.toContain('Published successfully');
});
test('refuses a non-main checkout before running tests or pushing',async()=>{
 const calls:string[]=[];await expect(publishPreview((cmd,args)=>{calls.push(cmd);return 'feature';},async()=>{},()=>{})).rejects.toThrow('from main');expect(calls).toEqual(['git']);
});
test('does not announce success when watch returns a different commit',async()=>{
 const calls:string[]=[],messages:string[]=[];
 const run=(cmd:string,args:string[])=>{const c=[cmd,...args].join(' ');calls.push(c);if(c==='git branch --show-current')return 'main';if(c==='git rev-parse HEAD')return sha;if(c.startsWith('git ls-remote'))return sha;if(c.startsWith('gh run list'))return JSON.stringify([{databaseId:42,url}]);if(c.startsWith('gh run view'))return JSON.stringify({conclusion:'success',headSha:'different'});return '';};
 await expect(publishPreview(run,async()=>{},m=>messages.push(String(m)))).rejects.toThrow('expected commit');expect(messages.join(' ')).not.toContain('Published successfully');
});
