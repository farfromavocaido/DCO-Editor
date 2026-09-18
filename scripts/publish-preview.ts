import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pageUrl='https://farfromavocaido.github.io/DCO-Editor/';
type Runner=(command:string,args:string[],options?:{capture?:boolean;env?:Partial<NodeJS.ProcessEnv>})=>string;
const run:Runner=(command,args,options={})=>{
 const result=spawnSync(command,args,{cwd:root,encoding:'utf8',stdio:options.capture?'pipe':'inherit',env:{...process.env,...options.env}});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed${result.status===null?'':` (exit ${result.status})`}.${options.capture?`\n${result.stderr||result.stdout}`:''}`);
 return result.stdout?.trim()||'';
};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export async function publishPreview(execute:Runner=run,sleep=pause,log:typeof console.log=console.log){
 if(execute('git',['branch','--show-current'],{capture:true})!=='main')throw new Error('Run just publish from main: gitup pushes origin/main.');
 execute('gh',['auth','status'],{capture:true});
 execute('zsh',['-ic','whence gitup >/dev/null'],{capture:true});
 log('Publishing saved campaign files. Save editor changes first; gitup stages all repository changes.');
 log('\n1/5 — Tests');execute('npm',['test']);
 log('\n2/5 — Sync ZIPs');execute(process.execPath,[require.resolve('tsx/cli'),'--tsconfig','tsconfig.json','scripts/sync-zips.ts']);
 log('\n3/5 — Check Pages export');execute('npm',['run','export:preview-site'],{env:{STRICT_STATICS_EXPORT:'1'}});
 log('\n4/5 — gitup');execute('zsh',['-ic','gitup']);
 const sha=execute('git',['rev-parse','HEAD'],{capture:true});
 if(execute('git',['status','--porcelain'],{capture:true}))throw new Error('gitup left uncommitted files. Check its output before publishing again.');
 const remote=execute('git',['ls-remote','origin','refs/heads/main'],{capture:true}).split(/\s/)[0];
 if(remote!==sha)throw new Error('origin/main does not match this commit. Check the push result.');
 log(`\n5/5 — Waiting for Pages deployment of ${sha.slice(0,7)}…`);
 let workflow:{databaseId:number;url:string}|undefined;
 for(let attempt=0;attempt<18;attempt++){
  const runs=JSON.parse(execute('gh',['run','list','--workflow','pages.yml','--branch','main','--event','push','--commit',sha,'--limit','10','--json','databaseId,url'],{capture:true}));
  workflow=runs[0];if(workflow)break;await sleep(10000);
 }
 if(!workflow)throw new Error(`No Pages push workflow appeared for ${sha}. Check GitHub Actions; do not assume the site was updated.`);
 log(workflow.url);
 try{execute('gh',['run','watch',String(workflow.databaseId),'--exit-status','--interval','10']);}
 catch(error){throw new Error(`Pages did not deploy successfully.\nWorkflow: ${workflow.url}\n${(error as Error).message}`);}
 const result=JSON.parse(execute('gh',['run','view',String(workflow.databaseId),'--json','conclusion,headSha'],{capture:true}));
 if(result.conclusion!=='success'||result.headSha!==sha)throw new Error(`Pages run did not successfully deploy the expected commit.\n${workflow.url}`);
 log(`\nPublished successfully (${sha.slice(0,7)}).\n${pageUrl}\nWorkflow: ${workflow.url}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))publishPreview().catch(error=>{console.error(`\nPublish stopped: ${error.message}`);process.exitCode=1;});
