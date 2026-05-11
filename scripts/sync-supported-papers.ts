import { db } from "@/lib/db";
import { importAllSupportedPapers } from "@/lib/import/core/import-supported";

const results = await importAllSupportedPapers();

for (const result of results) {
  console.log(
    `Synced paper ${result.paperId}: ${result.questionCount} questions, ${result.totalMarks} marks`,
  );
}

await db.$disconnect();
