export type DataReleaseManifest = ReturnType<typeof buildDataReleaseManifest>;

export function buildDataReleaseManifest(input: {
  releaseName: string;
  gitCommit: string;
  appDbSha256: string;
  cropFileCount: number;
  paperCount: number;
  questionCount: number;
}) {
  return {
    schemaVersion: 1,
    releaseName: input.releaseName,
    createdAt: new Date().toISOString(),
    gitCommit: input.gitCommit,
    files: {
      appDb: {
        path: "app.db",
        sha256: input.appDbSha256,
      },
    },
    counts: {
      crops: input.cropFileCount,
      papers: input.paperCount,
      questions: input.questionCount,
    },
  };
}
