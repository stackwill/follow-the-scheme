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
  await sharp(inputPath).extract(box).png().toFile(outputPath);
}
