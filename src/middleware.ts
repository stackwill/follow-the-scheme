import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/icon.svg", "/login", "/umami/script.js"]);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith("/fonts/");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const authenticated = await verifySessionToken(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
    process.env.AUTH_SESSION_SECRET,
  );

  if (authenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (authenticated || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
