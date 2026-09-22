import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runNextJob } from "@/workers/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json(
      {
        error: { code: "UNAUTHORIZED", message: "Cron authorization failed." },
      },
      { status: 401 },
    );
  const startedAt = Date.now();
  let processed = 0;
  // Process one bounded job per invocation so a slow AI or GitHub call cannot
  // consume the entire serverless execution window together with later jobs.
  while (processed < 1 && Date.now() - startedAt < 70_000) {
    if (!(await runNextJob())) break;
    processed += 1;
  }
  console.log(
    JSON.stringify({
      event: "worker.cron.completed",
      processed,
      durationMs: Date.now() - startedAt,
    }),
  );
  return NextResponse.json(
    { data: { processed, durationMs: Date.now() - startedAt } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
