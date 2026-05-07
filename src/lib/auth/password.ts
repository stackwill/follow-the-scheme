import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function isPasswordConfigured() {
  return Boolean(process.env.AUTH_PASSWORD && process.env.AUTH_SESSION_SECRET);
}

export function verifyPassword(input: string) {
  const expectedPassword = process.env.AUTH_PASSWORD;

  if (!expectedPassword) {
    return false;
  }

  return timingSafeEqual(digest(input), digest(expectedPassword));
}
