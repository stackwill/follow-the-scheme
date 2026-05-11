import { writeFile } from "node:fs/promises";

import { buildAttemptExport } from "@/lib/attempts/attempt-transfer";
import { db } from "@/lib/db";

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error("Usage: bun run scripts/export-attempts.ts <output.json>");
}

const attempts = await db.attempt.findMany({
  include: {
    paper: {
      select: {
        adapterKey: true,
        year: true,
        sessionLabel: true,
        paperNumber: true,
        tier: true,
      },
    },
    answers: {
      include: {
        question: {
          select: {
            questionKey: true,
          },
        },
      },
    },
  },
});

await writeFile(outputPath, `${JSON.stringify(buildAttemptExport(attempts), null, 2)}\n`, "utf8");

await db.$disconnect();
