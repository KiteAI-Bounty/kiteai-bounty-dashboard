import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ok<T>(data: T) {
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export function apiError(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "请求参数不正确。",
          fields: error.issues.map((issue) => issue.path.join(".")),
        },
      },
      { status: 400 },
    );
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  console.error(
    "[api]",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "服务暂不可用，请检查服务配置后重试。",
      },
    },
    { status: 503 },
  );
}
