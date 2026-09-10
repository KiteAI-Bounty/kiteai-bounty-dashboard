import { requireAdmin } from "@/modules/auth/service";
import { ApiError, apiError } from "@/lib/api";

export async function POST() {
  try {
    await requireAdmin();
    throw new ApiError("NOT_IMPLEMENTED", "EC 自动化尚未接入。", 501);
  } catch (error) {
    return apiError(error);
  }
}
