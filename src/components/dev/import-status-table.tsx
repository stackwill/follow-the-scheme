import Link from "next/link";

import type { Paper, PaperSource, Question } from "@prisma/client";

type ImportStatusSource = PaperSource & {
  paper:
    | (Pick<Paper, "id" | "title" | "status" | "importedAt" | "totalMarks"> & {
        questions: Pick<Question, "questionKey" | "importDiagnostics">[];
      })
    | null;
};

type FailureDiagnostics = Record<string, unknown>;
type ParsedQuestionDiagnostics = {
  warnings?: Array<{
    stage?: unknown;
    message?: unknown;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function formatFailureSummary(failure: FailureDiagnostics) {
  const stage = readString(failure.stage);
  const message = readString(failure.message) ?? "Import failed without a message.";

  return stage ? `${stage}: ${message}` : message;
}

function formatFailureDetails(failure: FailureDiagnostics) {
  return JSON.stringify(failure, null, 2);
}

function parseQuestionDiagnostics(question: Pick<Question, "questionKey" | "importDiagnostics">) {
  try {
    const diagnostics = JSON.parse(question.importDiagnostics) as ParsedQuestionDiagnostics;
    const warnings = diagnostics.warnings ?? [];

    return warnings.map((warning) => ({
      questionKey: question.questionKey,
      stage: readString(warning.stage) ?? "adapter",
      message: readString(warning.message) ?? "Importer warning without a message.",
    }));
  } catch {
    return [
      {
        questionKey: question.questionKey,
        stage: "diagnostics",
        message: "Unable to parse question import diagnostics.",
      },
    ];
  }
}

function getQuestionWarnings(source: ImportStatusSource) {
  return source.paper?.questions.flatMap(parseQuestionDiagnostics) ?? [];
}

export function ImportStatusTable({
  sources,
  failureDiagnostics,
}: {
  sources: ImportStatusSource[];
  failureDiagnostics: Record<number, FailureDiagnostics | null>;
}) {
  if (sources.length === 0) {
    return (
      <div className="empty-state">
        <h2>No import records yet</h2>
        <p>Import June 2023 or June 2024 to create the first benchmark source record.</p>
      </div>
    );
  }

  return (
    <div className="status-table-wrap">
      <table className="status-table">
        <thead>
          <tr>
            <th scope="col">Paper</th>
            <th scope="col">Year</th>
            <th scope="col">Source status</th>
            <th scope="col">Paper status</th>
            <th scope="col">Timestamps</th>
            <th scope="col">Diagnostics</th>
            <th scope="col">Link</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const failure = failureDiagnostics[source.year] ?? null;
            const warnings = getQuestionWarnings(source);

            return (
              <tr key={source.id}>
                <td>
                  <strong>{source.paper?.title ?? `${source.examBoard} ${source.subject}`}</strong>
                  <br />
                  <span>{source.sessionLabel}</span>
                </td>
                <td>{source.year}</td>
                <td>
                  <span className="status-pill" data-status={source.status}>
                    {source.status}
                  </span>
                </td>
                <td>
                  {source.paper ? (
                    <span className="status-pill" data-status={source.paper.status}>
                      {source.paper.status} | {source.paper.totalMarks} marks
                    </span>
                  ) : (
                    <span className="status-pill">Not imported</span>
                  )}
                </td>
                <td>
                  <span className="status-time">
                    <span>Source: {formatDate(source.lastDiscoveredAt)}</span>
                    {source.paper ? <span>Imported: {formatDate(source.paper.importedAt)}</span> : null}
                  </span>
                </td>
                <td>
                  <div className="diagnostics-stack">
                    {failure ? (
                      <details className="diagnostics-details">
                        <summary>
                          <span className="status-pill" data-status="failed">
                            Last failure
                          </span>
                          <span>{formatFailureSummary(failure)}</span>
                        </summary>
                        <pre>{formatFailureDetails(failure)}</pre>
                      </details>
                    ) : (
                      <span className="diagnostics-muted">No stored failure report</span>
                    )}

                    {warnings.length > 0 ? (
                      <details className="diagnostics-details">
                        <summary>
                          <span className="status-pill" data-status="importing">
                            {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                          </span>
                          <span>Question import diagnostics</span>
                        </summary>
                        <ul className="diagnostics-list">
                          {warnings.map((warning) => (
                            <li key={`${warning.questionKey}-${warning.stage}-${warning.message}`}>
                              <strong>{warning.questionKey}</strong>: {warning.stage} - {warning.message}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <span className="diagnostics-muted">No question warnings</span>
                    )}
                  </div>
                </td>
                <td>
                  {source.paper ? (
                    <Link className="subtle-link" href={`/papers/${source.paper.id}`}>
                      Open paper
                    </Link>
                  ) : (
                    <span>Pending</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
