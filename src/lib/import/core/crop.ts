import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export async function cropRegion(
  inputPath: string,
  outputPath: string,
  box: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath).extract(box).png().toFile(outputPath);
}
