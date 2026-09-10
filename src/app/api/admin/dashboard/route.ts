import { requireAdmin } from "@/modules/auth/service";
import { ApiError, apiError } from "@/lib/api";
export async function GET() {
  try {
    await requireAdmin();
    throw new ApiError("NOT_IMPLEMENTED", "后台统计尚未接入。", 501);
  } catch (error) {
    return apiError(error);
  }
}
