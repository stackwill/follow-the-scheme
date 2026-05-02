import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { rendersRoot } from "@/lib/paths";

const POPPLER_DPI = 144;

class PopplerUnavailableError extends Error {
  readonly name = "PopplerUnavailableError";
}

async function runCommand(command: string, args: string[]) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new PopplerUnavailableError(`${command} is unavailable`));
        return;
      }

      reject(error);
    });
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}\n${Buffer.concat(stderrChunks).toString("utf8")}`,
    );
  }

  return Buffer.concat(stdoutChunks).toString("utf8");
}

async function getPdfPageCount(filePath: string) {
  const pdfInfoOutput = await runCommand("pdfinfo", [filePath]);
  const pagesMatch = pdfInfoOutput.match(/^Pages:\s+(\d+)$/m);

  if (!pagesMatch) {
    throw new Error(`Unable to parse page count from pdfinfo output for ${filePath}`);
  }

  return Number(pagesMatch[1]);
}

async function renderPdfPagesWithPoppler(filePath: string, outputDir: string) {
  const pageCount = await getPdfPageCount(filePath);
  const outputPrefix = path.join(outputDir, "page");

  await runCommand("pdftoppm", [
    "-r",
    String(POPPLER_DPI),
    "-png",
    filePath,
    outputPrefix,
  ]);

  const outputFiles = await readdir(outputDir);
  const pagePaths = outputFiles
    .map((fileName) => {
      const match = fileName.match(/^page-(\d+)\.png$/);

      if (!match) {
        return null;
      }

      return {
        pageNumber: Number(match[1]),
        pagePath: path.join(outputDir, fileName),
      };
    })
    .filter((entry): entry is { pageNumber: number; pagePath: string } => entry !== null)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((entry) => entry.pagePath);

  if (pagePaths.length !== pageCount) {
    throw new Error(
      `Poppler rendered ${pagePaths.length} pages for ${filePath}, expected ${pageCount}`,
    );
  }

  return pagePaths;
}

async function renderPdfPagesWithPdfJs(filePath: string, outputDir: string) {
  const loadingTask = getDocument(filePath);

  try {
    const pdf = await loadingTask.promise;
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

    await pdf.cleanup();
    return pagePaths;
  } finally {
    await loadingTask.destroy();
  }
}

export async function renderPdfPages(filePath: string, slug: string) {
  const outputDir = path.join(rendersRoot, slug);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  try {
    return await renderPdfPagesWithPoppler(filePath, outputDir);
  } catch (error) {
    if (error instanceof PopplerUnavailableError) {
      return renderPdfPagesWithPdfJs(filePath, outputDir);
    }

    throw error;
  }
}
