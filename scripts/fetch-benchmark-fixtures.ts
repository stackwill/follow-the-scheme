import path from "node:path";

import { downloadPdf, getPaperDir } from "@/lib/import/core/storage";
import { discoverAqaPhysicsPaper1Higher } from "@/lib/import/pmt/discovery";
import { ensureDataDirs } from "@/lib/paths";

await ensureDataDirs();

const candidates = await discoverAqaPhysicsPaper1Higher();

for (const candidate of candidates) {
  const paperDir = getPaperDir(candidate.year);

  await downloadPdf(
    candidate.questionPaperUrl,
    path.join(paperDir, "question-paper.pdf"),
  );
  await downloadPdf(candidate.markSchemeUrl, path.join(paperDir, "mark-scheme.pdf"));
}
