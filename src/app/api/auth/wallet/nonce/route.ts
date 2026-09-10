import { z } from "zod";
import { kiteChains } from "@/config/chains";
import { apiError, ApiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  CHALLENGE_TTL_MS,
  createWalletChallenge,
  normalizeWallet,
  randomToken,
  sha256,
} from "@/modules/auth/crypto";
import { assertSameOrigin } from "@/modules/auth/http";
import { isAdminWalletConfigured, requireDatabaseMode } from "@/modules/auth/service";

const input = z.object({
  address: z.string().min(1),
  chainId: z.number().int().positive(),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const env = requireDatabaseMode();
    const body = input.parse(await request.json());
    const chain = kiteChains[env.KITE_NETWORK];
    if (body.chainId !== chain.id)
      throw new ApiError(
        "WRONG_NETWORK",
        `请切换到 ${chain.name}（Chain ID ${chain.id}）。`,
        409,
      );
    const wallet = normalizeWallet(body.address);
    const db = getDb();
    const recent = await db.walletNonce.count({
      where: { wallet, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 5)
      throw new ApiError(
        "RATE_LIMITED",
        "签名请求过于频繁，请一分钟后重试。",
        429,
      );
    const invite = await db.participantInvite.findUnique({ where: { wallet } });
    const admin = await isAdminWalletConfigured(wallet, env.ADMIN_WALLET_ALLOWLIST);
    if (!admin && (!invite || invite.status === "DISABLED"))
      throw new ApiError(
        "INVITE_REQUIRED",
        "当前钱包不在白名单中，请联系管理员添加。",
        403,
      );
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const nonce = randomToken(18).replace(/[-_]/g, "A");
    const message = createWalletChallenge({
      address: wallet,
      chainId: chain.id,
      origin: env.APP_ORIGIN,
      nonce,
      issuedAt,
      expiresAt,
    });
    const challenge = await db.walletNonce.create({
      data: {
        wallet,
        chainId: chain.id,
        nonce,
        nonceHash: sha256(nonce),
        message,
        inviteId: invite?.id,
        expiresAt,
      },
    });
    return ok({
      challengeId: challenge.id,
      message,
      expiresAt: expiresAt.toISOString(),
      chain: { id: chain.id, name: chain.name },
    });
  } catch (error) {
    return apiError(error);
  }
}
