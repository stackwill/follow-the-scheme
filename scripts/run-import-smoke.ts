import { spawn } from "node:child_process";

import { env } from "@/lib/env";
import { importAqaPhysicsPaper1HigherBenchmark } from "@/lib/import/core/import-paper";

const dbPushExitCode = await new Promise<number>((resolve, reject) => {
  const dbPush = spawn("bunx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: env.DATABASE_URL,
      APP_DATA_DIR: env.APP_DATA_DIR,
    },
    stdio: "inherit",
  });

  dbPush.once("error", reject);
  dbPush.once("exit", (code) => resolve(code ?? 1));
});

if (dbPushExitCode !== 0) {
  throw new Error("Failed to apply Prisma schema before smoke import");
}

const results = await Promise.all([
  importAqaPhysicsPaper1HigherBenchmark(2023),
  importAqaPhysicsPaper1HigherBenchmark(2024),
]);

for (const result of results) {
  console.log(
    `Imported paper ${result.paperId} from source ${result.sourceId} with ${result.questionCount} questions`,
  );
}
