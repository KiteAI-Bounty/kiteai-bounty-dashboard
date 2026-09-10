import { cookies } from "next/headers";
import { apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sha256 } from "@/modules/auth/crypto";
import { assertSameOrigin } from "@/modules/auth/http";
import { requireDatabaseMode, SESSION_COOKIE } from "@/modules/auth/service";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireDatabaseMode();
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token)
      await getDb().session.deleteMany({ where: { tokenHash: sha256(token) } });
    store.delete(SESSION_COOKIE);
    return ok({ loggedOut: true });
  } catch (error) {
    return apiError(error);
  }
}
