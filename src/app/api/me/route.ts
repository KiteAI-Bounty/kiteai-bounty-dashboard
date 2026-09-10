import { requireUser } from "@/modules/auth/service";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    return ok(await requireUser());
  } catch (error) {
    return apiError(error);
  }
}
