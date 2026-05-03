import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { sourcesRoot } from "@/lib/paths";

const PDF_SIGNATURE = "%PDF-";

export function getPaperDir(year: number) {
  return path.join(
    sourcesRoot,
    "pmt",
    "aqa",
    "combined-science-trilogy",
    "physics",
    "paper-1",
    "higher",
    String(year),
  );
}

export function getPaperDirForAdapter(adapterKey: string, year: number) {
  return path.join(sourcesRoot, "pmt", adapterKey, String(year));
}

export async function downloadPdf(url: string, destination: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed PDF download ${url}: ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? null;
  const pdfBytes = Buffer.from(await response.arrayBuffer());

  if (pdfBytes.subarray(0, PDF_SIGNATURE.length).toString("ascii") !== PDF_SIGNATURE) {
    throw new Error(
      `Invalid PDF download ${url}: expected PDF signature${contentType ? `, received ${contentType}` : ""}`,
    );
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, pdfBytes);
}
