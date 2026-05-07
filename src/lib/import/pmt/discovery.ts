import * as cheerio from "cheerio";

import { fetchHtml } from "@/lib/import/core/http";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";
import type { PmtPaperCandidate } from "@/lib/import/types";

const FAMILY_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/";
const AQA_BIOLOGY_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-1/";
const AQA_BIOLOGY_PAPER_2_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-2/";
const AQA_GCSE_COMPUTER_SCIENCE_PAPER_1_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1";
const OCR_GCSE_BUSINESS_ASSESSMENT_URL =
  "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct";
const BENCHMARK_YEARS = [2023, 2024] as const;
const BIOLOGY_BENCHMARK_YEARS = [2023] as const;
const COMPUTER_SCIENCE_BENCHMARK_YEARS = [2024] as const;
const OCR_BUSINESS_BENCHMARK_YEARS = [2024] as const;

type SessionLinks = {
  questionPaperUrl?: string;
  markSchemeUrl?: string;
};

function normalizeLinkUrl(href: string) {
  return new URL(href, FAMILY_URL).toString();
}

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
        `PMT benchmark discovery contract failed for ${FAMILY_URL}: duplicate ${targetKey} link for ${session.sessionLabel}`,
      );
    }

    existing[targetKey] = normalizeLinkUrl(href);
    linksBySession.set(session.sessionLabel, existing);
  });

  return linksBySession;
}

function assertBenchmarkContract(candidates: PmtPaperCandidate[]) {
  const byYear = new Map(candidates.map((candidate) => [candidate.year, candidate]));
  const problems: string[] = [];

  for (const year of BENCHMARK_YEARS) {
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

  if (candidates.length !== BENCHMARK_YEARS.length) {
    problems.push(
      `expected ${BENCHMARK_YEARS.length} benchmark candidates, found ${candidates.length}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `PMT benchmark discovery contract failed for ${FAMILY_URL}: ${problems.join("; ")}`,
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

export function discoverAqaBiologyPaper1HigherFromHtml(html: string) {
  return discoverAqaBiologyPaperHigherFromHtml(html, 1, AQA_BIOLOGY_PAPER_1_URL);
}

export function discoverAqaBiologyPaper2HigherFromHtml(html: string) {
  return discoverAqaBiologyPaperHigherFromHtml(html, 2, AQA_BIOLOGY_PAPER_2_URL);
}

export async function discoverAqaBiologyPaper1Higher() {
  const html = await fetchHtml(AQA_BIOLOGY_PAPER_1_URL);
  return discoverAqaBiologyPaper1HigherFromHtml(html);
}

export async function discoverAqaBiologyPaper2Higher() {
  const html = await fetchHtml(AQA_BIOLOGY_PAPER_2_URL);
  return discoverAqaBiologyPaper2HigherFromHtml(html);
}

export function discoverAqaPhysicsPaper1HigherFromHtml(html: string) {
  const $ = cheerio.load(html);
  const sessionLinks = collectSessionLinks($, "a[href*='Physics-1H/QP/']", "questionPaperUrl");
  const markSchemes = collectSessionLinks($, "a[href*='Physics-1H/MS/']", "markSchemeUrl");
  const benchmarkCandidates: PmtPaperCandidate[] = [];

  for (const [sessionLabel, links] of markSchemes) {
    const existing = sessionLinks.get(sessionLabel) ?? {};
    sessionLinks.set(sessionLabel, {
      ...existing,
      ...links,
    });
  }

  for (const year of BENCHMARK_YEARS) {
    const sessionLabel = `June ${year}`;
    const links = sessionLinks.get(sessionLabel);

    if (!links?.questionPaperUrl || !links.markSchemeUrl) {
      continue;
    }

    benchmarkCandidates.push({
      paperPageUrl: FAMILY_URL,
      questionPaperUrl: links.questionPaperUrl,
      markSchemeUrl: links.markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      sessionLabel,
      year,
    });
  }

  assertBenchmarkContract(benchmarkCandidates);

  return benchmarkCandidates;
}

export async function discoverAqaPhysicsPaper1Higher() {
  const html = await fetchHtml(FAMILY_URL);
  return discoverAqaPhysicsPaper1HigherFromHtml(html);
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

function discoverOcrGcseBusinessPaperFromHtml(html: string, paperNumber: 1 | 2) {
  const $ = cheerio.load(html);
  const title =
    paperNumber === 1
      ? "Business 1: business activity, marketing and people"
      : "Business 2: operations, finance and influences on business";
  const candidates: PmtPaperCandidate[] = [];

  for (const year of OCR_BUSINESS_BENCHMARK_YEARS) {
    const questionPaper = $(`a:contains("Question paper - ${title}")`).first();
    const markScheme = $(`a:contains("Mark scheme - ${title}")`).first();
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
