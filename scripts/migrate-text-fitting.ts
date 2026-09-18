// @ts-nocheck
import fs from 'node:fs';
import {CAMPAIGNS} from '../src/server/campaign-registry';
import {migrateTextFitting} from '../src/lib/text-fit-migration';
import {createComponentLink,transferCreativeComponent} from '../src/lib/creative-components';
import {findCreativeTarget} from '../src/lib/creative-model';
import {validateCreativeDocument} from '../src/server/creative-document';
const apply=process.argv.includes('--apply');const allText=process.argv.includes('--all-text');const reports=[];const sourceDir=process.argv.find(arg=>arg.startsWith('--source-dir='))?.slice('--source-dir='.length)||'campaign';
for(const c of CAMPAIGNS.filter(c=>c.id!=='product-demo')){
 const path='campaign/'+c.file,original=JSON.parse(fs.readFileSync(sourceDir+'/'+c.file,'utf8'));if((allText?original.campaign.textFitVersion:original.campaign.roundelFitVersion)===2){console.log(c.id,'already migrated');continue;}
 const result=migrateTextFitting(original,{targetIds:allText?null:['roundel-copy','roundel-value']});let d=result.document;
 // Explicit campaign authoring, not runtime item-specific policy.
 // All roundels start from MPU offer-1 internal geometry, with separate source
 // versions for awareness and offer campaigns. Exterior styles remain local.
 d.componentLinks=(d.componentLinks||[]).filter(l=>l.componentId!=='component:roundel');
 const masterSize='300x250';
 for(const group of [1,0]){
  const scope=`offers-${group}`;
  if(group===0)d=transferCreativeComponent(d,{componentId:'component:roundel',sourceSize:masterSize,sourceScopes:['offers-1'],destinations:[{size:masterSize,scope}],sizing:'destination',geometryOnly:true});
  for(const mode of ['roundel-copy-only','roundel-split']){
   const scopes=[scope,mode],frame=findCreativeTarget(d,masterSize,'roundel-frame',scopes).values;
   if(mode==='roundel-copy-only'){
    d.sizes[masterSize].localOverrides.push({targetId:'roundel-copy',scope:scopes.sort().join('.'),values:{left:Number(frame.left)+Number(frame.width)*.15,top:Number(frame.top)+Number(frame.height)*.15,width:Number(frame.width)*.7,height:Number(frame.height)*.7,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'},fit:{frame:'fixed',wrap:true,allowShrink:true,maxLines:3,shared:false}});
   }
  }
  const destinations=Object.keys(d.sizes).flatMap(size=>(group===0?[0]:[1,2,3]).filter(n=>!(size===masterSize&&n===group)).map(n=>({size,scope:`offers-${n}`})));
  d=createComponentLink(d,{id:`roundel-proportions-${group?'offers':'awareness'}`,name:group?'Offer roundel proportions':'Awareness roundel proportions',componentId:'component:roundel',source:{size:masterSize,scope},destinations,sizing:'destination',geometryOnly:true});
 }
 // A normal, editable relationship centres visible ink, rather than relying on
 // font line boxes. Applies to every format's text-only arrangement.
 for(const axis of ['x','y'])d.layoutRules=[...(d.layoutRules||[]),{id:`roundel-copy-centre-${axis}`,name:`Text-only roundel ${axis==='x'?'horizontal':'vertical'} centre`,type:'spacing',enabled:true,targets:Object.keys(d.sizes).map(size=>({size,targetId:'roundel-copy'})),when:['roundel-copy-only'],axis,targetEdge:'center',reference:{targetId:'roundel-frame',edge:'center'},gap:0,gapUnit:'px',onMissing:'authored'}];
 validateCreativeDocument(d);
 reports.push({campaign:c.name,changes:result.report,review:Object.keys(d.sizes).map(size=>({size,items:['Headlines 1–4','Offer values and sublines','Terms and unit rates','CTA','Roundel: text only / number + copy'],roundelSources:'300x250 offers-1 and offers-0'}))});
 fs.mkdirSync('output/text-fit-migration',{recursive:true});fs.writeFileSync(`output/text-fit-migration/${c.file}`,JSON.stringify(d,null,2)+'\n');if(apply)fs.writeFileSync(path,JSON.stringify(d,null,2)+'\n');console.log(c.id,result.report.length,'font-limit corrections',apply?'applied':'dry run');
}
fs.writeFileSync('output/text-fit-migration/review.json',JSON.stringify(reports,null,2));
