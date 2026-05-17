export function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function authRedirectUrl(
  pathname: "/forgot-password" | "/login" | "/register" | "/reset-password",
  params: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

  return `${pathname}${suffix}`;
}

export function requestOrigin(headers: Headers) {
  const host = headers.get("host");
  const protocol = headers.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
