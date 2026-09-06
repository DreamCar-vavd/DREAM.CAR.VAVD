import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales } from "@/lib/i18n/config";

const SENTINEL_PATH = "/__proxy_404__/nf";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") return NextResponse.next();
  if (pathname.startsWith("/api")) return NextResponse.next();
  if (pathname === "/keystatic" || pathname.startsWith("/keystatic/")) {
    return NextResponse.next();
  }
  if (pathname === "/panel" || pathname.startsWith("/panel/")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next")) return NextResponse.next();
  if (pathname === "/favicon.ico") return NextResponse.next();
  if (pathname === "/robots.txt") return NextResponse.next();
  if (pathname === "/sitemap.xml") return NextResponse.next();
  if (pathname.startsWith("/__proxy_404__")) return NextResponse.next();

  const lastSegment = pathname.split("/").pop() ?? "";
  if (lastSegment.includes(".")) return NextResponse.next();

  const firstSegment = pathname.split("/")[1] ?? "";
  if ((locales as readonly string[]).includes(firstSegment)) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(SENTINEL_PATH, request.url));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
