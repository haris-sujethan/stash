// Passes the request URL to server layouts, which can't read search params directly.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-stash-url", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/app/:path*", "/app"] };
