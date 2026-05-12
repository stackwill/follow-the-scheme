import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

import { cropRootPathForAsset } from "@/lib/assets/paths";
import { db } from "@/lib/db";
import { detectPaperOnlyQuestion, detectSelectionQuestion } from "@/lib/grading/schema";
import { dataRoot } from "@/lib/paths";
import { uniqueQuestionGroups } from "@/lib/questions/groups";

type CliOptions = {
  subject?: string;
  adapter?: string;
  year?: number;
  outDir?: string;
  limit?: number;
};

type PreviewAnswerKind = "paper-only" | "single-choice" | "text";

type PreviewImage = {
  label: string;
  assetPath: string;
  filePath: string;
  fileUrl: string;
  width: number;
  height: number;
};

type PreviewQuestion = {
  id: string;
  questionKey: string;
  maxMarks: number;
  primaryImage: PreviewImage;
  continuationImages: PreviewImage[];
  answerKind: PreviewAnswerKind;
  paperOnlyReason: string | null;
  selectionOptions: string[];
  warnings: string[];
};

type PreviewGroup = {
  slug: string;
  pageFile: string;
  screenshotFile: string;
  paper: {
    id: string;
    title: string;
    adapterKey: string;
    subject: string;
    year: number;
    sessionLabel: string;
  };
  groupKey: string;
  questions: PreviewQuestion[];
  expectedViewportHeight: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--subject" && next) {
      options.subject = next;
      index += 1;
    } else if (arg === "--adapter" && next) {
      options.adapter = next;
      index += 1;
    } else if (arg === "--year" && next) {
      options.year = Number(next);
      index += 1;
    } else if (arg === "--out" && next) {
      options.outDir = next;
      index += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelpAndExit();
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  return options;
}

function printHelpAndExit(): never {
  console.log(`Usage: bun run tools/crop-preview/generate.ts [filters]

Filters:
  --subject Chemistry
  --adapter aqa-combined-science-chemistry-paper-1-higher
  --year 2024
  --limit 10
  --out data/crop-previews/my-run
`);
  process.exit(0);
}

function nowStamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseSupportingAssetPaths(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === "string")) {
      return parsed;
    }
  } catch {
    return [];
  }

  return [];
}

async function commandOutput(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const exitCode = await new Promise<number>((resolve) => {
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    return null;
  }

  return Buffer.concat(chunks).toString("utf8").trim();
}

async function findChromium() {
  const fromEnv = process.env.CROP_PREVIEW_CHROMIUM;

  if (fromEnv) {
    return fromEnv;
  }

  for (const command of ["chromium", "google-chrome", "chrome", "chromium-browser"]) {
    const resolved = await commandOutput("sh", ["-c", `command -v ${command}`]);

    if (resolved) {
      return resolved;
    }
  }

  throw new Error("Could not find Chromium. Set CROP_PREVIEW_CHROMIUM=/path/to/chrome.");
}

async function run(command: string, args: string[]) {
  const child = spawn(command, args, { stdio: "inherit" });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function buildPreviewImage(label: string, assetPath: string): Promise<PreviewImage> {
  const filePath = cropRootPathForAsset(assetPath);
  await stat(filePath);
  const metadata = await sharp(filePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read dimensions for ${assetPath}`);
  }

  return {
    label,
    assetPath,
    filePath,
    fileUrl: pathToFileURL(filePath).href,
    width: metadata.width,
    height: metadata.height,
  };
}

function expectedRenderedImageHeight(image: PreviewImage) {
  const renderedWidth = Math.min(980, image.width);

  return Math.ceil((image.height / image.width) * renderedWidth);
}

function expectedGroupViewportHeight(questions: PreviewQuestion[]) {
  const imageHeights = questions.reduce((sum, question) => {
    const images = [question.primaryImage, ...question.continuationImages];

    return sum + images.reduce((imageSum, image) => imageSum + expectedRenderedImageHeight(image), 0);
  }, 0);
  const answerUiHeight = questions.reduce((sum, question) => {
    if (question.answerKind === "single-choice") {
      return sum + 80 + question.selectionOptions.length * 56;
    }

    if (question.answerKind === "paper-only") {
      return sum + 130;
    }

    return sum + 230;
  }, 0);

  return Math.min(Math.max(1000, imageHeights + answerUiHeight + questions.length * 160 + 260), 12000);
}

function questionWarnings(input: {
  answerKind: PreviewQuestion["answerKind"];
  selectionOptions: string[];
}) {
  const warnings: string[] = [];

  if (input.answerKind === "single-choice" && input.selectionOptions.length > 4) {
    warnings.push(
      `Single-choice answer has ${input.selectionOptions.length} options; this often means the crop/text boundary included the next stem.`,
    );
  }

  return warnings;
}

async function loadPreviewGroups(options: CliOptions): Promise<PreviewGroup[]> {
  const papers = await db.paper.findMany({
    where: {
      subject: options.subject,
      adapterKey: options.adapter,
      year: options.year,
    },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ subject: "asc" }, { adapterKey: "asc" }, { year: "desc" }, { sessionLabel: "desc" }],
  });
  const groups: PreviewGroup[] = [];

  for (const paper of papers) {
    for (const group of uniqueQuestionGroups(paper, paper.questions)) {
      const questions: PreviewQuestion[] = [];

      for (const question of group.questions) {
        const paperOnlyQuestion = detectPaperOnlyQuestion({
          questionText: question.extractedQuestionText,
        });
        const selectionQuestion = paperOnlyQuestion
          ? null
          : detectSelectionQuestion({
              maxMarks: question.maxMarks,
              questionText: question.extractedQuestionText,
              markSchemeText: question.markSchemeText,
            });
        const primaryImage = await buildPreviewImage(`Question ${question.questionKey}`, question.primaryCropPath);
        const continuationImages = await Promise.all(
          parseSupportingAssetPaths(question.supportingAssetPaths).map((assetPath, index) =>
            buildPreviewImage(`Question ${question.questionKey} continuation ${index + 1}`, assetPath),
          ),
        );

        const answerKind = paperOnlyQuestion ? "paper-only" : selectionQuestion ? "single-choice" : "text";
        const selectionOptions = selectionQuestion?.options.map((option) => option.label) ?? [];

        questions.push({
          id: question.id,
          questionKey: question.questionKey,
          maxMarks: question.maxMarks,
          primaryImage,
          continuationImages,
          answerKind,
          paperOnlyReason: paperOnlyQuestion?.reason ?? null,
          selectionOptions,
          warnings: questionWarnings({
            answerKind,
            selectionOptions,
          }),
        });
      }

      const slug = slugify(`${paper.adapterKey}-${paper.year}-${group.key}`);

      groups.push({
        slug,
        pageFile: `pages/${slug}.html`,
        screenshotFile: `screenshots/${slug}.png`,
        paper: {
          id: paper.id,
          title: paper.title,
          adapterKey: paper.adapterKey,
          subject: paper.subject,
          year: paper.year,
          sessionLabel: paper.sessionLabel,
        },
        groupKey: group.key,
        questions,
        expectedViewportHeight: expectedGroupViewportHeight(questions),
      });
    }
  }

  return typeof options.limit === "number" ? groups.slice(0, options.limit) : groups;
}

function renderQuestion(question: PreviewQuestion) {
  const imageFigures = [question.primaryImage, ...question.continuationImages]
    .map(
      (image, index) => `
        <figure class="question-image-frame${index > 0 ? " question-image-frame--continuation" : ""}">
          <img src="${image.fileUrl}" alt="${escapeHtml(image.label)} crop" data-asset-path="${escapeHtml(image.assetPath)}" />
        </figure>
      `,
    )
    .join("");
  const answer =
    question.answerKind === "paper-only"
      ? `<div class="paper-only-callout"><strong>Write or draw this one on paper.</strong><p>${escapeHtml(question.paperOnlyReason ?? "Paper-only question.")}</p></div>`
      : question.answerKind === "single-choice"
        ? `<fieldset class="option-fieldset"><legend>Your answer</legend>${question.selectionOptions
            .map(
              (option) =>
                `<label class="option-choice"><input type="radio" disabled /><span>${escapeHtml(option)}</span></label>`,
            )
            .join("")}</fieldset>`
        : `<label class="field-stack answer-under-question"><span>Your answer</span><textarea rows="6" disabled></textarea></label>`;

  return `
    <section class="answer-part question-part-view">
      <div class="question-part-view__heading">
        <h3>Question ${escapeHtml(question.questionKey)}</h3>
        <span>${question.maxMarks} marks</span>
      </div>
      ${
        question.warnings.length > 0
          ? `<div class="preview-warning"><strong>Review warning</strong>${question.warnings
              .map((warning) => `<p>${escapeHtml(warning)}</p>`)
              .join("")}</div>`
          : ""
      }
      ${question.paperOnlyReason ? `<p class="paper-only-chip">${escapeHtml(question.paperOnlyReason)}</p>` : ""}
      ${imageFigures}
      ${answer}
    </section>
  `;
}

function renderGroupPage(group: PreviewGroup) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(group.paper.title)} - ${escapeHtml(group.groupKey)}</title>
    <link rel="stylesheet" href="../preview.css" />
  </head>
  <body>
    <main class="preview-shell">
      <header class="preview-header">
        <div>
          <p class="eyebrow">${escapeHtml(group.paper.adapterKey)} / ${group.paper.year}</p>
          <h1>${escapeHtml(group.paper.title)}</h1>
          <p>Question group ${escapeHtml(group.groupKey)}. Screenshot mirrors the real question-page crop stack and answer controls.</p>
        </div>
        <a href="../index.html">Index</a>
      </header>
      <div class="question-flow">
        ${group.questions.map(renderQuestion).join("")}
      </div>
    </main>
    <script>
      window.addEventListener("load", () => {
        const broken = [...document.images].filter((image) => !image.complete || image.naturalWidth === 0);
        if (broken.length > 0) {
          document.body.dataset.brokenImages = String(broken.length);
        }
      });
    </script>
  </body>
</html>
`;
}

function renderCss() {
  return `:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --panel: #ffffff;
  --panel-subtle: #f1f4f8;
  --line: #d8e1ee;
  --line-strong: #9aa8bd;
  --text: #1f2937;
  --muted: #667085;
  --accent: #2563eb;
  --danger: #b42318;
  --paper: #ffffff;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-feature-settings: "kern", "liga", "tnum";
}

.preview-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: start;
  margin-bottom: 18px;
}

.preview-header h1 {
  margin: 0;
  font-size: 1.65rem;
  line-height: 1.12;
  letter-spacing: 0;
}

.preview-header p {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.5;
}

.preview-header a {
  color: var(--accent);
  font-weight: 800;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
  white-space: nowrap;
}

.eyebrow {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.question-flow {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel);
  box-shadow: 0 18px 60px rgba(31, 41, 55, 0.08);
}

.question-part-view {
  display: grid;
  gap: 16px;
  padding: 24px 24px 30px;
}

.question-part-view + .question-part-view {
  border-top: 6px solid var(--panel-subtle);
  padding-top: 30px;
}

.question-part-view__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.question-part-view__heading h3 {
  margin: 0;
  color: var(--text);
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 0;
}

.question-part-view__heading span {
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 800;
}

.question-image-frame {
  overflow: hidden;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
}

.question-image-frame--continuation {
  margin-top: -8px;
}

.question-image-frame img {
  display: block;
  width: 100%;
  height: auto;
}

.paper-only-chip {
  width: fit-content;
  margin: 0;
  border-radius: 999px;
  background: #fff8e5;
  color: #936100;
  font-weight: 800;
  padding: 6px 10px;
}

.paper-only-callout {
  border: 1px solid #ffe39b;
  border-radius: 14px;
  background: #fff8e5;
  padding: 14px;
}

.paper-only-callout p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.5;
}

.preview-warning {
  border: 1px solid #f7c566;
  border-radius: 10px;
  background: #fff8e5;
  color: #664400;
  padding: 10px 12px;
}

.preview-warning strong {
  display: block;
  margin-bottom: 4px;
}

.preview-warning p {
  margin: 0;
  line-height: 1.45;
}

.preview-warning code {
  border-radius: 4px;
  background: rgba(102, 68, 0, 0.1);
  font-size: 0.86em;
  padding: 2px 4px;
}

.field-stack,
.option-fieldset {
  display: grid;
  gap: 8px;
}

.field-stack span,
.option-fieldset legend {
  color: var(--text);
  font-size: 1.05rem;
  font-weight: 800;
}

.field-stack textarea {
  width: 100%;
  min-height: 170px;
  resize: vertical;
  border: 2px solid var(--line);
  border-radius: 14px;
  background: var(--panel);
  color: var(--text);
  padding: 15px;
}

.option-fieldset {
  margin: 0;
  border: 0;
  padding: 0;
}

.option-choice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: start;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.review-index {
  display: grid;
  gap: 12px;
  margin-top: 20px;
}

.review-index a {
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  color: inherit;
  padding: 14px;
  text-decoration: none;
}

.review-index strong { font-size: 1rem; }
.review-index span { color: var(--muted); font-size: 0.92rem; }
`;
}

function renderIndex(groups: PreviewGroup[], options: CliOptions) {
  const warningCount = groups.reduce(
    (sum, group) => sum + group.questions.reduce((groupSum, question) => groupSum + question.warnings.length, 0),
    0,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Crop Preview Run</title>
    <link rel="stylesheet" href="./preview.css" />
  </head>
  <body>
    <main class="preview-shell">
      <header class="preview-header">
        <div>
          <p class="eyebrow">Crop preview run</p>
          <h1>${groups.length} question groups</h1>
          <p>Filters: subject=${escapeHtml(options.subject ?? "any")}, adapter=${escapeHtml(options.adapter ?? "any")}, year=${escapeHtml(String(options.year ?? "any"))}</p>
          <p>${warningCount} automated review warning${warningCount === 1 ? "" : "s"}.</p>
        </div>
      </header>
      <section class="review-index">
        ${groups
          .map(
            (group) => `<a href="./${group.pageFile}">
              <strong>${escapeHtml(group.paper.title)} / group ${escapeHtml(group.groupKey)}</strong>
              <span>${escapeHtml(group.paper.adapterKey)} / ${group.paper.year} / ${group.questions.length} question part(s)</span>
              ${
                group.questions.some((question) => question.warnings.length > 0)
                  ? `<span>${group.questions
                      .filter((question) => question.warnings.length > 0)
                      .map((question) => `Warning on ${question.questionKey}`)
                      .join(", ")}</span>`
                  : ""
              }
              <span>Screenshot: ${escapeHtml(group.screenshotFile)}</span>
            </a>`,
          )
          .join("")}
      </section>
    </main>
  </body>
</html>
`;
}

async function writePreviewRun(groups: PreviewGroup[], outDir: string, options: CliOptions) {
  await mkdir(path.join(outDir, "pages"), { recursive: true });
  await mkdir(path.join(outDir, "screenshots"), { recursive: true });
  await writeFile(path.join(outDir, "preview.css"), renderCss(), "utf8");

  for (const group of groups) {
    await writeFile(path.join(outDir, group.pageFile), renderGroupPage(group), "utf8");
  }

  await writeFile(path.join(outDir, "index.html"), renderIndex(groups, options), "utf8");
  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        filters: options,
        groupCount: groups.length,
        groups: groups.map((group) => ({
          slug: group.slug,
          pageFile: group.pageFile,
          screenshotFile: group.screenshotFile,
          paper: group.paper,
          groupKey: group.groupKey,
          questions: group.questions.map((question) => ({
            id: question.id,
            questionKey: question.questionKey,
            maxMarks: question.maxMarks,
            answerKind: question.answerKind,
            primaryAssetPath: question.primaryImage.assetPath,
            continuationAssetPaths: question.continuationImages.map((image) => image.assetPath),
            selectionOptions: question.selectionOptions,
            warnings: question.warnings,
          })),
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function captureScreenshots(groups: PreviewGroup[], outDir: string) {
  const chromium = await findChromium();

  for (const group of groups) {
    const pageUrl = pathToFileURL(path.join(outDir, group.pageFile)).href;
    const screenshotPath = path.join(outDir, group.screenshotFile);
    const viewportHeight = String(group.expectedViewportHeight);

    await run(chromium, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      `--screenshot=${screenshotPath}`,
      `--window-size=1280,${viewportHeight}`,
      pageUrl,
    ]);
  }
}

const options = parseArgs(process.argv.slice(2));
const outDir = path.resolve(options.outDir ?? path.join(dataRoot, "crop-previews", nowStamp()));
const groups = await loadPreviewGroups(options);

if (groups.length === 0) {
  throw new Error("No matching imported question groups found.");
}

await writePreviewRun(groups, outDir, options);
await captureScreenshots(groups, outDir);
await db.$disconnect();

console.log(`Generated ${groups.length} crop preview screenshots.`);
console.log(`Open ${path.join(outDir, "index.html")}`);
