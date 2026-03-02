import type { FaqItem } from "../types/faq";

const FAQ_QUESTION_PATTERN = /^\*\*(\d+)\.\s*(.+?)\*\*$/;

export const parseFaqMarkdown = (markdown: string): FaqItem[] => {
  const lines = markdown.split("\n");
  const items: FaqItem[] = [];

  let currentQuestion = "";
  let currentId = "";
  let answerLines: string[] = [];

  const pushCurrentItem = () => {
    if (!currentQuestion) return;

    const answer = answerLines.join("\n").trim().replace(/\n{3,}/g, "\n\n");
    items.push({
      id: currentId,
      question: currentQuestion,
      answer,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const questionMatch = line.match(FAQ_QUESTION_PATTERN);

    if (questionMatch) {
      pushCurrentItem();
      currentId = questionMatch[1];
      currentQuestion = questionMatch[2].trim();
      answerLines = [];
      continue;
    }

    if (!currentQuestion) continue;
    answerLines.push(rawLine);
  }

  pushCurrentItem();
  return items;
};
