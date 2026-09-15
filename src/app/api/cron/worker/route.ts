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
  while (processed < 6 && Date.now() - startedAt < 45_000) {
    if (!(await runNextJob())) break;
    processed += 1;
  }
  return NextResponse.json(
    { data: { processed, durationMs: Date.now() - startedAt } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
