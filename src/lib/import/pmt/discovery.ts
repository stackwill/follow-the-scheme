import * as cheerio from "cheerio";

import { fetchHtml } from "@/lib/import/core/http";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";
import type { PmtPaperCandidate } from "@/lib/import/types";

const FAMILY_URL =
  "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/";

export async function discoverAqaPhysicsPaper1Higher() {
  const html = await fetchHtml(FAMILY_URL);
  const $ = cheerio.load(html);
  const candidates: PmtPaperCandidate[] = [];

  const qpLinks = $("a[href*='Physics-1H/QP/']");
  const msLinks = $("a[href*='Physics-1H/MS/']");
  const msMap = new Map<string, string>();

  msLinks.each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().trim();

    if (href && label.startsWith("June")) {
      msMap.set(label, href);
    }
  });

  qpLinks.each((_, element) => {
    const href = $(element).attr("href");
    const label = $(element).text().trim();
    const markSchemeUrl =
      msMap.get(label.replace("QP", "MS")) ?? msMap.get(label.replace(" QP", ""));

    if (!href || !label.startsWith("June") || !markSchemeUrl) {
      return;
    }

    const { sessionLabel, year } = parseSessionLabel(label);

    candidates.push({
      paperPageUrl: FAMILY_URL,
      questionPaperUrl: href,
      markSchemeUrl,
      examBoard: "AQA",
      qualification: "GCSE Combined Science Trilogy",
      subject: "Physics",
      paperNumber: 1,
      tier: "Higher",
      sessionLabel,
      year,
    });
  });

  return candidates.filter((candidate) => [2023, 2024].includes(candidate.year));
}
