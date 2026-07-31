export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type FaqSectionProps = {
  /** Opens the shared 10 Covenants dialog from FAQ hash links. */
  onOpenCovenants: () => void;
};
