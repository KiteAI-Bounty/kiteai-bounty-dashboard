import assert from "node:assert/strict";
import { test } from "node:test";
import { readEnvironment } from "../src/config/env";
import {
  initialCampaign,
  currentWeek,
  WEEK_MS,
  emptyWeekStatus,
} from "../src/modules/campaigns/domain";
import { submissionInput } from "../src/modules/submissions/contracts";
import { handleJob } from "../src/workers/handlers";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPkcePair,
  createWalletChallenge,
  normalizeWallet,
  safeReturnTo,
  verifyWalletSignature,
} from "../src/modules/auth/crypto";
import { parseParticipantCsv } from "../src/modules/auth/invitation-contracts";

test("production rejects demo, testnet and payment activation", () => {
  const base = {
    APP_ENV: "production",
    DATA_MODE: "database",
    KITE_NETWORK: "mainnet",
    EC_PROVIDER_MODE: "live",
    DATABASE_URL: "postgresql://localhost/kite",
    APP_ORIGIN: "https://bounty.gokite.ai",
  };
  assert.equal(readEnvironment(base).DATA_MODE, "database");
  for (const override of [
    { DATA_MODE: "demo" },
    { KITE_NETWORK: "testnet" },
    { EC_PROVIDER_MODE: "mock" },
    { CLAIMS_ENABLED: "true" },
    { DATABASE_URL: undefined },
  ]) {
    assert.throws(() => readEnvironment({ ...base, ...override }));
  }
  assert.throws(() =>
    readEnvironment({ APP_ENV: "staging", DATA_MODE: "demo" }),
  );
});
test("Beijing Monday midnight is a half-open boundary", () => {
  const weeks = initialCampaign.weeks;
  for (const week of weeks)
    assert.equal(Date.parse(week.endsAt) - Date.parse(week.startsAt), WEEK_MS);
  assert.equal(
    currentWeek(weeks, new Date("2026-09-15T15:59:59.999Z"))?.number,
    1,
  );
  assert.equal(currentWeek(weeks, new Date("2026-09-15T16:00:00Z"))?.number, 2);
  assert.equal(
    currentWeek(weeks, new Date("2026-09-25T00:00:00+08:00"))?.number,
    3,
  );
  assert.equal(
    currentWeek(weeks, new Date("2026-10-12T00:00:00+08:00")),
    undefined,
  );
  assert.equal(
    emptyWeekStatus(weeks[0], new Date("2026-09-10T00:00:00Z")),
    "not_submitted",
  );
});
test("contribution URL validation rejects lookalike hosts and embedded credentials", () => {
  const input = {
    repositoryId: "repo",
    weekId: "week",
    summary: "A meaningful new code contribution in the correct repository.",
  };
  for (const url of [
    "https://github.com.evil.test/repo",
    "http://github.com/repo",
    "https://user:pass@github.com/repo",
  ]) {
    assert.equal(
      submissionInput.safeParse({ ...input, evidenceUrls: [url] }).success,
      false,
    );
  }
  assert.equal(
    submissionInput.safeParse({
      ...input,
      evidenceUrls: ["https://github.com/example/repo/commit/abc"],
    }).success,
    true,
  );
});
test("unsupported jobs and incomplete payment jobs never report success", async () => {
  await assert.rejects(
    () => handleJob({ id: "fake", type: "ec.create-pr", payload: {} }),
    /No handler/,
  );
  await assert.rejects(
    () => handleJob({ id: "fake", type: "payment.send", payload: {} }),
    /Payment job payload is incomplete/,
  );
});

test("wallet challenge verifies its signer and rejects another wallet", async () => {
  const account = privateKeyToAccount(
    "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  const other = privateKeyToAccount(
    "0x1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  );
  const message = createWalletChallenge({
    address: account.address,
    chainId: 2368,
    origin: "http://127.0.0.1:3000",
    nonce: "AbCdEf123456",
    issuedAt: new Date("2026-09-10T00:00:00Z"),
    expiresAt: new Date("2026-09-10T00:05:00Z"),
  });
  const signature = await account.signMessage({ message });
  assert.equal(
    await verifyWalletSignature({
      address: account.address,
      message,
      signature,
    }),
    true,
  );
  assert.equal(
    await verifyWalletSignature({ address: other.address, message, signature }),
    false,
  );
  assert.equal(normalizeWallet(account.address), account.address.toLowerCase());
});

test("OAuth helpers create S256 material and constrain return paths", () => {
  const first = createPkcePair();
  const second = createPkcePair();
  assert.notEqual(first.verifier, second.verifier);
  assert.match(first.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    safeReturnTo("/dashboard?tab=identity"),
    "/dashboard?tab=identity",
  );
  assert.equal(safeReturnTo("//evil.example"), "/dashboard");
  assert.equal(safeReturnTo("/\\evil.example"), "/dashboard");
});

test("participant CSV requires wallets and rejects duplicate identities", () => {
  const rows = parseParticipantCsv(
    'name,contact,github,wallet\n"张三",USER@EXAMPLE.COM,@octocat,0x0000000000000000000000000000000000000021\n李四,wechat-li,,0xFCAd0B19bB29D4674531d6f115237E16AfCE377c',
  );
  assert.deepEqual(rows[0], {
    displayName: "张三",
    contact: "user@example.com",
    githubLogin: "octocat",
    wallet: "0x0000000000000000000000000000000000000021",
  });
  assert.equal(rows[1].wallet, "0xfcad0b19bb29d4674531d6f115237e16afce377c");
  assert.throws(
    () =>
      parseParticipantCsv(
        "name,contact,wallet\n张三,same@example.com,0x0000000000000000000000000000000000000021\n李四,SAME@example.com,0x0000000000000000000000000000000000000022",
      ),
    /CSV_CONTACT_DUPLICATE/,
  );
  assert.throws(
    () => parseParticipantCsv("name,contact,wallet\n张三,user@example.com,"),
    /CSV_ROW_INVALID/,
  );
});
