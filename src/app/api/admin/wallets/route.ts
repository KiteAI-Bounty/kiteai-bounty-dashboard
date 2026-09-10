import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertSameOrigin } from "@/modules/auth/http";
import { normalizeWallet } from "@/modules/auth/crypto";
import { requireAdmin } from "@/modules/auth/service";

const input = z.object({ wallet: z.string().min(42).max(42) });

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getDb().adminWallet.findMany({ orderBy: { createdAt: "desc" } }));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { wallet } = input.parse(await request.json());
    const normalized = normalizeWallet(wallet);
    const record = await getDb().adminWallet.upsert({
      where: { wallet: normalized },
      update: { active: true },
      create: { wallet: normalized },
    });
    await getDb().auditLog.create({
      data: { actorId: admin.userId, action: "admin.wallet.add", entityType: "AdminWallet", entityId: record.id, after: { wallet: normalized } },
    });
    return ok(record);
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { wallet } = input.parse(await request.json());
    const normalized = normalizeWallet(wallet);
    const record = await getDb().adminWallet.update({ where: { wallet: normalized }, data: { active: false } });
    await getDb().auditLog.create({ data: { actorId: admin.userId, action: "admin.wallet.disable", entityType: "AdminWallet", entityId: record.id, after: { wallet: normalized } } });
    return ok(record);
  } catch (error) { return apiError(error); }
}
