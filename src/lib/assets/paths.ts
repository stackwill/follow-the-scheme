import path from "node:path";

import { cropsRoot, dataRoot } from "@/lib/paths";

function isPathInside(childPath: string, parentPath: string) {
  const relativePath = path.relative(parentPath, childPath);

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

export function isDataAssetPath(assetPath: string) {
  if (assetPath.length === 0 || path.isAbsolute(assetPath)) {
    return false;
  }

  const normalized = path.posix.normalize(assetPath.replaceAll("\\", "/"));

  return normalized === assetPath && !normalized.startsWith("../") && normalized !== "..";
}

export function dataRootPathForAsset(assetPath: string) {
  if (path.isAbsolute(assetPath)) {
    const resolvedPath = path.resolve(assetPath);

    if (!isPathInside(resolvedPath, dataRoot)) {
      throw new Error(`Invalid data asset path: ${assetPath}`);
    }

    return resolvedPath;
  }

  if (!isDataAssetPath(assetPath)) {
    throw new Error(`Invalid data asset path: ${assetPath}`);
  }

  return path.join(dataRoot, assetPath);
}

export function cropRootPathForAsset(assetPath: string) {
  const resolvedPath = dataRootPathForAsset(assetPath);

  if (!isPathInside(resolvedPath, cropsRoot)) {
    throw new Error(`Asset path is outside the crop asset directory: ${assetPath}`);
  }

  return resolvedPath;
}

export function assetPathFromDataRoot(absolutePath: string) {
  const relative = path.relative(dataRoot, absolutePath).replaceAll(path.sep, "/");

  if (!isDataAssetPath(relative)) {
    throw new Error(`Path is not inside APP_DATA_DIR: ${absolutePath}`);
  }

  return relative;
}
