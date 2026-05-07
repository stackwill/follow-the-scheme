export type QuestionGroupPaper = {
  adapterKey: string;
};

export type QuestionGroupQuestion = {
  questionKey: string;
};

function numericQuestionKey(questionKey: string) {
  return /^\d+$/.test(questionKey) ? Number(questionKey) : null;
}

export function questionGroupKey(paper: QuestionGroupPaper, question: QuestionGroupQuestion) {
  const questionNumber = numericQuestionKey(question.questionKey);

  if (
    paper.adapterKey.startsWith("ocr-gcse-business-paper-") &&
    questionNumber !== null &&
    questionNumber >= 1 &&
    questionNumber <= 15
  ) {
    const groupStart = Math.floor((questionNumber - 1) / 5) * 5 + 1;
    const groupEnd = groupStart + 4;

    return `${groupStart}-${groupEnd}`;
  }

  return question.questionKey.split(".")[0] ?? question.questionKey;
}

export function uniqueQuestionGroups<T extends QuestionGroupQuestion>(
  paper: QuestionGroupPaper,
  questions: T[],
) {
  const groups: Array<{ key: string; firstQuestion: T; questions: T[] }> = [];

  for (const question of questions) {
    const key = questionGroupKey(paper, question);
    const existingGroup = groups.at(-1);

    if (existingGroup?.key === key) {
      existingGroup.questions.push(question);
    } else {
      groups.push({ key, firstQuestion: question, questions: [question] });
    }
  }

  return groups;
}
