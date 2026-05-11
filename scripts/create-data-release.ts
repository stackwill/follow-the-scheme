import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildDataReleaseManifest } from "@/lib/data-release/manifest";
import { db } from "@/lib/db";
import { cropsRoot, dataRoot } from "@/lib/paths";
import { isDataAssetPath } from "@/lib/assets/paths";

async function run(command: string, args: string[]) {
  const child = spawn(command, args, {
    stdio: "inherit",
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function sha256(filePath: string) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

async function countFiles(dir: string): Promise<number> {
  let total = 0;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      total += await countFiles(entryPath);
    } else if (entry.isFile()) {
      total += 1;
    }
  }

  return total;
}

function requireRelativeDataAsset(assetPath: string, label: string) {
  if (!isDataAssetPath(assetPath)) {
    throw new Error(`${label} must be relative to APP_DATA_DIR before creating a data release: ${assetPath}`);
  }
}

async function validatePortableAssetPaths() {
  const papers = await db.paper.findMany({
    select: {
      id: true,
      questionPaperAssetPath: true,
      markSchemeAssetPath: true,
    },
  });

  for (const paper of papers) {
    requireRelativeDataAsset(paper.questionPaperAssetPath, `Paper ${paper.id} questionPaperAssetPath`);
    requireRelativeDataAsset(paper.markSchemeAssetPath, `Paper ${paper.id} markSchemeAssetPath`);
  }

  const questions = await db.question.findMany({
    select: {
      id: true,
      primaryCropPath: true,
      supportingAssetPaths: true,
    },
  });

  for (const question of questions) {
    requireRelativeDataAsset(question.primaryCropPath, `Question ${question.id} primaryCropPath`);

    for (const [index, assetPath] of (JSON.parse(question.supportingAssetPaths) as string[]).entries()) {
      requireRelativeDataAsset(assetPath, `Question ${question.id} supportingAssetPaths[${index}]`);
    }
  }

  return {
    paperCount: papers.length,
    questionCount: questions.length,
  };
}

async function gitCommit() {
  const child = spawn("git", ["rev-parse", "HEAD"], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    return "unknown";
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

const appDbPath = path.join(dataRoot, "app.db");
const releaseName =
  process.argv[2] ??
  `data-${new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[:]/g, "")}`;
const releasesRoot = path.join(dataRoot, "releases");
const releaseDir = path.join(releasesRoot, releaseName);
const releaseDbPath = path.join(releaseDir, "app.db");
const releaseTarballPath = path.join(releasesRoot, `${releaseName}.tar.gz`);
const releaseShaPath = `${releaseTarballPath}.sha256`;

await stat(appDbPath);
await stat(path.join(cropsRoot, "imports"));

const { paperCount, questionCount } = await validatePortableAssetPaths();
const cropFileCount = await countFiles(cropsRoot);

if (cropFileCount === 0) {
  throw new Error("Refusing to create a data release with no crop files.");
}

await rm(releaseDir, { recursive: true, force: true });
await rm(releaseTarballPath, { force: true });
await rm(releaseShaPath, { force: true });
await mkdir(releaseDir, { recursive: true });

await cp(appDbPath, releaseDbPath);
await cp(cropsRoot, path.join(releaseDir, "crops"), { recursive: true });

await run("sqlite3", [
  releaseDbPath,
  "PRAGMA foreign_keys = ON; DELETE FROM QuestionAttempt; DELETE FROM Attempt; VACUUM;",
]);

const manifest = buildDataReleaseManifest({
  releaseName,
  gitCommit: await gitCommit(),
  appDbSha256: await sha256(releaseDbPath),
  cropFileCount,
  paperCount,
  questionCount,
});

await writeFile(path.join(releaseDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

await run("tar", ["-czf", releaseTarballPath, "-C", releaseDir, "."]);
await writeFile(releaseShaPath, `${await sha256(releaseTarballPath)}  ${path.basename(releaseTarballPath)}\n`, "utf8");

console.log(`Created ${releaseTarballPath}`);
console.log(`Created ${releaseShaPath}`);

await db.$disconnect();
