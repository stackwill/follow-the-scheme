export const AUTH_COOKIE_NAME = "followthescheme_session";

const SESSION_VERSION = "v1";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 14;
const encoder = new TextEncoder();

function base64UrlEncode(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncode(signature);
}

function secureCompare(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function createSessionToken(secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_DURATION_SECONDS;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  const signature = await hmacSha256(secret, payload);

  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!token || !secret) {
    return false;
  }

  const [version, expiresAtText, signature, ...extraParts] = token.split(".");

  if (extraParts.length > 0 || version !== SESSION_VERSION || !expiresAtText || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtText);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }

  const expectedSignature = await hmacSha256(secret, `${version}.${expiresAtText}`);

  return secureCompare(signature, expectedSignature);
}

export function sessionDurationSeconds() {
  return SESSION_DURATION_SECONDS;
}
