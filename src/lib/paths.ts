import { mkdir } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

export const dataRoot = path.resolve(env.APP_DATA_DIR);
export const sourcesRoot = path.join(dataRoot, "sources");
export const rendersRoot = path.join(dataRoot, "renders");
export const cropsRoot = path.join(dataRoot, "crops");
export const logsRoot = path.join(dataRoot, "logs");

export async function ensureDataDirs() {
  for (const dir of [dataRoot, sourcesRoot, rendersRoot, cropsRoot, logsRoot]) {
    await mkdir(dir, { recursive: true });
  }
}
