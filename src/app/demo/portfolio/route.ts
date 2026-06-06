import { NextResponse, type NextRequest } from "next/server";

import { authCookieOptions, DEMO_AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { createNodeSessionToken } from "@/lib/auth/session-node";

export function GET(request: NextRequest) {
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!sessionSecret) {
    return new NextResponse("Demo access is not configured.", { status: 503 });
  }

  const response = NextResponse.redirect(new URL("/?demo=portfolio", request.url));
  response.cookies.set(DEMO_AUTH_COOKIE_NAME, createNodeSessionToken(sessionSecret), authCookieOptions());

  return response;
}
