import { verifyNodeSessionToken } from "@/lib/auth/session-node";

export type AccessMode = "normal" | "demo";

type SessionCookies = {
  normalToken?: string;
  demoToken?: string;
};

export function resolveNodeAccessMode(
  cookies: SessionCookies,
  secret: string | undefined,
  now = Date.now(),
): AccessMode | null {
  if (verifyNodeSessionToken(cookies.normalToken, secret, now)) {
    return "normal";
  }

  if (verifyNodeSessionToken(cookies.demoToken, secret, now)) {
    return "demo";
  }

  return null;
}
