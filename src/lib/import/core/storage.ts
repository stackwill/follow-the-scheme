import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { sourcesRoot } from "@/lib/paths";

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

export async function downloadPdf(url: string, destination: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed PDF download ${url}: ${response.status}`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
