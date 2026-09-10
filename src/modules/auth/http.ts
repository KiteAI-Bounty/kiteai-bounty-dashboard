import { readEnvironment } from "@/config/env";
import { ApiError } from "@/lib/api";

export function assertSameOrigin(request: Request) {
  const expected = new URL(readEnvironment(process.env).APP_ORIGIN).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== expected)
    throw new ApiError("INVALID_ORIGIN", "请求来源校验失败。", 403);
}
