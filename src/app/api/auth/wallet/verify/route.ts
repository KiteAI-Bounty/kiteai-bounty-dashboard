import { cookies } from "next/headers";
import { z } from "zod";
import { apiError, ApiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  normalizeWallet,
  randomToken,
  SESSION_TTL_MS,
  sha256,
  verifyWalletSignature,
} from "@/modules/auth/crypto";
import { assertSameOrigin } from "@/modules/auth/http";
import {
  isAdminWalletConfigured,
  requireDatabaseMode,
  SESSION_COOKIE,
} from "@/modules/auth/service";

const input = z.object({
  challengeId: z.string().min(1),
  address: z.string().min(1),
  signature: z.string().min(1),
});
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const env = requireDatabaseMode();
    const body = input.parse(await request.json());
    const wallet = normalizeWallet(body.address);
    const challenge = await getDb().walletNonce.findUnique({
      where: { id: body.challengeId },
    });
    if (
      !challenge ||
      challenge.wallet !== wallet ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date()
    )
      throw new ApiError(
        "CHALLENGE_INVALID",
        "签名请求不存在、已使用或已过期。",
        401,
      );
    if (
      !(await verifyWalletSignature({
        address: wallet,
        message: challenge.message,
        signature: body.signature,
      }))
    )
      throw new ApiError("SIGNATURE_INVALID", "钱包签名验证失败。", 401);
    const rawToken = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const principal = await getDb().$transaction(async (tx) => {
      const consumed = await tx.walletNonce.updateMany({
        where: {
          id: challenge.id,
          wallet,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1)
        throw new ApiError("CHALLENGE_INVALID", "签名请求已被使用。", 401);
      const admin = await isAdminWalletConfigured(wallet, env.ADMIN_WALLET_ALLOWLIST);
      const invite = challenge.inviteId
        ? await tx.participantInvite.findUnique({
            where: { id: challenge.inviteId },
          })
        : null;
      if (
        !admin &&
        (!invite || invite.status === "DISABLED" || invite.wallet !== wallet)
      )
        throw new ApiError(
          "INVITE_INVALID",
          "参与者白名单已失效或钱包不匹配。",
          403,
        );
      const user = await tx.user.upsert({
        where: { wallet },
        update: admin ? { role: "ADMIN" } : {},
        create: { wallet, role: admin ? "ADMIN" : "USER" },
        include: { github: true },
      });
      if (invite) {
        const activated = await tx.participantInvite.updateMany({
          where: {
            id: invite.id,
            wallet,
            status: { not: "DISABLED" },
            OR: [{ userId: null }, { userId: user.id }],
          },
          data: {
            wallet,
            userId: user.id,
            status: "ACTIVE",
            activatedAt: invite.activatedAt ?? new Date(),
          },
        });
        if (activated.count !== 1)
          throw new ApiError(
            "INVITE_ALREADY_USED",
            "该白名单记录已绑定其他用户。",
            409,
          );
      }
      await tx.session.create({
        data: {
          tokenHash: sha256(rawToken),
          userId: user.id,
          chainId: challenge.chainId,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "auth.wallet.login",
          entityType: "User",
          entityId: user.id,
          after: { chainId: challenge.chainId },
        },
      });
      return {
        userId: user.id,
        wallet: user.wallet,
        chainId: challenge.chainId,
        role: user.role,
        github: user.github
          ? {
              id: user.github.githubUserId.toString(),
              login: user.github.login,
              avatarUrl: user.github.avatarUrl,
            }
          : null,
      };
    });
    (await cookies()).set(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: env.APP_ENV !== "development",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      priority: "high",
    });
    return ok({
      ...principal,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
