import { requireUser } from "@/modules/auth/service";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    await requireUser();
    return ok({
      enabled: false,
      eligible: false,
      claimable: false,
      blockedReasons: ["FEATURE_DISABLED"],
    });
  } catch (error) {
    return apiError(error);
  }
}
