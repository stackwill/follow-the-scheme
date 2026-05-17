import { describe, expect, it } from "vitest";

import { normalizeSchoolAnswer, verifyPassword } from "@/lib/auth/password";

describe("school answer auth", () => {
  it("accepts King/King's/Kings Ely variants with punctuation and spacing", () => {
    expect(verifyPassword("Kings Ely")).toBe(true);
    expect(verifyPassword("King's Ely")).toBe(true);
    expect(verifyPassword("KING... ELY!!!")).toBe(true);
    expect(verifyPassword("k-i-n-g-s---e-l-y")).toBe(true);
    expect(verifyPassword("kingsely")).toBe(true);
  });

  it("requires both the king/kings and ely parts", () => {
    expect(verifyPassword("Kings")).toBe(false);
    expect(verifyPassword("Ely")).toBe(false);
    expect(verifyPassword("Queen Ely")).toBe(false);
  });

  it("normalizes punctuation without preserving separator characters", () => {
    expect(normalizeSchoolAnswer(" King’s, Ely. ")).toBe("king s ely");
  });
});
