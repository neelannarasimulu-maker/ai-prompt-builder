export type RemediationCategory =
  | "source-content"
  | "brand-rules"
  | "output-contract"
  | "prompt-clarity"
  | "document-rules"
  | "visual-rules"
  | "linkedin-rules";

export type RemediationSuggestion = {
  id: string;
  findingCode: string;
  source: string;
  category: RemediationCategory;
  title: string;
  suggestedFix: string;
};
