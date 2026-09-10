import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]),
  DATA_MODE: z.enum(["demo", "database"]),
  KITE_NETWORK: z.enum(["testnet", "mainnet"]),
  EC_PROVIDER_MODE: z.enum(["mock", "sandbox", "live"]),
  CLAIMS_ENABLED: z.enum(["false", "true"]).default("false"),
  PAYMENT_PROVIDER_MODE: z.enum(["mock", "agent_passport"]).default("mock"),
  DATABASE_URL: z.string().url().optional(),
  APP_ORIGIN: z.string().url(),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_EC_TOKEN: z.string().min(1).optional(),
  EC_UPSTREAM_OWNER: z.string().default("electric-capital"),
  EC_UPSTREAM_REPOSITORY: z.string().default("open-dev-data"),
  EC_FORK_OWNER: z.string().optional(),
  EC_FORK_REPOSITORY: z.string().default("open-dev-data"),
  ADMIN_WALLET_ALLOWLIST: z.string().default(""),
});

export function readEnvironment(source: Record<string, string | undefined>) {
  const appEnv =
    source.APP_ENV ??
    (source.NODE_ENV === "production" ? "production" : "development");
  const env = schema.parse({
    APP_ENV: appEnv,
    DATA_MODE:
      source.DATA_MODE ?? (appEnv === "development" ? "demo" : "database"),
    KITE_NETWORK:
      source.KITE_NETWORK ?? (appEnv === "production" ? "mainnet" : "testnet"),
    EC_PROVIDER_MODE:
      source.EC_PROVIDER_MODE ?? (appEnv === "production" ? "live" : "mock"),
    CLAIMS_ENABLED: source.CLAIMS_ENABLED,
    PAYMENT_PROVIDER_MODE: source.PAYMENT_PROVIDER_MODE,
    DATABASE_URL: source.DATABASE_URL,
    APP_ORIGIN: source.APP_ORIGIN ?? "http://127.0.0.1:3000",
    GITHUB_OAUTH_CLIENT_ID: source.GITHUB_OAUTH_CLIENT_ID,
    GITHUB_OAUTH_CLIENT_SECRET: source.GITHUB_OAUTH_CLIENT_SECRET,
    GITHUB_EC_TOKEN: source.GITHUB_EC_TOKEN,
    EC_UPSTREAM_OWNER: source.EC_UPSTREAM_OWNER,
    EC_UPSTREAM_REPOSITORY: source.EC_UPSTREAM_REPOSITORY,
    EC_FORK_OWNER: source.EC_FORK_OWNER,
    EC_FORK_REPOSITORY: source.EC_FORK_REPOSITORY,
    ADMIN_WALLET_ALLOWLIST: source.ADMIN_WALLET_ALLOWLIST,
  });
  if (env.APP_ENV !== "development" && env.DATA_MODE === "demo") {
    throw new Error("Demo data is restricted to APP_ENV=development.");
  }
  if (env.DATA_MODE === "database" && !env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in database mode.");
  }
  if (
    env.APP_ENV === "production" &&
    (env.KITE_NETWORK !== "mainnet" || env.EC_PROVIDER_MODE !== "live")
  ) {
    throw new Error("Production requires mainnet and live EC configuration.");
  }
  if (env.CLAIMS_ENABLED === "true" && (env.APP_ENV === "production" || env.PAYMENT_PROVIDER_MODE !== "mock")) {
    throw new Error(
      "生产支付适配器尚未配置，CLAIMS_ENABLED 目前只能在开发模拟模式开启。",
    );
  }
  const origin = new URL(env.APP_ORIGIN);
  if (origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error(
      "APP_ORIGIN must contain only scheme, host and optional port.",
    );
  }
  if (env.APP_ENV !== "development" && origin.protocol !== "https:") {
    throw new Error("Non-development APP_ORIGIN must use HTTPS.");
  }
  if (
    Boolean(env.GITHUB_OAUTH_CLIENT_ID) !==
    Boolean(env.GITHUB_OAUTH_CLIENT_SECRET)
  ) {
    throw new Error(
      "GitHub OAuth client ID and secret must be configured together.",
    );
  }
  return env;
}

export type Environment = ReturnType<typeof readEnvironment>;
