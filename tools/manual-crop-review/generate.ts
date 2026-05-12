import { mkdir, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { cropRootPathForAsset } from "@/lib/assets/paths";
import { db } from "@/lib/db";
import { dataRoot, rendersRoot } from "@/lib/paths";

const RENDER_SCALE = 2;

type CliOptions = {
  subject?: string;
  adapters?: string[];
  years?: number[];
  paperFilters?: Array<{ adapterKey: string; year: number }>;
  outDir?: string;
};

type ImageAsset = {
  src: string;
  width: number;
  height: number;
};

type PdfBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type SupportingPdfBox = PdfBox & {
  pageNumber: number;
};

type BoundingBoxes = {
  primaryPdfBox?: PdfBox;
  supportingPdfBoxes?: SupportingPdfBox[];
};

type ReviewCrop = {
  questionKey: string;
  maxMarks: number;
  assetPath: string;
  image: ImageAsset;
  label: string;
  responseFlag: "choice-box" | null;
  pageNumber: number;
  displayOrder: number;
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
};

type ReviewPage = {
  pageNumber: number;
  originalPage: ImageAsset;
  crops: ReviewCrop[];
};

type ReviewPaper = {
  slug: string;
  pageFile: string;
  title: string;
  subject: string;
  adapterKey: string;
  year: number;
  sessionLabel: string;
  pages: ReviewPage[];
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
      options.adapters = [...(options.adapters ?? []), next];
      index += 1;
    } else if (arg === "--year" && next) {
      options.years = [...(options.years ?? []), Number(next)];
      index += 1;
    } else if (arg === "--paper" && next) {
      const separatorIndex = next.lastIndexOf(":");

      if (separatorIndex <= 0 || separatorIndex === next.length - 1) {
        throw new Error(`Invalid --paper filter. Expected adapter-key:year, received: ${next}`);
      }

      const adapterKey = next.slice(0, separatorIndex);
      const year = Number(next.slice(separatorIndex + 1));

      if (!Number.isInteger(year)) {
        throw new Error(`Invalid --paper year. Expected adapter-key:year, received: ${next}`);
      }

      options.paperFilters = [...(options.paperFilters ?? []), { adapterKey, year }];
      index += 1;
    } else if (arg === "--out" && next) {
      options.outDir = next;
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
  console.log(`Usage: bun run tools/manual-crop-review/generate.ts [filters]

Filters:
  --subject Chemistry
  --adapter aqa-combined-science-chemistry-paper-1-higher
  --adapter adapter-one --adapter adapter-two
  --year 2024
  --year 2023 --year 2024
  --paper adapter-key:2024
  --out data/manual-crop-review/chemistry
`);
  process.exit(0);
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

function nowStamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replaceAll(":", "");
}

function parseStringArray(value: string) {
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

function parseBoundingBoxes(value: string): BoundingBoxes {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (parsed && typeof parsed === "object") {
      return parsed as BoundingBoxes;
    }
  } catch {
    return {};
  }

  return {};
}

async function imageDimensions(filePath: string) {
  const metadata = await sharp(filePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read image dimensions: ${filePath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

async function linkAsset(outDir: string, sourcePath: string, relativePath: string): Promise<ImageAsset> {
  await stat(sourcePath);
  const outputPath = path.join(outDir, relativePath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });
  await symlink(sourcePath, outputPath);

  return {
    src: `../${relativePath.replaceAll(path.sep, "/")}`,
    ...(await imageDimensions(sourcePath)),
  };
}

async function existingRenderPages(adapterKey: string, year: number) {
  const renderDir = path.join(rendersRoot, `${adapterKey}-${year}`);
  const files = await readdir(renderDir);

  return files
    .map((fileName) => {
      const match = fileName.match(/^page-(\d+)\.png$/);

      if (!match) {
        return null;
      }

      return {
        pageNumber: Number(match[1]),
        filePath: path.join(renderDir, fileName),
      };
    })
    .filter((entry): entry is { pageNumber: number; filePath: string } => entry !== null)
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

function cropPlacement(pdfBox: PdfBox, page: ImageAsset) {
  const left = Math.max(0, pdfBox.left * RENDER_SCALE);
  const right = Math.min(page.width, pdfBox.right * RENDER_SCALE);
  const top = Math.max(0, page.height - pdfBox.top * RENDER_SCALE);

  return {
    leftPercent: (left / page.width) * 100,
    topPercent: (top / page.height) * 100,
    widthPercent: ((right - left) / page.width) * 100,
  };
}

function detectChoiceBoxResponse(text: string) {
  return [
    /\blozenge\b/i,
    /\bcross\s+in\s+a\s+box\b/i,
    /\bnew\s+answer\s+with\s+a\s+cross\b/i,
    /\btick\s+(?:one|the|a)\s+box\b/i,
    /\bput\s+a\s+tick\b/i,
    /\bplace\s+a\s+tick\b/i,
    /\bmark\s+(?:one|the|a)\s+box\b/i,
    /\bshade\s+(?:one|the|a)\b/i,
    /\bmore\s+than\s+one\s+(?:box|lozenge)\b/i,
    /(?:^|\n)\s*A\s+\S[\s\S]*\n\s*B\s+\S[\s\S]*\n\s*C\s+\S[\s\S]*\n\s*D\s+\S/im,
  ].some((pattern) => pattern.test(text));
}

async function loadReviewPapers(options: CliOptions, outDir: string): Promise<ReviewPaper[]> {
  const papers = await db.paper.findMany({
    where: {
      subject: options.subject,
      adapterKey: options.paperFilters ? undefined : options.adapters ? { in: options.adapters } : undefined,
      year: options.paperFilters ? undefined : options.years ? { in: options.years } : undefined,
      OR: options.paperFilters?.map((filter) => ({
        adapterKey: filter.adapterKey,
        year: filter.year,
      })),
    },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ subject: "asc" }, { adapterKey: "asc" }, { year: "desc" }, { sessionLabel: "desc" }],
  });
  const reviewPapers: ReviewPaper[] = [];

  for (const paper of papers) {
    const slug = slugify(`${paper.adapterKey}-${paper.year}`);
    const renderPages = await Promise.all(
      (await existingRenderPages(paper.adapterKey, paper.year)).map(async (page) => ({
        pageNumber: page.pageNumber,
        originalPage: await linkAsset(outDir, page.filePath, `assets/${slug}/pages/page-${page.pageNumber}.png`),
      })),
    );
    const renderPageByNumber = new Map(renderPages.map((page) => [page.pageNumber, page.originalPage]));
    const cropsByPage = new Map<number, ReviewCrop[]>();

    for (const question of paper.questions) {
      const boundingBoxes = parseBoundingBoxes(question.boundingBoxes);
      const primaryPage = renderPageByNumber.get(question.pageStart);
      const primaryPdfBox = boundingBoxes.primaryPdfBox;

      if (!primaryPage || !primaryPdfBox) {
        continue;
      }

      const primaryImage = await linkAsset(
        outDir,
        cropRootPathForAsset(question.primaryCropPath),
        `assets/${slug}/crops/${question.questionKey.replace(/\./g, "-")}.png`,
      );
      const responseFlag = detectChoiceBoxResponse(`${question.extractedQuestionText}\n${question.markSchemeText}`)
        ? "choice-box"
        : null;
      const primaryCrop: ReviewCrop = {
        questionKey: question.questionKey,
        maxMarks: question.maxMarks,
        assetPath: question.primaryCropPath,
        image: primaryImage,
        label: `Question ${question.questionKey}`,
        responseFlag,
        pageNumber: question.pageStart,
        displayOrder: question.displayOrder,
        ...cropPlacement(primaryPdfBox, primaryPage),
      };

      cropsByPage.set(question.pageStart, [...(cropsByPage.get(question.pageStart) ?? []), primaryCrop]);

      const supportingAssetPaths = parseStringArray(question.supportingAssetPaths);
      const supportingBoxes = boundingBoxes.supportingPdfBoxes ?? [];

      for (const [index, assetPath] of supportingAssetPaths.entries()) {
        const supportingBox = supportingBoxes[index];

        if (!supportingBox) {
          continue;
        }

        const pageNumber = supportingBox.pageNumber;
        const supportingPage = renderPageByNumber.get(pageNumber);

        if (!supportingPage) {
          continue;
        }

        const supportingImage = await linkAsset(
          outDir,
          cropRootPathForAsset(assetPath),
          `assets/${slug}/crops/${question.questionKey.replace(/\./g, "-")}-page-${pageNumber}.png`,
        );
        const supportingCrop: ReviewCrop = {
          questionKey: question.questionKey,
          maxMarks: question.maxMarks,
          assetPath,
          image: supportingImage,
          label: `Question ${question.questionKey} continuation`,
          responseFlag,
          pageNumber,
          displayOrder: question.displayOrder + (index + 1) / 10,
          ...cropPlacement(supportingBox, supportingPage),
        };

        cropsByPage.set(pageNumber, [...(cropsByPage.get(pageNumber) ?? []), supportingCrop]);
      }
    }

    const pages = renderPages.map((page) => ({
      pageNumber: page.pageNumber,
      originalPage: page.originalPage,
      crops: (cropsByPage.get(page.pageNumber) ?? []).sort((left, right) => left.displayOrder - right.displayOrder),
    }));

    reviewPapers.push({
      slug,
      pageFile: `papers/${slug}.html`,
      title: paper.title,
      subject: paper.subject,
      adapterKey: paper.adapterKey,
      year: paper.year,
      sessionLabel: paper.sessionLabel,
      pages,
    });
  }

  return reviewPapers;
}

function renderCss() {
  return `:root {
  color-scheme: light;
  --bg: #edf1f5;
  --panel: #ffffff;
  --ink: #182230;
  --muted: #667085;
  --line: #d7dee8;
  --accent: #1d4ed8;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.shell {
  width: min(1920px, calc(100% - 24px));
  margin: 0 auto;
  padding: 14px 0 28px;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  background: rgba(237, 241, 245, 0.96);
  padding: 12px 0;
}

.topbar h1 {
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 0;
}

.topbar p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.topbar__right {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 10px;
  align-items: center;
}

.approval {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 8px;
  align-items: center;
}

.approval button {
  appearance: none;
  border: 1px solid #16a34a;
  border-radius: 8px;
  background: #16a34a;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 850;
  padding: 8px 12px;
}

.approval button[data-approved="true"] {
  border-color: #14532d;
  background: #14532d;
}

.approval-status {
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

.topbar a,
.paper-index a {
  color: var(--accent);
  font-weight: 750;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.paper-index {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.paper-index a {
  display: grid;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: inherit;
  padding: 14px;
  text-decoration: none;
}

.paper-index a[data-approved="true"] {
  display: none;
}

.paper-index span {
  color: var(--muted);
  font-size: 0.92rem;
}

.paper-index-empty {
  display: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--muted);
  margin-top: 18px;
  padding: 16px;
}

body[data-all-approved="true"] .paper-index-empty {
  display: block;
}

.spread {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  margin-top: 14px;
}

.column-title {
  position: sticky;
  top: 63px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 800;
  margin-bottom: 10px;
  padding: 8px 10px;
  text-transform: uppercase;
}

.page-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  margin-bottom: 14px;
}

.crop-page,
.paper-page {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #ffffff;
}

.crop-page {
  background:
    linear-gradient(to bottom, rgba(29, 78, 216, 0.05), rgba(29, 78, 216, 0.05)),
    #ffffff;
}

.crop-page__label,
.paper-page__label {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  border-radius: 999px;
  background: rgba(24, 34, 48, 0.72);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 850;
  padding: 4px 8px;
}

.paper-page img {
  display: block;
  width: 100%;
  height: auto;
}

.placed-crop {
  position: absolute;
  z-index: 2;
  min-width: 160px;
  border: 2px solid #1d4ed8;
  border-radius: 4px;
  background: #ffffff;
  box-shadow: 0 4px 18px rgba(29, 78, 216, 0.16);
}

.placed-crop__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1.1;
  padding: 4px 6px;
}

.placed-crop[data-response-flag="choice-box"] {
  border-color: #dc2626;
  box-shadow: 0 4px 18px rgba(220, 38, 38, 0.2);
}

.placed-crop[data-response-flag="choice-box"] .placed-crop__meta {
  background: #dc2626;
}

.placed-crop img {
  display: block;
  width: 100%;
  height: auto;
}

@media (max-width: 900px) {
  .spread,
  .page-pair {
    grid-template-columns: 1fr;
  }

  .column-title {
    position: static;
  }
}
`;
}

function paperApprovalKey(paper: ReviewPaper) {
  return `${paper.adapterKey}:${paper.year}`;
}

function renderApprovalControls(paper: ReviewPaper) {
  return `<div class="approval" data-paper-key="${escapeHtml(paperApprovalKey(paper))}">
    <button type="button" data-approve-button>Mark paper checked</button>
    <span class="approval-status" data-approval-status>Not approved yet</span>
  </div>`;
}

function renderApprovalScript() {
  return `<script>
(() => {
  const approval = document.querySelector("[data-paper-key]");
  if (!approval) return;

  const key = "manual-crop-review:paper-approved:" + approval.dataset.paperKey;
  const button = approval.querySelector("[data-approve-button]");
  const status = approval.querySelector("[data-approval-status]");

  function render() {
    const approved = localStorage.getItem(key);

    if (!approved) {
      button.textContent = "Mark paper checked";
      button.dataset.approved = "false";
      status.textContent = "Still in staging";
      return;
    }

    const parsed = JSON.parse(approved);
    button.textContent = "Paper checked";
    button.dataset.approved = "true";
    status.textContent = "Checked " + new Date(parsed.approvedAt).toLocaleString();
  }

  button.addEventListener("click", () => {
    localStorage.setItem(key, JSON.stringify({ approvedAt: new Date().toISOString() }));
    render();
  });

  render();
})();
</script>`;
}

function renderIndexScript() {
  return `<script>
(() => {
  const cards = [...document.querySelectorAll("[data-paper-card][data-paper-key]")];
  const checkedCount = document.querySelector("[data-checked-count]");
  const remainingCount = document.querySelector("[data-remaining-count]");

  function render() {
    let checked = 0;

    for (const card of cards) {
      const key = "manual-crop-review:paper-approved:" + card.dataset.paperKey;
      const approved = localStorage.getItem(key);
      card.dataset.approved = approved ? "true" : "false";
      if (approved) checked += 1;
    }

    if (checkedCount) checkedCount.textContent = String(checked);
    if (remainingCount) remainingCount.textContent = String(cards.length - checked);
    document.body.dataset.allApproved = String(cards.length > 0 && checked === cards.length);
  }

  render();
})();
</script>`;
}

function renderCrop(crop: ReviewCrop) {
  const widthPercent = Math.max(20, Math.min(100 - crop.leftPercent, crop.widthPercent));
  const responseFlagAttribute = crop.responseFlag ? ` data-response-flag="${crop.responseFlag}"` : "";

  return `<article class="placed-crop"${responseFlagAttribute} style="left:${crop.leftPercent.toFixed(3)}%; top:${crop.topPercent.toFixed(3)}%; width:${widthPercent.toFixed(3)}%;" id="question-${escapeHtml(crop.questionKey.replace(/\./g, "-"))}">
    <div class="placed-crop__meta">
      <span>${escapeHtml(crop.label)}</span>
      <span>${crop.maxMarks}m</span>
    </div>
    <img src="${crop.image.src}" alt="${escapeHtml(crop.label)} crop" data-asset-path="${escapeHtml(crop.assetPath)}" />
  </article>`;
}

function renderPagePair(page: ReviewPage) {
  const aspectRatio = `${page.originalPage.width} / ${page.originalPage.height}`;

  return `<section class="page-pair" id="page-${page.pageNumber}">
    <div class="crop-page" style="aspect-ratio:${aspectRatio};">
      <span class="crop-page__label">Page ${page.pageNumber}</span>
      ${page.crops.map(renderCrop).join("")}
    </div>
    <figure class="paper-page">
      <span class="paper-page__label">Page ${page.pageNumber}</span>
      <img src="${page.originalPage.src}" alt="Original exam page ${page.pageNumber}" />
    </figure>
  </section>`;
}

function renderPaperPage(paper: ReviewPaper) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(paper.title)} manual crop review</title>
    <link rel="stylesheet" href="../review.css" />
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <h1>${escapeHtml(paper.title)}</h1>
          <p>${escapeHtml(paper.adapterKey)} / ${paper.year} / ${paper.pages.length} rendered pages</p>
        </div>
        <div class="topbar__right">
          ${renderApprovalControls(paper)}
          <a href="../index.html">All papers</a>
        </div>
      </header>
      <div class="spread">
        <div class="column-title"><span>Placed website crops</span><span>left</span></div>
        <div class="column-title"><span>Continuous original paper</span><span>right</span></div>
      </div>
      ${paper.pages.map(renderPagePair).join("")}
    </main>
    ${renderApprovalScript()}
  </body>
</html>
`;
}

function renderIndex(papers: ReviewPaper[], options: CliOptions) {
  const paperFilterText =
    options.paperFilters?.map((filter) => `${filter.adapterKey}:${filter.year}`).join(", ") ?? "any";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Manual crop review</title>
    <link rel="stylesheet" href="./review.css" />
  </head>
  <body>
    <main class="shell">
      <header class="topbar">
        <div>
          <h1>Manual crop review</h1>
          <p>Filters: subject=${escapeHtml(options.subject ?? "any")}, adapter=${escapeHtml(options.adapters?.join(", ") ?? "any")}, year=${escapeHtml(options.years?.join(", ") ?? "any")}, paper=${escapeHtml(paperFilterText)}</p>
          <p><span data-remaining-count>${papers.length}</span> paper(s) left in staging. <span data-checked-count>0</span> checked.</p>
        </div>
      </header>
      <section class="paper-index">
        ${papers
          .map(
            (paper) => `<a href="./${paper.pageFile}" data-paper-card data-paper-key="${escapeHtml(paperApprovalKey(paper))}">
              <strong>${escapeHtml(paper.title)}</strong>
              <span>${escapeHtml(paper.adapterKey)} / ${paper.year} / ${paper.pages.length} pages</span>
            </a>`,
          )
          .join("")}
      </section>
      <div class="paper-index-empty">All staged papers are checked. Tell Codex to continue when you want the data release created and deployed.</div>
    </main>
    ${renderIndexScript()}
  </body>
</html>
`;
}

async function writeReviewSite(papers: ReviewPaper[], outDir: string, options: CliOptions) {
  await mkdir(path.join(outDir, "papers"), { recursive: true });
  await writeFile(path.join(outDir, "review.css"), renderCss(), "utf8");

  for (const paper of papers) {
    await writeFile(path.join(outDir, paper.pageFile), renderPaperPage(paper), "utf8");
  }

  await writeFile(path.join(outDir, "index.html"), renderIndex(papers, options), "utf8");
  await writeFile(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        filters: options,
        paperCount: papers.length,
        papers: papers.map((paper) => ({
          slug: paper.slug,
          pageFile: paper.pageFile,
          title: paper.title,
          adapterKey: paper.adapterKey,
          year: paper.year,
          pageCount: paper.pages.length,
          cropCount: paper.pages.reduce((sum, page) => sum + page.crops.length, 0),
        })),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

const options = parseArgs(process.argv.slice(2));
const outDir = path.resolve(options.outDir ?? path.join(dataRoot, "manual-crop-review", nowStamp()));

await rm(outDir, { recursive: true, force: true });

const papers = await loadReviewPapers(options, outDir);

if (papers.length === 0) {
  throw new Error("No matching imported papers found.");
}

await writeReviewSite(papers, outDir, options);
await db.$disconnect();

console.log(`Generated manual crop review for ${papers.length} paper(s).`);
console.log(`Open ${path.join(outDir, "index.html")}`);
