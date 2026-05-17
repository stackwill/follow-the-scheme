import { describe, expect, it } from "vitest";

import { clearFailedLogins, loginRetryAfterSeconds, recordFailedLogin } from "@/lib/auth/login-rate-limit";

describe("login rate limiting", () => {
  it("locks a client after repeated failures and clears after success", () => {
    const key = "test-client";
    const now = Date.UTC(2026, 0, 1);

    clearFailedLogins(key);

    for (let index = 0; index < 4; index += 1) {
      expect(recordFailedLogin(key, now + index)).toBe(0);
    }

    expect(recordFailedLogin(key, now + 4)).toBe(30);
    expect(loginRetryAfterSeconds(key, now + 5)).toBe(30);

    clearFailedLogins(key);
    expect(loginRetryAfterSeconds(key, now + 6)).toBe(0);
  });
});
