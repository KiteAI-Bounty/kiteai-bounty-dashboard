import { readEnvironment } from "@/config/env";
import { getDb } from "@/lib/db";
import { ok, apiError } from "@/lib/api";
export async function GET() {
  try {
    const env = readEnvironment(process.env);
    if (env.DATA_MODE === "database") await getDb().$queryRaw`SELECT 1`;
    return ok({
      status: "ready",
      mode: env.DATA_MODE,
      auth: env.DATA_MODE === "database" ? "wallet_allowlist" : "demo_disabled",
      claimsEnabled: false,
    });
  } catch (error) {
    return apiError(error);
  }
}
