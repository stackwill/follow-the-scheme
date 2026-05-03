import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
};

function isPathInside(childPath: string, parentPath: string) {
  const relativePath = path.relative(parentPath, childPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export async function GET(request: NextRequest) {
  const assetPath = request.nextUrl.searchParams.get("path");

  if (!assetPath) {
    return new Response("Missing asset path", { status: 400 });
  }

  try {
    const { dataRoot } = await import("@/lib/paths");
    const resolvedPath = path.resolve(assetPath);
    const [realDataRoot, realAssetPath] = await Promise.all([realpath(dataRoot), realpath(resolvedPath)]);

    if (!isPathInside(realAssetPath, realDataRoot)) {
      return new Response("Asset path is outside the app data directory", { status: 403 });
    }

    const fileStat = await stat(realAssetPath);

    if (!fileStat.isFile()) {
      return new Response("Asset not found", { status: 404 });
    }

    const file = await readFile(realAssetPath);

    return new Response(file, {
      headers: {
        "content-type": contentTypes[path.extname(realAssetPath).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response("Asset not found", { status: 404 });
    }

    throw error;
  }
}
