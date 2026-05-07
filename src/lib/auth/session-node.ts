import { createHmac, timingSafeEqual } from "node:crypto";

import { sessionDurationSeconds } from "@/lib/auth/session";

const SESSION_VERSION = "v1";

function base64UrlEncode(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sign(secret: string, value: string) {
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

export function createNodeSessionToken(secret: string, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + sessionDurationSeconds();
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  const signature = sign(secret, payload);

  return `${payload}.${signature}`;
}

export function verifyNodeSessionToken(token: string | undefined, secret: string | undefined, now = Date.now()) {
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

  const expectedSignature = sign(secret, `${version}.${expiresAtText}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
}
