import { NextResponse, type NextRequest } from "next/server";

import { authRedirectUrl, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next") ?? undefined);
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorDescription) {
    const fallbackPath = next === "/reset-password" ? "/forgot-password" : "/login";

    return NextResponse.redirect(
      new URL(
        authRedirectUrl(fallbackPath, {
          next,
          error: errorDescription.replace(/\+/g, " "),
        }),
        request.url,
      ),
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const fallbackPath = next === "/reset-password" ? "/forgot-password" : "/login";

      return NextResponse.redirect(
        new URL(
          authRedirectUrl(fallbackPath, {
            next,
            error: error.message,
          }),
          request.url,
        ),
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
