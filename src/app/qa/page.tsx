import { QaReviewApp } from '@/components/qa/QaReviewApp';
import { CampaignQaReview } from '@/components/qa/CampaignQaReview';
import { readCreativeDocumentForCampaign } from '@/server/creative-document';
import { qaDocumentRevision } from '@/server/qa-agency-shell';
import { isGenericCampaign } from '@/lib/campaign-variants';
import './qa.css';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function QaPage({searchParams}:{searchParams:Promise<{campaign?:string}>}) {
  const {campaign}=await searchParams;
  if(campaign) {
    const document=await readCreativeDocumentForCampaign(campaign);
    if(isGenericCampaign(document)) return <CampaignQaReview document={document} revision={qaDocumentRevision(document)}/>;
  }
  return <QaReviewApp />;
}
