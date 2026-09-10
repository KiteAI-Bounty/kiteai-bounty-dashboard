import { getCampaignWorkspace } from "@/modules/campaigns/service";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    const { campaign, demo, now } = await getCampaignWorkspace();
    return ok({ campaign, demo, asOf: now });
  } catch (error) {
    return apiError(error);
  }
}
