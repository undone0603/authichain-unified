import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { resolveBrand } from "@/shared/brands";

export async function middleware(request: NextRequest) {
  // 1. Update Supabase Session
  const response = await updateSession(request);
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";

  // 2. System Routes & Shared App Routes (NEVER REWRITE)
  const isSystemRoute =
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/media") ||
    url.pathname.includes(".");

  const isAppRoute =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/success") ||
    url.pathname.startsWith("/terms") ||
    url.pathname.startsWith("/privacy") ||
    url.pathname.startsWith("/governance") ||
    url.pathname.startsWith("/digital-product-passport") ||
    url.pathname.startsWith("/authichain") ||
    url.pathname.startsWith("/p/") ||
    url.pathname.startsWith("/s/");

  if (isSystemRoute || isAppRoute) {
    return response;
  }

  // 3. Multi-domain routing logic
  const brand = resolveBrand(host);

  if (brand === "govchain") {
    url.pathname = url.pathname === "/" ? "/governance" : `/governance${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (brand === "strainchain") {
    url.pathname = url.pathname === "/" ? "/digital-product-passport" : `/digital-product-passport${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  if (brand === "authichain") {
    url.pathname = url.pathname === "/" ? "/authichain" : `/authichain${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Default (QRON or unknown)
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (media, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|media).*)",
  ],
};
