import { createHash, randomBytes } from "node:crypto";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function normalizeWallet(value: string) {
  if (!isAddress(value, { strict: false }))
    throw new Error("Invalid EVM address.");
  return getAddress(value).toLowerCase();
}

export function createWalletChallenge(input: {
  address: string;
  chainId: number;
  origin: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}) {
  const origin = new URL(input.origin);
  return createSiweMessage({
    address: getAddress(input.address),
    chainId: input.chainId,
    domain: origin.host,
    uri: origin.origin,
    version: "1",
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    expirationTime: input.expiresAt,
    statement: "Sign in to the KiteAI Open Source Bounty dashboard.",
  });
}

export async function verifyWalletSignature(input: {
  address: string;
  message: string;
  signature: string;
}) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) return false;
  return verifyMessage({
    address: getAddress(input.address),
    message: input.message,
    signature: input.signature as Hex,
  });
}

export function createPkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function safeReturnTo(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/dashboard";
  return value;
}
