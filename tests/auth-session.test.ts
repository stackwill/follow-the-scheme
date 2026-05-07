import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { createNodeSessionToken, verifyNodeSessionToken } from "@/lib/auth/session-node";

describe("auth session tokens", () => {
  it("verifies a freshly signed token", async () => {
    const token = await createSessionToken("release-secret", Date.UTC(2026, 0, 1));

    await expect(verifySessionToken(token, "release-secret", Date.UTC(2026, 0, 1))).resolves.toBe(true);
  });

  it("rejects tampered or expired tokens", async () => {
    const token = await createSessionToken("release-secret", Date.UTC(2026, 0, 1));

    await expect(verifySessionToken(`${token}x`, "release-secret", Date.UTC(2026, 0, 1))).resolves.toBe(false);
    await expect(verifySessionToken(token, "release-secret", Date.UTC(2026, 1, 1))).resolves.toBe(false);
  });

  it("uses compatible Node and Edge signatures", async () => {
    const nodeToken = createNodeSessionToken("release-secret", Date.UTC(2026, 0, 1));
    const edgeToken = await createSessionToken("release-secret", Date.UTC(2026, 0, 1));

    expect(nodeToken).toBe(edgeToken);
    expect(verifyNodeSessionToken(edgeToken, "release-secret", Date.UTC(2026, 0, 1))).toBe(true);
    await expect(verifySessionToken(nodeToken, "release-secret", Date.UTC(2026, 0, 1))).resolves.toBe(true);
  });
});
