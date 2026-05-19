import { describe, expect, it } from "vitest";

import {
  discoverAqaBiologyPaper1HigherFromHtml,
  discoverAqaBiologyPaper2HigherFromHtml,
  discoverAqaChemistryPaper1HigherFromHtml,
  discoverAqaChemistryPaper2HigherFromHtml,
  discoverAqaGcseChemistryPaper1HigherFromHtml,
  discoverAqaGcseComputerSciencePaper1BPythonFromHtml,
  discoverAqaGcseComputerSciencePaper2FromHtml,
  discoverAqaReligiousStudiesShortCourseChristianity,
  discoverAqaReligiousStudiesShortCourseJudaism,
  discoverAqaReligiousStudiesShortCourseThemes,
  discoverAqaPhysicsPaper1HigherFromHtml,
  discoverAqaPhysicsPaper2HigherFromHtml,
  discoverEdexcelAGeographyPaper1FromHtml,
  discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflictFromHtml,
  discoverOcrGcseBusinessPaper1FromHtml,
  discoverOcrGcseBusinessPaper2FromHtml,
} from "@/lib/import/pmt/discovery";
import { parseSessionLabel } from "@/lib/import/pmt/normalize";

function buildFixtureHtml() {
  return `
    <main>
      <a href="/papers/Physics-1H/QP/2022-qp.pdf">June 2022 QP</a>
      <a href="/papers/Physics-1H/MS/2022-ms.pdf">June 2022 MS</a>
      <a href="/papers/Physics-1H/QP/2023-qp.pdf">June 2023 QP</a>
      <a href="/papers/Physics-1H/MS/2024-ms.pdf">June 2024 MS</a>
      <a href="/papers/Physics-1H/QP/2024-qp.pdf">June 2024 QP</a>
      <a href="/papers/Physics-1H/MS/2023-ms.pdf">June 2023 MS</a>
      <a href="/papers/Physics-1H/QP/november-2024-qp.pdf">November 2024 QP</a>
    </main>
  `;
}

describe("parseSessionLabel", () => {
  it("extracts a June year label", () => {
    expect(parseSessionLabel("June 2024 QP")).toEqual({
      sessionLabel: "June 2024",
      year: 2024,
    });
  });
});

describe("discoverAqaGcseComputerSciencePaper1BPythonFromHtml", () => {
  it("selects the current-spec June 2022-2024 Paper 1B Python QP and shared Paper 1 mark scheme", () => {
    const html = `
      <main>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2022 MS - Paper 1 AQA Computer Science GCSE.pdf">June 2022 MS - Paper 1 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2022 QP - Paper 1A AQA Computer Science GCSE.pdf">June 2022 QP - Paper 1A AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2022 QP - Paper 1B AQA Computer Science GCSE.pdf">June 2022 QP - Paper 1B AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2023 MS - Paper 1 AQA Computer Science GCSE.pdf">June 2023 MS - Paper 1 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2023 QP - Paper 1A AQA Computer Science GCSE.pdf">June 2023 QP - Paper 1A AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2023 QP - Paper 1B AQA Computer Science GCSE.pdf">June 2023 QP - Paper 1B AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2024 MS - Paper 1 AQA Computer Science GCSE.pdf">June 2024 MS - Paper 1 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2024 QP - Paper 1A AQA Computer Science GCSE.pdf">June 2024 QP - Paper 1A AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2024 QP - Paper 1B AQA Computer Science GCSE.pdf">June 2024 QP - Paper 1B AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June 2024 QP - Paper 1C AQA Computer Science GCSE.pdf">June 2024 QP - Paper 1C AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/Paper-1/June 2020 QP - Paper 1 AQA Computer Science GCSE.pdf">June 2020 QP - Paper 1 AQA Computer Science GCSE</a>
      </main>
    `;

    expect(discoverAqaGcseComputerSciencePaper1BPythonFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202022%20QP%20-%20Paper%201B%20AQA%20Computer%20Science%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202022%20MS%20-%20Paper%201%20AQA%20Computer%20Science%20GCSE.pdf",
        examBoard: "AQA",
        qualification: "GCSE Computer Science",
        subject: "Computer Science",
        paperNumber: 1,
        tier: "Python",
        sessionLabel: "June 2022",
        year: 2022,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202023%20QP%20-%20Paper%201B%20AQA%20Computer%20Science%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202023%20MS%20-%20Paper%201%20AQA%20Computer%20Science%20GCSE.pdf",
        examBoard: "AQA",
        qualification: "GCSE Computer Science",
        subject: "Computer Science",
        paperNumber: 1,
        tier: "Python",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-1",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202024%20QP%20-%20Paper%201B%20AQA%20Computer%20Science%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-1/June%202024%20MS%20-%20Paper%201%20AQA%20Computer%20Science%20GCSE.pdf",
        examBoard: "AQA",
        qualification: "GCSE Computer Science",
        subject: "Computer Science",
        paperNumber: 1,
        tier: "Python",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverAqaGcseComputerSciencePaper2FromHtml", () => {
  it("selects the current-spec June 2023 and 2024 Paper 2 QP and mark scheme", () => {
    const html = `
      <main>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2022 MS - Paper 2 AQA Computer Science GCSE.pdf">June 2022 MS - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2022 QP - Paper 2 AQA Computer Science GCSE.pdf">June 2022 QP - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2023 MS - Paper 2 AQA Computer Science GCSE.pdf">June 2023 MS - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2023 QP - Paper 2 AQA Computer Science GCSE.pdf">June 2023 QP - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2024 MS - Paper 2 AQA Computer Science GCSE.pdf">June 2024 MS - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June 2024 QP - Paper 2 AQA Computer Science GCSE.pdf">June 2024 QP - Paper 2 AQA Computer Science GCSE</a>
        <a href="/download/Computer-Science/GCSE/Past-Papers/AQA/Paper-2/June 2020 QP - Paper 2 AQA Computer Science GCSE.pdf">June 2020 QP - Paper 2 AQA Computer Science GCSE</a>
      </main>
    `;

    expect(discoverAqaGcseComputerSciencePaper2FromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-2",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June%202023%20QP%20-%20Paper%202%20AQA%20Computer%20Science%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June%202023%20MS%20-%20Paper%202%20AQA%20Computer%20Science%20GCSE.pdf",
        examBoard: "AQA",
        qualification: "GCSE Computer Science",
        subject: "Computer Science",
        paperNumber: 2,
        tier: "Computing concepts",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-computer-science/aqa-paper-2",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June%202024%20QP%20-%20Paper%202%20AQA%20Computer%20Science%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Computer-Science/GCSE/Past-Papers/AQA/New-Spec/Paper-2/June%202024%20MS%20-%20Paper%202%20AQA%20Computer%20Science%20GCSE.pdf",
        examBoard: "AQA",
        qualification: "GCSE Computer Science",
        subject: "Computer Science",
        paperNumber: 2,
        tier: "Computing concepts",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverAqaReligiousStudiesShortCourse", () => {
  it("selects the AQA June 2022-2024 Christianity, Judaism, and Themes short-course sections", async () => {
    await expect(discoverAqaReligiousStudiesShortCourseChristianity()).resolves.toEqual([
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 2,
        tier: "Section 2 Christianity",
        sessionLabel: "June 2022",
        year: 2022,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 2,
        tier: "Section 2 Christianity",
        sessionLabel: "June 2023",
        year: 2023,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 2,
        tier: "Section 2 Christianity",
        sessionLabel: "June 2024",
        year: 2024,
      }),
    ]);
    await expect(discoverAqaReligiousStudiesShortCourseJudaism()).resolves.toEqual([
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 4,
        tier: "Section 4 Judaism",
        sessionLabel: "June 2022",
        year: 2022,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 4,
        tier: "Section 4 Judaism",
        sessionLabel: "June 2023",
        year: 2023,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 4,
        tier: "Section 4 Judaism",
        sessionLabel: "June 2024",
        year: 2024,
      }),
    ]);
    await expect(discoverAqaReligiousStudiesShortCourseThemes()).resolves.toEqual([
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 5,
        tier: "Section 5 Themes",
        sessionLabel: "June 2022",
        year: 2022,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 5,
        tier: "Section 5 Themes",
        sessionLabel: "June 2023",
        year: 2023,
      }),
      expect.objectContaining({
        examBoard: "AQA",
        qualification: "GCSE Religious Studies Short Course",
        paperNumber: 5,
        tier: "Section 5 Themes",
        sessionLabel: "June 2024",
        year: 2024,
      }),
    ]);
  });
});

describe("discoverEdexcelAGeographyPaper1FromHtml", () => {
  it("selects Edexcel A Geography Paper 1 The Physical Environment for June 2023 and 2024", () => {
    const html = `
      <main>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2023 MS - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2023 MS - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2023 QP - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2023 QP - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2023 RB - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2023 RB - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2024 MS - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2024 MS - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2024 QP - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2024 QP - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June 2024 IN - Paper 1 Edexcel (A) Geography GCSE.pdf">June 2024 IN - Paper 1 Edexcel (A) Geography GCSE</a>
        <a href="/download/Geography/GCSE/Past-Papers/Edexcel-B/Paper-1/June 2024 QP - Paper 1 Edexcel (B) Geography GCSE.pdf">June 2024 QP - Paper 1 Edexcel (B) Geography GCSE</a>
      </main>
    `;

    expect(discoverEdexcelAGeographyPaper1FromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-geography/edexcel-a-paper-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June%202023%20QP%20-%20Paper%201%20Edexcel%20(A)%20Geography%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June%202023%20MS%20-%20Paper%201%20Edexcel%20(A)%20Geography%20GCSE.pdf",
        examBoard: "Edexcel",
        qualification: "GCSE Geography A",
        subject: "Geography",
        paperNumber: 1,
        tier: "The Physical Environment",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-geography/edexcel-a-paper-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June%202024%20QP%20-%20Paper%201%20Edexcel%20(A)%20Geography%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Geography/GCSE/Past-Papers/Edexcel-A/Paper-1/June%202024%20MS%20-%20Paper%201%20Edexcel%20(A)%20Geography%20GCSE.pdf",
        examBoard: "Edexcel",
        qualification: "GCSE Geography A",
        subject: "Geography",
        paperNumber: 1,
        tier: "The Physical Environment",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflictFromHtml", () => {
  it("selects Edexcel GCSE English Literature Paper 2 for June 2023 and 2024", () => {
    const html = `
      <main>
        <a href="/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June 2022 QP - Paper 2N Edexcel English Literature GCSE.pdf">June 2022 QP - Paper 2N Edexcel English Literature GCSE</a>
        <a href="/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June 2023 MS - Paper 2 Edexcel English Literature GCSE.pdf">June 2023 MS - Paper 2 Edexcel English Literature GCSE</a>
        <a href="/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June 2023 QP - Paper 2 Edexcel English Literature GCSE.pdf">June 2023 QP - Paper 2 Edexcel English Literature GCSE</a>
        <a href="/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June 2024 MS - Paper 2 Edexcel English Literature GCSE.pdf">June 2024 MS - Paper 2 Edexcel English Literature GCSE</a>
        <a href="/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June 2024 QP - Paper 2 Edexcel English Literature GCSE.pdf">June 2024 QP - Paper 2 Edexcel English Literature GCSE</a>
      </main>
    `;

    expect(discoverEdexcelGcseEnglishLiteraturePaper2JekyllConflictFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-english-literature/edexcel-paper-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June%202023%20QP%20-%20Paper%202%20Edexcel%20English%20Literature%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June%202023%20MS%20-%20Paper%202%20Edexcel%20English%20Literature%20GCSE.pdf",
        examBoard: "Edexcel",
        qualification: "GCSE English Literature",
        subject: "English Literature",
        paperNumber: 2,
        tier: "Dr Jekyll and Mr Hyde / Conflict anthology",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-english-literature/edexcel-paper-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June%202024%20QP%20-%20Paper%202%20Edexcel%20English%20Literature%20GCSE.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/English-Literature/GCSE/Past-Papers/Edexcel/Paper-2/June%202024%20MS%20-%20Paper%202%20Edexcel%20English%20Literature%20GCSE.pdf",
        examBoard: "Edexcel",
        qualification: "GCSE English Literature",
        subject: "English Literature",
        paperNumber: 2,
        tier: "Dr Jekyll and Mr Hyde / Conflict anthology",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverAqaBiologyPaperHigherFromHtml", () => {
  it("selects the June 2021-2024 Biology Paper 1H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/QP/June 2021 QP.pdf">June 2021 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/MS/June 2021 MS.pdf">June 2021 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/QP/June 2022 QP.pdf">June 2022 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/MS/June 2022 MS.pdf">June 2022 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1F/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1F/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-1H/MS/June 2024 MS.pdf">June 2024 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
      </main>
    `;

    const candidates = discoverAqaBiologyPaper1HigherFromHtml(html);

    expect(candidates.map((candidate) => candidate.year)).toEqual([2021, 2022, 2023, 2024]);
    expect(candidates).toContainEqual(
      expect.objectContaining({
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Biology-1H/QP/June%202021%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Biology-1H/MS/June%202021%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Biology",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2021",
      }),
    );
  });

  it("selects the June 2021-2024 Biology Paper 2H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June 2021 QP.pdf">June 2021 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/MS/June 2021 MS.pdf">June 2021 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June 2022 QP.pdf">June 2022 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/MS/June 2022 MS.pdf">June 2022 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2F/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Biology-2H/MS/June 2024 MS.pdf">June 2024 MS</a>
      </main>
    `;

    const candidates = discoverAqaBiologyPaper2HigherFromHtml(html);

    expect(candidates.map((candidate) => candidate.year)).toEqual([2021, 2022, 2023, 2024]);
    expect(candidates).toContainEqual(
      expect.objectContaining({
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-biology-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Biology-2H/QP/June%202022%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Biology-2H/MS/June%202022%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Biology",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2022",
      }),
    );
  });
});

describe("discoverAqaChemistryPaperHigherFromHtml", () => {
  it("selects the June 2023 and 2024 Chemistry Paper 1H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1F/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1F/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/MS/June 2024 MS.pdf">June 2024 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
      </main>
    `;

    expect(discoverAqaChemistryPaper1HigherFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/QP/June%202023%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/MS/June%202023%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Chemistry",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/QP/June%202024%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-1H/MS/June%202024%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Chemistry",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });

  it("selects the June 2023 and 2024 Chemistry Paper 2H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2F/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/MS/June 2024 MS.pdf">June 2024 MS</a>
      </main>
    `;

    expect(discoverAqaChemistryPaper2HigherFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/QP/June%202023%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/MS/June%202023%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Chemistry",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-chemistry-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/QP/June%202024%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Chemistry-2H/MS/June%202024%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Chemistry",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverAqaGcseChemistryPaper1HigherFromHtml", () => {
  it("selects the June 2023 and 2024 GCSE Chemistry Paper 1H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1F/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1F/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/MS/June 2024 MS.pdf">June 2024 MS</a>
        <a href="/download/Chemistry/GCSE/Past-Papers/AQA/Paper-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
      </main>
    `;

    expect(discoverAqaGcseChemistryPaper1HigherFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-chemistry/aqa-paper-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/QP/June%202023%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/MS/June%202023%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Chemistry",
        subject: "Chemistry",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-chemistry/aqa-paper-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/QP/June%202024%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Chemistry/GCSE/Past-Papers/AQA/Paper-1H/MS/June%202024%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Chemistry",
        subject: "Chemistry",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverOcrGcseBusinessPaperFromHtml", () => {
  it("selects the OCR GCSE Business 2023 and 2024 Paper 1 QP and MS pairs", () => {
    const html = `
      <main>
        <h4>2024 - June series</h4>
        <a href="/Images/727519-question-paper-business-1-business-activity-marketing-and-people.pdf">Question paper - Business 1: business activity, marketing and people</a>
        <a href="/Images/727634-mark-scheme-business-1-business-activity-marketing-and-people.pdf">Mark scheme - Business 1: business activity, marketing and people</a>
        <a href="/Images/727520-question-paper-business-2-operations-finance-and-influences-on-business.pdf">Question paper - Business 2: operations, finance and influences on business</a>
        <a href="/Images/727635-mark-scheme-business-2-operations-finance-and-influences-on-business.pdf">Mark scheme - Business 2: operations, finance and influences on business</a>
        <h4>2023 - June series</h4>
        <a href="/Images/704745-question-paper-business-1-business-activity-marketing-and-people.pdf">Question paper - Business 1: business activity, marketing and people</a>
        <a href="/Images/704864-mark-scheme-business-1-business-activity-marketing-and-people.pdf">Mark scheme - Business 1: business activity, marketing and people</a>
      </main>
    `;

    expect(discoverOcrGcseBusinessPaper1FromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
        questionPaperUrl:
          "https://www.ocr.org.uk/Images/704745-question-paper-business-1-business-activity-marketing-and-people.pdf",
        markSchemeUrl:
          "https://www.ocr.org.uk/Images/704864-mark-scheme-business-1-business-activity-marketing-and-people.pdf",
        examBoard: "OCR",
        qualification: "GCSE Business",
        subject: "Business",
        paperNumber: 1,
        tier: "Business activity, marketing and people",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
        questionPaperUrl:
          "https://www.ocr.org.uk/Images/727519-question-paper-business-1-business-activity-marketing-and-people.pdf",
        markSchemeUrl:
          "https://www.ocr.org.uk/Images/727634-mark-scheme-business-1-business-activity-marketing-and-people.pdf",
        examBoard: "OCR",
        qualification: "GCSE Business",
        subject: "Business",
        paperNumber: 1,
        tier: "Business activity, marketing and people",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });

  it("selects the OCR GCSE Business 2023 and 2024 Paper 2 QP and MS pairs", () => {
    const html = `
      <main>
        <h4>2024 - June series</h4>
        <a href="/Images/727519-question-paper-business-1-business-activity-marketing-and-people.pdf">Question paper - Business 1: business activity, marketing and people</a>
        <a href="/Images/727634-mark-scheme-business-1-business-activity-marketing-and-people.pdf">Mark scheme - Business 1: business activity, marketing and people</a>
        <a href="/Images/727520-question-paper-business-2-operations-finance-and-influences-on-business.pdf">Question paper - Business 2: operations, finance and influences on business</a>
        <a href="/Images/727635-mark-scheme-business-2-operations-finance-and-influences-on-business.pdf">Mark scheme - Business 2: operations, finance and influences on business</a>
        <h4>2023 - June series</h4>
        <a href="/Images/704745-question-paper-business-1-business-activity-marketing-and-people.pdf">Question paper - Business 1: business activity, marketing and people</a>
        <a href="/Images/704864-mark-scheme-business-1-business-activity-marketing-and-people.pdf">Mark scheme - Business 1: business activity, marketing and people</a>
        <a href="/Images/704746-question-paper-business-2-operations-finance-and-influences-on-business.pdf">Question paper - Business 2: operations, finance and influences on business</a>
        <a href="/Images/704865-mark-scheme-business-2-operations-finance-and-influences-on-business.pdf">Mark scheme - Business 2: operations, finance and influences on business</a>
      </main>
    `;

    expect(discoverOcrGcseBusinessPaper2FromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
        questionPaperUrl:
          "https://www.ocr.org.uk/Images/704746-question-paper-business-2-operations-finance-and-influences-on-business.pdf",
        markSchemeUrl:
          "https://www.ocr.org.uk/Images/704865-mark-scheme-business-2-operations-finance-and-influences-on-business.pdf",
        examBoard: "OCR",
        qualification: "GCSE Business",
        subject: "Business",
        paperNumber: 2,
        tier: "Operations, finance and influences on business",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.ocr.org.uk/qualifications/gcse/business-j204-from-2017/assessment/?channel=direct",
        questionPaperUrl:
          "https://www.ocr.org.uk/Images/727520-question-paper-business-2-operations-finance-and-influences-on-business.pdf",
        markSchemeUrl:
          "https://www.ocr.org.uk/Images/727635-mark-scheme-business-2-operations-finance-and-influences-on-business.pdf",
        examBoard: "OCR",
        qualification: "GCSE Business",
        subject: "Business",
        paperNumber: 2,
        tier: "Operations, finance and influences on business",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});

describe("discoverAqaPhysicsPaper1HigherFromHtml", () => {
  it("pairs benchmark QP and MS links and filters non-benchmark years", () => {
    expect(discoverAqaPhysicsPaper1HigherFromHtml(buildFixtureHtml())).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/QP/2022-qp.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/MS/2022-ms.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2022",
        year: 2022,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/QP/2023-qp.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/MS/2023-ms.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-1/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/QP/2024-qp.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/papers/Physics-1H/MS/2024-ms.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 1,
        tier: "Higher",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });

  it("throws a clear contract error when a benchmark pair is missing", () => {
    const html = `
      <main>
        <a href="/papers/Physics-1H/QP/2023-qp.pdf">June 2023 QP</a>
        <a href="/papers/Physics-1H/MS/2023-ms.pdf">June 2023 MS</a>
        <a href="/papers/Physics-1H/QP/2022-qp.pdf">June 2022 QP</a>
        <a href="/papers/Physics-1H/MS/2022-ms.pdf">June 2022 MS</a>
        <a href="/papers/Physics-1H/QP/2024-qp.pdf">June 2024 QP</a>
      </main>
    `;

    expect(() => discoverAqaPhysicsPaper1HigherFromHtml(html)).toThrow(
      "PMT benchmark discovery contract failed",
    );
    expect(() => discoverAqaPhysicsPaper1HigherFromHtml(html)).toThrow(
      "missing paired Higher QP/MS links for June 2024",
    );
  });

  it("throws when the page shape includes duplicate benchmark links", () => {
    const html = `
      <main>
        <a href="/papers/Physics-1H/QP/2023-qp-a.pdf">June 2023 QP</a>
        <a href="/papers/Physics-1H/QP/2023-qp-b.pdf">June 2023 QP</a>
        <a href="/papers/Physics-1H/MS/2023-ms.pdf">June 2023 MS</a>
        <a href="/papers/Physics-1H/QP/2022-qp.pdf">June 2022 QP</a>
        <a href="/papers/Physics-1H/MS/2022-ms.pdf">June 2022 MS</a>
        <a href="/papers/Physics-1H/QP/2024-qp.pdf">June 2024 QP</a>
        <a href="/papers/Physics-1H/MS/2024-ms.pdf">June 2024 MS</a>
      </main>
    `;

    expect(() => discoverAqaPhysicsPaper1HigherFromHtml(html)).toThrow(
      "duplicate questionPaperUrl link for June 2023",
    );
  });
});

describe("discoverAqaPhysicsPaper2HigherFromHtml", () => {
  it("selects the June 2022-2024 Physics Paper 2H QP and MS pairs", () => {
    const html = `
      <main>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2F/QP/June 2022 QP.pdf">June 2022 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2F/MS/June 2022 MS.pdf">June 2022 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June 2022 QP.pdf">June 2022 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June 2022 MS.pdf">June 2022 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June 2023 QP.pdf">June 2023 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June 2023 MS.pdf">June 2023 MS</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June 2024 QP.pdf">June 2024 QP</a>
        <a href="/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June 2024 MS.pdf">June 2024 MS</a>
      </main>
    `;

    expect(discoverAqaPhysicsPaper2HigherFromHtml(html)).toEqual([
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June%202022%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June%202022%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2022",
        year: 2022,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June%202023%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June%202023%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2023",
        year: 2023,
      },
      {
        paperPageUrl:
          "https://www.physicsandmathstutor.com/past-papers/gcse-science/aqa-physics-2/",
        questionPaperUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/QP/June%202024%20QP.pdf",
        markSchemeUrl:
          "https://www.physicsandmathstutor.com/download/Science/GCSE/Past-Papers/AQA/Physics-2H/MS/June%202024%20MS.pdf",
        examBoard: "AQA",
        qualification: "GCSE Combined Science Trilogy",
        subject: "Physics",
        paperNumber: 2,
        tier: "Higher",
        sessionLabel: "June 2024",
        year: 2024,
      },
    ]);
  });
});
