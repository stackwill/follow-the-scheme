import { describe, expect, it } from "vitest";

import { parseSessionLabel } from "../src/lib/import/pmt/normalize";

describe("parseSessionLabel", () => {
  it("extracts a June year label", () => {
    expect(parseSessionLabel("June 2024 QP")).toEqual({
      sessionLabel: "June 2024",
      year: 2024,
    });
  });
});
