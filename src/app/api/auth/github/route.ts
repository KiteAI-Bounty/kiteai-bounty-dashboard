import { NextResponse } from "next/server";
import { ApiError, apiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  createPkcePair,
  randomToken,
  safeReturnTo,
  sha256,
} from "@/modules/auth/crypto";
import { requireDatabaseMode, requireUser } from "@/modules/auth/service";

export async function GET(request: Request) {
  try {
    const env = requireDatabaseMode();
    const user = await requireUser();
    if (user.role === "ADMIN")
      throw new ApiError(
        "ADMIN_GITHUB_NOT_REQUIRED",
        "管理员不需要绑定 GitHub。",
        403,
      );
    if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET)
      throw new ApiError(
        "GITHUB_NOT_CONFIGURED",
        "GitHub OAuth 尚未配置。请在 .env 填写 GITHUB_OAUTH_CLIENT_ID 和 GITHUB_OAUTH_CLIENT_SECRET，并重启开发服务器。",
        503,
      );
    const returnTo = safeReturnTo(
      new URL(request.url).searchParams.get("returnTo"),
    );
    const state = randomToken();
    const { verifier, challenge } = createPkcePair();
    await getDb().oAuthState.create({
      data: {
        stateHash: sha256(state),
        codeVerifier: verifier,
        userId: user.userId,
        returnTo,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
    authorize.searchParams.set(
      "redirect_uri",
      `${new URL(env.APP_ORIGIN).origin}/api/auth/github/callback`,
    );
    authorize.searchParams.set("scope", "read:user");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(authorize);
  } catch (error) {
    return apiError(error);
  }
}
