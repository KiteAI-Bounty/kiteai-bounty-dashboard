import { z } from "zod";
import { apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertSameOrigin } from "@/modules/auth/http";
import { normalizeWallet } from "@/modules/auth/crypto";
import { requireAdmin } from "@/modules/auth/service";
import { readEnvironment } from "@/config/env";

const input = z.object({ wallet: z.string().min(42).max(42) });

export async function GET() {
  try {
    await requireAdmin();
    const env = readEnvironment(process.env);
    const dbWallets = await getDb().adminWallet.findMany({ orderBy: { createdAt: "desc" } });
    const allowlist = env.ADMIN_WALLET_ALLOWLIST.split(",")
      .map((item) => normalizeWallet(item.trim()))
      .filter(Boolean);

    const allowlistItems = allowlist.map((wallet) => ({
      id: `env-${wallet}`,
      wallet,
      active: true,
      isRoot: true,
      createdAt: new Date(0).toISOString(),
    }));

    const otherItems = dbWallets
      .filter((dw) => !allowlist.includes(dw.wallet.toLowerCase()))
      .map((dw) => ({
        id: dw.id,
        wallet: dw.wallet,
        active: dw.active,
        isRoot: false,
        createdAt: dw.createdAt.toISOString(),
      }));

    return ok([...allowlistItems, ...otherItems]);
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
    const env = readEnvironment(process.env);
    const allowlist = env.ADMIN_WALLET_ALLOWLIST.split(",")
      .map((item) => normalizeWallet(item.trim()))
      .filter(Boolean);
    if (allowlist.includes(normalized)) {
      throw new Error("环境变量配置的根管理员钱包不可在后台停用。");
    }
    const record = await getDb().adminWallet.update({ where: { wallet: normalized }, data: { active: false } });
    await getDb().auditLog.create({ data: { actorId: admin.userId, action: "admin.wallet.disable", entityType: "AdminWallet", entityId: record.id, after: { wallet: normalized } } });
    return ok(record);
  } catch (error) { return apiError(error); }
}
