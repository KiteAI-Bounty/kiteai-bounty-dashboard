import "server-only";
import { cookies } from "next/headers";
import { readEnvironment } from "@/config/env";
import { ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { sha256 } from "./crypto";

export const SESSION_COOKIE = "kite_session";
export type Principal = {
  userId: string;
  wallet: string;
  chainId: number;
  role: "USER" | "ADMIN";
  github: { id: string; login: string; avatarUrl: string | null } | null;
};

export function requireDatabaseMode() {
  const env = readEnvironment(process.env);
  if (env.DATA_MODE !== "database")
    throw new ApiError(
      "DEMO_READ_ONLY",
      "只读演示模式不创建真实身份数据。请切换到数据库开发模式。",
      409,
    );
  return env;
}

export async function getCurrentUser(): Promise<Principal | null> {
  if (readEnvironment(process.env).DATA_MODE !== "database") return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32) return null;
  const session = await getDb().session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { github: true, invite: true } } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.disabledAt)
    return null;
  if (
    session.user.role !== "ADMIN" &&
    (session.user.invite?.status !== "ACTIVE" ||
      session.user.invite.wallet !== session.user.wallet)
  )
    return null;
  return {
    userId: session.user.id,
    wallet: session.user.wallet,
    chainId: session.chainId,
    role: session.user.role,
    github: session.user.github
      ? {
          id: session.user.github.githubUserId.toString(),
          login: session.user.github.login,
          avatarUrl: session.user.github.avatarUrl,
        }
      : null,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("AUTH_REQUIRED", "请先完成钱包签名登录。", 401);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN")
    throw new ApiError("FORBIDDEN", "需要管理员权限。", 403);
  return user;
}

export function isAdminWallet(wallet: string, allowlist: string) {
  return allowlist
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(wallet.toLowerCase());
}

export async function isAdminWalletConfigured(wallet: string, allowlist: string) {
  if (isAdminWallet(wallet, allowlist)) return true;
  const record = await getDb().adminWallet.findUnique({ where: { wallet } });
  return Boolean(record?.active);
}
