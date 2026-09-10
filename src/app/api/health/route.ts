import { ok } from "@/lib/api";
export function GET() {
  return ok({ status: "ok", service: "kiteai-bounty", version: "0.1.0" });
}
