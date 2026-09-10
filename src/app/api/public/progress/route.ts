import { getCampaignWorkspace } from "@/modules/campaigns/service";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    const { rows, campaign, demo, now } = await getCampaignWorkspace();
    return ok({ rows, weeks: campaign.weeks, demo, asOf: now, limit: 100 });
  } catch (error) {
    return apiError(error);
  }
}
