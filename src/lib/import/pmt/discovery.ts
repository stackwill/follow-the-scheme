import * as cheerio from "cheerio";

import { fetchHtml } from "@/lib/import/core/http";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";
import type { PmtPaperCandidate } from "@/lib/import/types";

const FAMILY_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/";
const BENCHMARK_YEARS = [2023, 2024] as const;

type SessionLinks = {
  questionPaperUrl?: string;
  markSchemeUrl?: string;
};

function normalizeLinkUrl(href: string) {
  return new URL(href, FAMILY_URL).toString();
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
