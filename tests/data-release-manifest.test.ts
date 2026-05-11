import { describe, expect, it } from "vitest";

import { buildDataReleaseManifest } from "@/lib/data-release/manifest";

describe("data release manifest", () => {
  it("includes version, app database, crops count, and source commit", () => {
    const manifest = buildDataReleaseManifest({
      releaseName: "data-2026-05-11T120000Z",
      gitCommit: "abc123",
      appDbSha256: "0".repeat(64),
      cropFileCount: 42,
      paperCount: 10,
      questionCount: 337,
    });

    expect(manifest).toEqual({
      schemaVersion: 1,
      releaseName: "data-2026-05-11T120000Z",
      createdAt: expect.any(String),
      gitCommit: "abc123",
      files: {
        appDb: {
          path: "app.db",
          sha256: "0".repeat(64),
        },
      },
      counts: {
        crops: 42,
        papers: 10,
        questions: 337,
      },
    });
  });
});
