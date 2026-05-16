import * as cheerio from "cheerio";

import { fetchHtml } from "@/lib/import/core/http";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";
import type { PmtPaperCandidate } from "@/lib/import/types";

const AQA_PHYSICS_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/";
const AQA_PHYSICS_PAPER_2_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-2/";
const AQA_BIOLOGY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-1/";
const AQA_BIOLOGY_PAPER_2_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-2/";
const AQA_CHEMISTRY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-1/";
const AQA_CHEMISTRY_PAPER_2_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-2/";
const AQA_GCSE_CHEMISTRY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-chemistry/aqa-paper-1/";
const AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1";
const EDEXCEL_A_GEOGRAPHY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-geography/edexcel-a-paper-1/";
const EDEXCEL_GCSE_HISTORY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-history/edexcel-paper-1/";
const EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-english-literature/edexcel-paper-2/";
const OCR_GCSE_BUSINESS_ASSESSMENT_URL =
  "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct";
const AQA_RELIGIOUS_STUDIES_SHORT_COURSE_ASSESSMENT_URL =
  "https://www.aqa.org.uk/subjects/religious-studies/gcse/religious-studies-short-course-8061/assessment-resources";
const PHYSICS_PAPER_1_BENCHMARK_YEARS = [2022, 2023, 2024] as const;
const PHYSICS_PAPER_2_BENCHMARK_YEARS = [2022, 2023, 2024] as const;
const BIOLOGY_BENCHMARK_YEARS = [2021, 2022, 2023, 2024] as const;
const CHEMISTRY_BENCHMARK_YEARS = [2023, 2024] as const;
const AQA_GCSE_CHEMISTRY_BENCHMARK_YEARS = [2023, 2024] as const;
const COMPUTER_SCIENCE_BENCHMARK_YEARS = [2022, 2023, 2024] as const;
const EDEXCEL_A_GEOGRAPHY_PAPER_1_YEARS = [2023, 2024] as const;
const EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_YEARS = [2023, 2024] as const;
const EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_YEARS = [2023, 2024] as const;
const OCR_BUSINESS_BENCHMARK_YEARS = [2023, 2024] as const;
const AQA_RELIGIOUS_STUDIES_SHORT_COURSE_YEARS = [2024] as const;

type SessionLinks = {
  questionPaperUrl?: string;
  markSchemeUrl?: string;
};

function normalizeLinkUrlForBase(href: string, baseUrl: string) {
  return new URL(href, baseUrl).toString();
}

function readSessionLabel(label: string) {
  if (!label.trim().startsWith("June")) {
    return null;
  }

  try {
    return parseSessionLabel(label);
  } catch {
    return null;
  }
}

function collectSessionLinks(
  $: cheerio.CheerioAPI,
  selector: string,
  targetKey: keyof SessionLinks,
  baseUrl = AQA_PHYSICS_PAPER_1_URL,
) {
  const linksBySession = new Map<string, SessionLinks>();

  $(selector).each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().trim();
    const session = readSessionLabel(label);

    if (!href || !session) {
      return;
    }

    const existing = linksBySession.get(session.sessionLabel) ?? {};

    if (existing[targetKey]) {
      throw new Error(
        `PMT benchmark discovery contract failed for ${baseUrl}: duplicate ${targetKey} link for ${session.sessionLabel}`,
      );
    }

    existing[targetKey] = normalizeLinkUrlForBase(href, baseUrl);
    linksBySession.set(session.sessionLabel, existing);
  });

  return linksBySession;
}

function assertBenchmarkContract(
  candidates: PmtPaperCandidate[],
  benchmarkYears: readonly number[],
  familyUrl: string,
) {
  const byYear = new Map(candidates.map((candidate) => [candidate.year, candidate]));
  const problems: string[] = [];

  for (const year of benchmarkYears) {
    const candidate = byYear.get(year);

    if (!candidate) {
      problems.push(`missing paired Higher QP/MS links for June ${year}`);
      continue;
    }

    if (!candidate.questionPaperUrl) {
      problems.push(`missing question paper link for June ${year}`);
    }

    if (!candidate.markSchemeUrl) {
      problems.push(`missing mark scheme link for June ${year}`);
    }
  }

  if (candidates.length !== benchmarkYears.length) {
    problems.push(
      `expected ${benchmarkYears.length} benchmark candidates, found ${candidates.length}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${familyUrl}: ${problems.join("; ")}`,
    );
  }
}

function discoverAqaBiologyPaperHigherFromHtml(
  html: string,
  paperNumber: 1 | 2,
  paperPageUrl: string,
) {
  const $ = cheerio.load(html);
  const prefix = `Biology-${paperNumber}H`;
  const sessionLinks = collectSessionLinks(
    $,
    `a[href*='${prefix}/QP/']`,
    "questionPaperUrl",
  );
  const markSchemes = collectSessionLinks($, `a[href*='${prefix}/MS/']`, "markSchemeUrl");
  const candidates: PmtPaperCandidate[] = [];

  for (const [sessionLabel, links] of markSchemes) {
    const existing = sessionLinks.get(sessionLabel) ?? {};
    sessionLinks.set(sessionLabel, {
      ...existing,
      ...links,
    });
  }

  for (const year of BIOLOGY_BENCHMARK_YEARS) {
    const sessionLabel = `June ${year}`;
    const links = sessionLinks.get(sessionLabel);

    if (!links?.questionPaperUrl || !links.markSchemeUrl) {
      continue;
    }

    candidates.push({
      paperPageUrl,
      questionPaperUrl: links.questionPaperUrl,
      markSchemeUrl: links.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Biology",
      paperNumber,
      tier: "Higher",
      sessionLabel,
      year,
    });
  }

  if (candidates.length !== BIOLOGY_BENCHMARK_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${paperPageUrl}: expected ${BIOLOGY_BENCHMARK_YEARS.length} Biology Paper ${paperNumber}H candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

function discoverAqaChemistryPaperHigherFromHtml(
  html: string,
  paperNumber: 1 | 2,
  paperPageUrl: string,
) {
  const $ = cheerio.load(html);
  const prefix = `Chemistry-${paperNumber}H`;
  const sessionLinks = collectSessionLinks(
    $,
    `a[href*='${prefix}/QP/']`,
    "questionPaperUrl",
  );
  const markSchemes = collectSessionLinks($, `a[href*='${prefix}/MS/']`, "markSchemeUrl");
  const candidates: PmtPaperCandidate[] = [];

  for (const [sessionLabel, links] of markSchemes) {
    const existing = sessionLinks.get(sessionLabel) ?? {};
    sessionLinks.set(sessionLabel, {
      ...existing,
      ...links,
    });
  }

  for (const year of CHEMISTRY_BENCHMARK_YEARS) {
    const sessionLabel = `June ${year}`;
    const links = sessionLinks.get(sessionLabel);

    if (!links?.questionPaperUrl || !links.markSchemeUrl) {
      continue;
    }

    candidates.push({
      paperPageUrl,
      questionPaperUrl: links.questionPaperUrl,
      markSchemeUrl: links.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Chemistry",
      paperNumber,
      tier: "Higher",
      sessionLabel,
      year,
    });
  }

  if (candidates.length !== CHEMISTRY_BENCHMARK_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${paperPageUrl}: expected ${CHEMISTRY_BENCHMARK_YEARS.length} Chemistry Paper ${paperNumber}H candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

export function discoverAqaBiologyPaper1HigherFromHtml(html: string) {
  return discoverAqaBiologyPaperHigherFromHtml(html, 1, AQA_BIOLOGY_PAPER_1_URL);
}

export function discoverAqaBiologyPaper2HigherFromHtml(html: string) {
  return discoverAqaBiologyPaperHigherFromHtml(html, 2, AQA_BIOLOGY_PAPER_2_URL);
}

export function discoverAqaChemistryPaper1HigherFromHtml(html: string) {
  return discoverAqaChemistryPaperHigherFromHtml(html, 1, AQA_CHEMISTRY_PAPER_1_URL);
}

export function discoverAqaChemistryPaper2HigherFromHtml(html: string) {
  return discoverAqaChemistryPaperHigherFromHtml(html, 2, AQA_CHEMISTRY_PAPER_2_URL);
}

export async function discoverAqaBiologyPaper1Higher() {
  const html = await fetchHtml(AQA_BIOLOGY_PAPER_1_URL);
  return discoverAqaBiologyPaper1HigherFromHtml(html);
}

export async function discoverAqaBiologyPaper2Higher() {
  const html = await fetchHtml(AQA_BIOLOGY_PAPER_2_URL);
  return discoverAqaBiologyPaper2HigherFromHtml(html);
}

export async function discoverAqaChemistryPaper1Higher() {
  const html = await fetchHtml(AQA_CHEMISTRY_PAPER_1_URL);
  return discoverAqaChemistryPaper1HigherFromHtml(html);
}

export async function discoverAqaChemistryPaper2Higher() {
  const html = await fetchHtml(AQA_CHEMISTRY_PAPER_2_URL);
  return discoverAqaChemistryPaper2HigherFromHtml(html);
}

export function discoverAqaGcseChemistryPaper1HigherFromHtml(html: string) {
  const $ = cheerio.load(html);
  const paperPageUrl = AQA_GCSE_CHEMISTRY_PAPER_1_URL;
  const prefix = "Paper-1H";
  const sessionLinks = collectSessionLinks(
    $,
    `a[href*='${prefix}/QP/']`,
    "questionPaperUrl",
    paperPageUrl,
  );
  const markSchemes = collectSessionLinks(
    $,
    `a[href*='${prefix}/MS/']`,
    "markSchemeUrl",
    paperPageUrl,
  );
  const candidates: PmtPaperCandidate[] = [];

  for (const [sessionLabel, links] of markSchemes) {
    const existing = sessionLinks.get(sessionLabel) ?? {};
    sessionLinks.set(sessionLabel, {
      ...existing,
      ...links,
    });
  }

  for (const year of AQA_GCSE_CHEMISTRY_BENCHMARK_YEARS) {
    const sessionLabel = `June ${year}`;
    const links = sessionLinks.get(sessionLabel);

    if (!links?.questionPaperUrl || !links.markSchemeUrl) {
      continue;
    }

    candidates.push({
      paperPageUrl,
      questionPaperUrl: links.questionPaperUrl,
      markSchemeUrl: links.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Chemistry",
      subject: "Chemistry",
      paperNumber: 1,
      tier: "Higher",
      sessionLabel,
      year,
    });
  }

  assertBenchmarkContract(candidates, AQA_GCSE_CHEMISTRY_BENCHMARK_YEARS, paperPageUrl);

  return candidates;
}

export async function discoverAqaGcseChemistryPaper1Higher() {
  const html = await fetchHtml(AQA_GCSE_CHEMISTRY_PAPER_1_URL);
  return discoverAqaGcseChemistryPaper1HigherFromHtml(html);
}

function discoverAqaPhysicsPaperHigherFromHtml(
  html: string,
  paperNumber: 1 | 2,
  paperPageUrl: string,
  benchmarkYears: readonly number[],
) {
  const $ = cheerio.load(html);
  const prefix = `Physics-${paperNumber}H`;
  const sessionLinks = collectSessionLinks(
    $,
    `a[href*='${prefix}/QP/']`,
    "questionPaperUrl",
    paperPageUrl,
  );
  const markSchemes = collectSessionLinks(
    $,
    `a[href*='${prefix}/MS/']`,
    "markSchemeUrl",
    paperPageUrl,
  );
  const benchmarkCandidates: PmtPaperCandidate[] = [];

  for (const [sessionLabel, links] of markSchemes) {
    const existing = sessionLinks.get(sessionLabel) ?? {};
    sessionLinks.set(sessionLabel, {
      ...existing,
      ...links,
    });
  }

  for (const year of benchmarkYears) {
    const sessionLabel = `June ${year}`;
    const links = sessionLinks.get(sessionLabel);

    if (!links?.questionPaperUrl || !links.markSchemeUrl) {
      continue;
    }

    benchmarkCandidates.push({
      paperPageUrl,
      questionPaperUrl: links.questionPaperUrl,
      markSchemeUrl: links.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber,
      tier: "Higher",
      sessionLabel,
      year,
    });
  }

  assertBenchmarkContract(benchmarkCandidates, benchmarkYears, paperPageUrl);

  return benchmarkCandidates;
}

export function discoverAqaPhysicsPaper1HigherFromHtml(html: string) {
  return discoverAqaPhysicsPaperHigherFromHtml(
    html,
    1,
    AQA_PHYSICS_PAPER_1_URL,
    PHYSICS_PAPER_1_BENCHMARK_YEARS,
  );
}

export function discoverAqaPhysicsPaper2HigherFromHtml(html: string) {
  return discoverAqaPhysicsPaperHigherFromHtml(
    html,
    2,
    AQA_PHYSICS_PAPER_2_URL,
    PHYSICS_PAPER_2_BENCHMARK_YEARS,
  );
}

export async function discoverAqaPhysicsPaper1Higher() {
  const html = await fetchHtml(AQA_PHYSICS_PAPER_1_URL);
  return discoverAqaPhysicsPaper1HigherFromHtml(html);
}

export async function discoverAqaPhysicsPaper2Higher() {
  const html = await fetchHtml(AQA_PHYSICS_PAPER_2_URL);
  return discoverAqaPhysicsPaper2HigherFromHtml(html);
}

export function discoverAqaGcseComputerSciencePaper1BPythonFromHtml(html: string) {
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  for (const year of COMPUTER_SCIENCE_BENCHMARK_YEARS) {
    const markScheme = $(`a[href*='June ${year} MS - Paper 1 AQA Computer Science GCSE.pdf']`).first();
    const questionPaper = $(`a[href*='June ${year} QP - Paper 1B AQA Computer Science GCSE.pdf']`).first();
    const markSchemeHref = markScheme.attr("href");
    const questionPaperHref = questionPaper.attr("href");

    if (!markSchemeHref || !questionPaperHref) {
      continue;
    }

    candidates.push({
      paperPageUrl: AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL,
      questionPaperUrl: normalizeLinkUrlForBase(questionPaperHref, AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL),
      markSchemeUrl: normalizeLinkUrlForBase(markSchemeHref, AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL),
      examBoard: "AQA",
      qualification: "GCSE Computer Science",
      subject: "Computer Science",
      paperNumber: 1,
      tier: "Python",
      sessionLabel: `June ${year}`,
      year,
    });
  }

  if (candidates.length !== COMPUTER_SCIENCE_BENCHMARK_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL}: expected ${COMPUTER_SCIENCE_BENCHMARK_YEARS.length} Paper 1B candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

export async function discoverAqaGcseComputerSciencePaper1BPython() {
  const html = await fetchHtml(AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL);
  return discoverAqaGcseComputerSciencePaper1BPythonFromHtml(html);
}

export function discoverEdexcelAGeographyPaper1FromHtml(html: string) {
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  for (const year of EDEXCEL_A_GEOGRAPHY_PAPER_1_YEARS) {
    const markScheme = $(`a[href*='June ${year} MS - Paper 1 Edexcel (A) Geography GCSE.pdf']`).first();
    const questionPaper = $(`a[href*='June ${year} QP - Paper 1 Edexcel (A) Geography GCSE.pdf']`).first();
    const markSchemeHref = markScheme.attr("href");
    const questionPaperHref = questionPaper.attr("href");

    if (!markSchemeHref || !questionPaperHref) {
      continue;
    }

    candidates.push({
      paperPageUrl: EDEXCEL_A_GEOGRAPHY_PAPER_1_URL,
      questionPaperUrl: normalizeLinkUrlForBase(questionPaperHref, EDEXCEL_A_GEOGRAPHY_PAPER_1_URL),
      markSchemeUrl: normalizeLinkUrlForBase(markSchemeHref, EDEXCEL_A_GEOGRAPHY_PAPER_1_URL),
      examBoard: "Edexcel",
      qualification: "GCSE Geography A",
      subject: "Geography",
      paperNumber: 1,
      tier: "The Physical Environment",
      sessionLabel: `June ${year}`,
      year,
    });
  }

  if (candidates.length !== EDEXCEL_A_GEOGRAPHY_PAPER_1_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${EDEXCEL_A_GEOGRAPHY_PAPER_1_URL}: expected ${EDEXCEL_A_GEOGRAPHY_PAPER_1_YEARS.length} Paper 1 candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

export async function discoverEdexcelAGeographyPaper1() {
  const html = await fetchHtml(EDEXCEL_A_GEOGRAPHY_PAPER_1_URL);
  return discoverEdexcelAGeographyPaper1FromHtml(html);
}

export function discoverEdexcelGcseHistoryPaper1MedicineFromHtml(html: string) {
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  for (const year of EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_YEARS) {
    const markScheme = $(`a[href*='June ${year} MS - Paper 1 Option 11 Edexcel History GCSE.pdf']`).first();
    const questionPaper = $(`a[href*='June ${year} QP - Paper 1 Option 11 Edexcel History GCSE.pdf']`).first();
    const markSchemeHref = markScheme.attr("href");
    const questionPaperHref = questionPaper.attr("href");

    if (!markSchemeHref || !questionPaperHref) {
      continue;
    }

    candidates.push({
      paperPageUrl: EDEXCEL_GCSE_HISTORY_PAPER_1_URL,
      questionPaperUrl: normalizeLinkUrlForBase(questionPaperHref, EDEXCEL_GCSE_HISTORY_PAPER_1_URL),
      markSchemeUrl: normalizeLinkUrlForBase(markSchemeHref, EDEXCEL_GCSE_HISTORY_PAPER_1_URL),
      examBoard: "Edexcel",
      qualification: "GCSE History",
      subject: "History",
      paperNumber: 1,
      tier: "Medicine in Britain and the British sector of the Western Front",
      sessionLabel: `June ${year}`,
      year,
    });
  }

  if (candidates.length !== EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${EDEXCEL_GCSE_HISTORY_PAPER_1_URL}: expected ${EDEXCEL_GCSE_HISTORY_PAPER_1_MEDICINE_YEARS.length} Paper 1 Option 11 Medicine candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

export async function discoverEdexcelGcseHistoryPaper1Medicine() {
  const html = await fetchHtml(EDEXCEL_GCSE_HISTORY_PAPER_1_URL);
  return discoverEdexcelGcseHistoryPaper1MedicineFromHtml(html);
}

export function discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflictFromHtml(html: string) {
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  for (const year of EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_YEARS) {
    const markScheme = $(
      `a[href*='June ${year} MS - Paper 2 Edexcel English Literature GCSE.pdf']`,
    ).first();
    const questionPaper = $(
      `a[href*='June ${year} QP - Paper 2 Edexcel English Literature GCSE.pdf']`,
    ).first();
    const markSchemeHref = markScheme.attr("href");
    const questionPaperHref = questionPaper.attr("href");

    if (!markSchemeHref || !questionPaperHref) {
      continue;
    }

    candidates.push({
      paperPageUrl: EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL,
      questionPaperUrl: normalizeLinkUrlForBase(
        questionPaperHref,
        EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL,
      ),
      markSchemeUrl: normalizeLinkUrlForBase(
        markSchemeHref,
        EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL,
      ),
      examBoard: "Edexcel",
      qualification: "GCSE English Literature",
      subject: "English Literature",
      paperNumber: 2,
      tier: "Dr Jekyll and Mr Hyde / Conflict anthology",
      sessionLabel: `June ${year}`,
      year,
    });
  }

  if (candidates.length !== EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_YEARS.length) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL}: expected ${EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_YEARS.length} Paper 2 Jekyll/Conflict candidates, found ${candidates.length}`,
    );
  }

  return candidates;
}

export async function discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflict() {
  const html = await fetchHtml(EDEXCEL_GCSE_ENGLISH_LITERATURE_PAPER_2_URL);
  return discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflictFromHtml(html);
}

function discoverOcrGcseBusinessPaperFromHtml(html: string, paperNumber: 1 | 2) {
  const $ = cheerio.load(html);
  const title =
    paperNumber === 1
      ? "Business 1: business activity, marketing and people"
      : "Business 2: operations, finance and influences on business";
  const candidates: PmtPaperCandidate[] = [];

  for (const year of OCR_BUSINESS_BENCHMARK_YEARS) {
    const yearHeading = $(`h4:contains("${year} - June series")`).first();
    const yearSection = yearHeading.nextUntil("h4");
    const yearLinks = yearSection.filter("a").add(yearSection.find("a"));
    const questionPaper = yearLinks.filter(`:contains("Question paper - ${title}")`).first();
    const markScheme = yearLinks.filter(`:contains("Mark scheme - ${title}")`).first();
    const questionPaperHref = questionPaper.attr("href");
    const markSchemeHref = markScheme.attr("href");

    if (!questionPaperHref || !markSchemeHref) {
      continue;
    }

    candidates.push({
      paperPageUrl: OCR_GCSE_BUSINESS_ASSESSMENT_URL,
      questionPaperUrl: normalizeLinkUrlForBase(questionPaperHref, OCR_GCSE_BUSINESS_ASSESSMENT_URL),
      markSchemeUrl: normalizeLinkUrlForBase(markSchemeHref, OCR_GCSE_BUSINESS_ASSESSMENT_URL),
      examBoard: "OCR",
      qualification: "GCSE Business",
      subject: "Business",
      paperNumber,
      tier: paperNumber === 1 ? "Business activity, marketing and people" : "Operations, finance and influences on business",
      sessionLabel: `June ${year}`,
      year,
    });
  }

  if (candidates.length !== OCR_BUSINESS_BENCHMARK_YEARS.length) {
    throw new Error(
      `OCR GCSE Business discovery contract failed for ${OCR_GCSE_BUSINESS_ASSESSMENT_URL}: expected ${OCR_BUSINESS_BENCHMARK_YEARS.length} Paper ${paperNumber} candidate, found ${candidates.length}`,
    );
  }

  return candidates;
}

export function discoverOcrGcseBusinessPaper1FromHtml(html: string) {
  return discoverOcrGcseBusinessPaperFromHtml(html, 1);
}

export function discoverOcrGcseBusinessPaper2FromHtml(html: string) {
  return discoverOcrGcseBusinessPaperFromHtml(html, 2);
}

export async function discoverOcrGcseBusinessPaper1() {
  const html = await fetchHtml(OCR_GCSE_BUSINESS_ASSESSMENT_URL);
  return discoverOcrGcseBusinessPaper1FromHtml(html);
}

export async function discoverOcrGcseBusinessPaper2() {
  const html = await fetchHtml(OCR_GCSE_BUSINESS_ASSESSMENT_URL);
  return discoverOcrGcseBusinessPaper2FromHtml(html);
}

type AqaReligiousStudiesShortCourseSection = {
  paperNumber: 2 | 4 | 5;
  subject: string;
  tier: string;
  questionPaperAssetId: string;
  markSchemeAssetId: string;
};

function aqaSanityPdfUrl(assetId: string) {
  return `https://cdn.sanity.io/files/p28bar15/green/${assetId}.pdf`;
}

function discoverAqaReligiousStudiesShortCourseSection({
  paperNumber,
  subject,
  tier,
  questionPaperAssetId,
  markSchemeAssetId,
}: AqaReligiousStudiesShortCourseSection): PmtPaperCandidate[] {
  return AQA_RELIGIOUS_STUDIES_SHORT_COURSE_YEARS.map((year) => ({
    paperPageUrl: AQA_RELIGIOUS_STUDIES_SHORT_COURSE_ASSESSMENT_URL,
    questionPaperUrl: aqaSanityPdfUrl(questionPaperAssetId),
    markSchemeUrl: aqaSanityPdfUrl(markSchemeAssetId),
    examBoard: "AQA",
    qualification: "GCSE Religious Studies Short Course",
    subject,
    paperNumber,
    tier,
    sessionLabel: `June ${year}`,
    year,
  }));
}

export function discoverAqaReligiousStudiesShortCourseChristianity() {
  return Promise.resolve(
    discoverAqaReligiousStudiesShortCourseSection({
      paperNumber: 2,
      subject: "Religious Studies",
      tier: "Section 2 Christianity",
      questionPaperAssetId: "8727d4720aafd4b9f804670c4a5625ebe4f455cc",
      markSchemeAssetId: "c3b7716dcce908b777e76098c07fc17db9e82bbd",
    }),
  );
}

export function discoverAqaReligiousStudiesShortCourseJudaism() {
  return Promise.resolve(
    discoverAqaReligiousStudiesShortCourseSection({
      paperNumber: 4,
      subject: "Religious Studies",
      tier: "Section 4 Judaism",
      questionPaperAssetId: "e244b5a645d88133b41b4fb69aff99478dd85deb",
      markSchemeAssetId: "dbfc3e7880b519d98c2f3c91614d0c719bb00c36",
    }),
  );
}

export function discoverAqaReligiousStudiesShortCourseThemes() {
  return Promise.resolve(
    discoverAqaReligiousStudiesShortCourseSection({
      paperNumber: 5,
      subject: "Religious Studies",
      tier: "Section 5 Themes",
      questionPaperAssetId: "5d032019b467545bc8d9b21da9185718ee111601",
      markSchemeAssetId: "b7d155ad43329ee031f4f37b1c507806f5a5f830",
    }),
  );
}
