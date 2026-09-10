import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertSameOrigin } from "@/modules/auth/http";
import { importParticipants } from "@/modules/auth/invitations";
import { requireAdmin } from "@/modules/auth/service";

const input = z.object({ csv: z.string().min(1).max(256_000) });

export async function GET() {
  try {
    await requireAdmin();
    const rows = await getDb().participantInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        displayName: true,
        contact: true,
        githubLogin: true,
        wallet: true,
        status: true,
        activatedAt: true,
      },
    });
    return ok(rows);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const body = input.parse(await request.json());
    return ok(await importParticipants(body.csv, admin.userId));
  } catch (error) {
    return apiError(error);
  }
}
