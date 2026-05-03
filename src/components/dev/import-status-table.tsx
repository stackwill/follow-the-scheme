import Link from "next/link";
import type { Paper, PaperSource } from "@prisma/client";

type ImportStatusSource = PaperSource & {
  paper: Pick<Paper, "id" | "title" | "status" | "importedAt" | "totalMarks"> | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ImportStatusTable({ sources }: { sources: ImportStatusSource[] }) {
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
            <th scope="col">Last updated</th>
            <th scope="col">Link</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
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
              <td>{formatDate(source.paper?.importedAt ?? source.lastDiscoveredAt)}</td>
              <td>
                {source.paper ? <Link href={`/papers/${source.paper.id}`}>Open paper</Link> : <span>Pending</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
