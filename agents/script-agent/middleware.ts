import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { CORS_HEADERS } from "@/lib/cors";

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: "/:path*",
};
