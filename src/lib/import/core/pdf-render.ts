import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { rendersRoot } from "@/lib/paths";

export async function renderPdfPages(filePath: string, slug: string) {
  const outputDir = path.join(rendersRoot, slug);
  await mkdir(outputDir, { recursive: true });

  const pdf = await getDocument(filePath).promise;
  const pagePaths: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page
      .render({
        canvas: canvas as never,
        canvasContext: context as never,
        viewport,
      })
      .promise;

    const pagePath = path.join(outputDir, `page-${pageNumber}.png`);
    await writeFile(pagePath, canvas.toBuffer("image/png"));
    pagePaths.push(pagePath);
  }

  return pagePaths;
}
