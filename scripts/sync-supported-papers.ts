import { db } from "@/lib/db";
import { importAllSupportedBenchmarkPapers } from "@/lib/import/core/import-paper";

const results = await importAllSupportedBenchmarkPapers();

for (const result of results) {
  console.log(
    `Synced paper ${result.paperId}: ${result.questionCount} questions, ${result.totalMarks} marks`,
  );
}

await db.$disconnect();
