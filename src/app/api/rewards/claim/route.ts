import { ApiError, apiError } from "@/lib/api";
export function POST() {
  return apiError(
    new ApiError(
      "FEATURE_DISABLED",
      "领取功能尚未开放，不会产生链上交易。",
      503,
    ),
  );
}
