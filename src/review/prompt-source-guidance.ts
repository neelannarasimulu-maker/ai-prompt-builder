export type SourceGuidanceConfidence = "high" | "medium" | "low";

export type SourceGuidanceSection =
  | "Source Of Truth"
  | "Visible Text"
  | "Image Brief"
  | "LinkedIn Post Text"
  | "Brand rules"
  | "Output rules"
  | "Project settings";

export type SourceFixGuidance = {
  issueId: string;
  likelySourceSection: SourceGuidanceSection;
  reason: string;
  suggestedEditGuidance: string;
  confidence: SourceGuidanceConfidence;
};

export type SourceGuidanceInput = {
  id: string;
  code: string;
  message: string;
  sources: string[];
};

type GuidanceRule = {
  section: SourceGuidanceSection;
  confidence: SourceGuidanceConfidence;
  reason: string;
  guidance: string;
  matches: (searchable: string) => boolean;
};

const rules: GuidanceRule[] = [
  {
    section: "Image Brief",
    confidence: "high",
    reason: "This finding concerns the visual composition or imagery instructions used to build the output.",
    guidance: "Update the Image Brief with the required subject, composition, imagery, or visual constraints.",
    matches: (value) => /image[- ]brief|imagery|visual composition|background image/.test(value),
  },
  {
    section: "Visible Text",
    confidence: "high",
    reason: "This finding concerns text that must appear visibly in the generated visual or slide.",
    guidance: "Edit Visible Text so the required copy is explicit, concise, and free of placeholders.",
    matches: (value) => /visible[- ]text|text density|too much text|placeholder text/.test(value),
  },
  {
    section: "LinkedIn Post Text",
    confidence: "high",
    reason: "This finding concerns the copy published alongside the LinkedIn asset.",
    guidance: "Revise LinkedIn Post Text to include the missing message, structure, or publishing requirement.",
    matches: (value) => /linkedin|post text|social post/.test(value),
  },
  {
    section: "Brand rules",
    confidence: "high",
    reason: "This finding concerns brand identity, approved assets, or brand presentation rules.",
    guidance: "Update the brand rules or select the correct approved logo, colour, typography, header, or footer asset.",
    matches: (value) => /brand|logo|colour|color|typography|header|footer/.test(value),
  },
  {
    section: "Source Of Truth",
    confidence: "high",
    reason: "This finding concerns factual source content or required document body material.",
    guidance: "Add or correct the authoritative content in Source Of Truth, then run the review again.",
    matches: (value) => /source[- ]of[- ]truth|source content|document source|body content|fidelity/.test(value),
  },
  {
    section: "Output rules",
    confidence: "medium",
    reason: "This finding concerns the required output contract, format, layout, or rendering constraints.",
    guidance: "Clarify the applicable output rules so the expected format and constraints are unambiguous.",
    matches: (value) => /output|contract|format|layout|render|dimension|resolution|file type/.test(value),
  },
  {
    section: "Project settings",
    confidence: "medium",
    reason: "This finding appears to depend on project-level configuration rather than content copy.",
    guidance: "Review the project settings and selected assets for the current content item.",
    matches: (value) => /project|filename|setting|profile|asset selection/.test(value),
  },
];

export function createSourceFixGuidance(issue: SourceGuidanceInput): SourceFixGuidance {
  const searchable = [issue.code, issue.message, ...issue.sources].join(" ").toLowerCase();
  const match = rules.find((rule) => rule.matches(searchable));

  if (match) {
    return {
      issueId: issue.id,
      likelySourceSection: match.section,
      reason: match.reason,
      suggestedEditGuidance: match.guidance,
      confidence: match.confidence,
    };
  }

  return {
    issueId: issue.id,
    likelySourceSection: "Project settings",
    reason: "The finding does not identify a single content section with certainty.",
    suggestedEditGuidance: "Review the selected project, content source, and output profile to locate the missing requirement.",
    confidence: "low",
  };
}
