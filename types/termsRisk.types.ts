export type TermsRiskSection = {
  id: string;
  heading: string;
  body: string;
};

export type TermsRiskDocument = {
  title: string;
  intro: string;
  sections: TermsRiskSection[];
};
