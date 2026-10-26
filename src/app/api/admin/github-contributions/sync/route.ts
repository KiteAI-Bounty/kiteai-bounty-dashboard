import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/service";
import {
  SECOND_MONTH_KEY,
  syncGithubContributions,
} from "@/modules/github-contributions/sync";

const input = z.object({
  reportMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .default(SECOND_MONTH_KEY),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = input.parse(await request.json().catch(() => ({})));
    return ok(await syncGithubContributions(body.reportMonth));
  } catch (error) {
    return apiError(error);
  }
}
