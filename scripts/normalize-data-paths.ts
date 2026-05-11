import { assetPathFromDataRoot, isDataAssetPath } from "@/lib/assets/paths";
import { db } from "@/lib/db";

function normalizePath(storedPath: string) {
  return isDataAssetPath(storedPath) ? storedPath : assetPathFromDataRoot(storedPath);
}

const papers = await db.paper.findMany({
  select: {
    id: true,
    questionPaperAssetPath: true,
    markSchemeAssetPath: true,
  },
});

for (const paper of papers) {
  await db.paper.update({
    where: { id: paper.id },
    data: {
      questionPaperAssetPath: normalizePath(paper.questionPaperAssetPath),
      markSchemeAssetPath: normalizePath(paper.markSchemeAssetPath),
    },
  });
}

const questions = await db.question.findMany({
  select: {
    id: true,
    primaryCropPath: true,
    supportingAssetPaths: true,
  },
});

for (const question of questions) {
  const supportingAssetPaths = JSON.parse(question.supportingAssetPaths) as string[];

  await db.question.update({
    where: { id: question.id },
    data: {
      primaryCropPath: normalizePath(question.primaryCropPath),
      supportingAssetPaths: JSON.stringify(supportingAssetPaths.map(normalizePath)),
    },
  });
}

await db.$disconnect();
