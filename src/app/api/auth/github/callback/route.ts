import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnvironment } from "@/config/env";
import { ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sha256 } from "@/modules/auth/crypto";
import { requireUser } from "@/modules/auth/service";
import { initialCampaign } from "@/modules/campaigns/domain";

const githubUser = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
  avatar_url: z.string().url().nullable(),
});
const tokenResponse = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  scope: z.string().optional(),
});

function destination(origin: string, returnTo: string, result: string) {
  const url = new URL(returnTo, origin);
  url.searchParams.set("github", result);
  return url;
}

export async function GET(request: Request) {
  const env = readEnvironment(process.env);
  const requestUrl = new URL(request.url);
  let returnTo = "/dashboard";
  try {
    if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET)
      throw new ApiError(
        "GITHUB_NOT_CONFIGURED",
        "GitHub OAuth 尚未配置。请在 .env 填写 GITHUB_OAUTH_CLIENT_ID 和 GITHUB_OAUTH_CLIENT_SECRET，并重启开发服务器。",
        503,
      );
    if (requestUrl.searchParams.get("error"))
      return NextResponse.redirect(
        destination(env.APP_ORIGIN, returnTo, "cancelled"),
      );
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    if (!code || !state)
      throw new ApiError("OAUTH_INVALID", "GitHub 回调参数不完整。", 400);
    const user = await requireUser();
    const record = await getDb().oAuthState.findUnique({
      where: { stateHash: sha256(state) },
    });
    if (
      !record ||
      record.userId !== user.userId ||
      record.consumedAt ||
      record.expiresAt <= new Date()
    )
      throw new ApiError(
        "OAUTH_INVALID",
        "GitHub 授权请求不存在、已使用或已过期。",
        401,
      );
    returnTo = record.returnTo;
    const consumed = await getDb().oAuthState.updateMany({
      where: {
        id: record.id,
        userId: user.userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new ApiError("OAUTH_INVALID", "GitHub 授权请求已被使用。", 401);
    const tokenFetch = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_OAUTH_CLIENT_ID,
          client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
          code,
          redirect_uri: `${new URL(env.APP_ORIGIN).origin}/api/auth/github/callback`,
          code_verifier: record.codeVerifier,
        }),
      },
    );
    if (!tokenFetch.ok)
      throw new ApiError(
        "GITHUB_UNAVAILABLE",
        "GitHub 授权服务暂不可用。",
        502,
      );
    const tokenJson = await tokenFetch.json();
    if (tokenJson.error)
      throw new ApiError(
        "OAUTH_EXCHANGE_FAILED",
        "GitHub 授权码无效或已过期。",
        401,
      );
    const token = tokenResponse.parse(tokenJson);
    const profileFetch = await fetch("https://api.github.com/user", {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token.access_token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    });
    if (!profileFetch.ok)
      throw new ApiError("GITHUB_UNAVAILABLE", "无法读取 GitHub 身份。", 502);
    const profile = githubUser.parse(await profileFetch.json());
    await getDb().$transaction(async (tx) => {
      const invite = await tx.participantInvite.findUnique({
        where: { userId: user.userId },
      });
      if (
        invite?.githubLogin &&
        invite.githubLogin.toLowerCase() !== profile.login.toLowerCase()
      )
        throw new ApiError(
          "GITHUB_NOT_INVITED",
          "当前 GitHub 账号与管理员登记的账号不一致。",
          403,
        );
      const own = await tx.githubAccount.findUnique({
        where: { userId: user.userId },
      });
      if (own && own.githubUserId !== BigInt(profile.id))
        throw new ApiError(
          "GITHUB_REBIND_REQUIRES_ADMIN",
          "该钱包已绑定其他 GitHub，换绑需要管理员处理。",
          409,
        );
      const taken = await tx.githubAccount.findUnique({
        where: { githubUserId: BigInt(profile.id) },
      });
      if (taken && taken.userId !== user.userId)
        throw new ApiError(
          "GITHUB_ALREADY_BOUND",
          "该 GitHub 账号已绑定其他钱包。",
          409,
        );
      await tx.githubAccount.upsert({
        where: { userId: user.userId },
        update: { login: profile.login, avatarUrl: profile.avatar_url },
        create: {
          userId: user.userId,
          githubUserId: BigInt(profile.id),
          login: profile.login,
          avatarUrl: profile.avatar_url,
        },
      });
      const campaign = await tx.campaign.findUnique({
        where: { id: initialCampaign.id },
        select: { id: true },
      });
      if (campaign)
        await tx.enrollment.upsert({
          where: {
            campaignId_userId: { campaignId: campaign.id, userId: user.userId },
          },
          update: {},
          create: { campaignId: campaign.id, userId: user.userId },
        });
      await tx.auditLog.create({
        data: {
          actorId: user.userId,
          action: "auth.github.bind",
          entityType: "GithubAccount",
          entityId: profile.id.toString(),
          after: { login: profile.login },
        },
      });
    });
    return NextResponse.redirect(
      destination(env.APP_ORIGIN, returnTo, "bound"),
    );
  } catch (error) {
    const code =
      error instanceof ApiError ? error.code.toLowerCase() : "failed";
    console.error(
      "[github callback]",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.redirect(destination(env.APP_ORIGIN, returnTo, code));
  }
}
