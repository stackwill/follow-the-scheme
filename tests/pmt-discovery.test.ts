import { describe, expect, it } from "vitest";

import {
  discoverAqaGcseComputerSciencePaper1BPythonFromHtml,
  discoverAqaPhysicsPaper1HigherFromHtml,
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
  it("selects the current-spec June 2024 Paper 1B Python QP and shared Paper 1 mark scheme", () => {
    const html = `
      <main>
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

describe("discoverAqaPhysicsPaper1HigherFromHtml", () => {
  it("pairs benchmark QP and MS links and filters non-benchmark years", () => {
    expect(discoverAqaPhysicsPaper1HigherFromHtml(buildFixtureHtml())).toEqual([
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
        <a href="/papers/Physics-1H/QP/2024-qp.pdf">June 2024 QP</a>
        <a href="/papers/Physics-1H/MS/2024-ms.pdf">June 2024 MS</a>
      </main>
    `;

    expect(() => discoverAqaPhysicsPaper1HigherFromHtml(html)).toThrow(
      "duplicate questionPaperUrl link for June 2023",
    );
  });
});
