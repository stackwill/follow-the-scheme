import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const assetPath = request.nextUrl.searchParams.get("path");

  if (!assetPath) {
    return new Response("Missing asset path", { status: 400 });
  }

  try {
    const { cropRootPathForAsset } = await import("@/lib/assets/paths");
    const { cropsRoot } = await import("@/lib/paths");
    const resolvedPath = cropRootPathForAsset(assetPath);
    const [realCropsRoot, realAssetPath] = await Promise.all([realpath(cropsRoot), realpath(resolvedPath)]);
    const relativePath = path.relative(realCropsRoot, realAssetPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return new Response("Asset path is outside the crop asset directory", { status: 403 });
    }

    if (path.extname(realAssetPath).toLowerCase() !== ".png") {
      return new Response("Only PNG crop assets can be served", { status: 403 });
    }

    const fileStat = await stat(realAssetPath);

    if (!fileStat.isFile()) {
      return new Response("Asset not found", { status: 404 });
    }

    const file = await readFile(realAssetPath);

    return new Response(file, {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response("Asset not found", { status: 404 });
    }

    if (error instanceof Error && /Invalid data asset path|outside the crop asset directory/.test(error.message)) {
      return new Response("Asset path is outside the crop asset directory", { status: 403 });
    }

    throw error;
  }
}
