import {readCreativeDocumentForCampaign} from '../src/server/creative-document';
import {DEFAULT_CAMPAIGN_ID,listStaticPreviewCampaigns} from '../src/server/campaign-registry';
import {buildExportPreviewPackage} from '../src/server/creative-exporter';

async function main(){
 console.log('Syncing ZIPs from saved campaigns and their default sample rows…');
 const campaigns=[];
 for(const entry of listStaticPreviewCampaigns())campaigns.push({id:entry.id,document:await readCreativeDocumentForCampaign(entry.id)});
 // The exporter captures fresh browser measurements for outline packages when
 // editor snapshots are absent. This is the same builder used by the Sync API.
 const result=await buildExportPreviewPackage(campaigns,{dcoDocument:await readCreativeDocumentForCampaign(DEFAULT_CAMPAIGN_ID)});
 console.log('ZIPs synced to outputs/.');
 console.log(JSON.stringify(result.latest,null,2));
}
main().catch(error=>{console.error('Sync Zips failed:',error.message);process.exitCode=1;});
