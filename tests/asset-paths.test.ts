import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assetPathFromDataRoot,
  dataRootPathForAsset,
  isDataAssetPath,
} from "@/lib/assets/paths";

describe("data asset paths", () => {
  it("stores crop paths relative to APP_DATA_DIR", () => {
    const absolutePath = path.resolve("data/crops/imports/example/2024/01-1.png");

    expect(assetPathFromDataRoot(absolutePath)).toBe("crops/imports/example/2024/01-1.png");
  });

  it("resolves stored relative paths at runtime", () => {
    expect(dataRootPathForAsset("crops/imports/example/2024/01-1.png")).toMatch(
      /data\/crops\/imports\/example\/2024\/01-1\.png$/,
    );
  });

  it("allows existing absolute paths inside APP_DATA_DIR", () => {
    const absolutePath = path.resolve("data/crops/imports/example/2024/01-1.png");

    expect(dataRootPathForAsset(absolutePath)).toBe(absolutePath);
  });

  it("rejects traversal and outside absolute paths", () => {
    expect(() => dataRootPathForAsset("../app.db")).toThrow(/Invalid data asset path/);
    expect(() => dataRootPathForAsset("/tmp/app.db")).toThrow(/Invalid data asset path/);
    expect(isDataAssetPath("crops/imports/example.png")).toBe(true);
    expect(isDataAssetPath("../example.png")).toBe(false);
  });
});
