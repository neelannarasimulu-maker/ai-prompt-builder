/** Phase 15B: Recommendation Specificity - Change type and target classification */

export type FindingChangeType = "Content" | "Code" | "Config" | "Asset" | "Generated Output";

export type FindingTarget =
  | "Image Brief"
  | "Visible Text"
  | "LinkedIn Post Text"
  | "Source Of Truth"
  | "Brand rules"
  | "Project settings"
  | "Output settings"
  | "Brand asset"
  | "Project asset"
  | "Selected generated file"
  | "Review UI placement"
  | "Generated file";

export type SpecificFinding = {
  changeType: FindingChangeType;
  target: FindingTarget;
  reason: string;
  suggestedAction: string;
};

const findingPatterns: Array<{
  pattern: RegExp;
  changeType: FindingChangeType;
  target: FindingTarget;
}> = [
  // Content - Image Brief
  { pattern: /image[- ]brief|imagery|visual composition|background image|subject composition/, changeType: "Content", target: "Image Brief" },
  // Content - Visible Text
  { pattern: /visible[- ]text|text density|too much text|placeholder text|on[- ]image text/, changeType: "Content", target: "Visible Text" },
  // Content - LinkedIn Post Text
  { pattern: /linkedin|post text|social post|caption|post copy/, changeType: "Content", target: "LinkedIn Post Text" },
  // Content - Source Of Truth
  { pattern: /source[- ]of[- ]truth|source content|document source|body content|fidelity|core content/, changeType: "Content", target: "Source Of Truth" },
  // Config - Brand rules
  { pattern: /brand identity|approved assets|brand presentation|logo rule|colour rule|color rule|typography rule|header rule|footer rule/, changeType: "Config", target: "Brand rules" },
  // Config - Project settings
  { pattern: /project setting|project rule|output contract|format constraint|layout constraint|render constraint/, changeType: "Config", target: "Project settings" },
  // Config - Output settings
  { pattern: /output dimension|resolution|file type|export format|rendering option/, changeType: "Config", target: "Output settings" },
  // Asset - Brand logo
  { pattern: /brand asset missing|brand logo missing|logo asset|logo file/, changeType: "Asset", target: "Brand asset" },
  // Asset - Project asset
  { pattern: /project asset missing|project file missing/, changeType: "Asset", target: "Project asset" },
  // Generated Output
  { pattern: /select.*generated|review.*generated|compare.*output|generated file|generated output/, changeType: "Generated Output", target: "Selected generated file" },
  // Code - Review UI
  { pattern: /review.*appear|ui placement|review tab/, changeType: "Code", target: "Review UI placement" },
];

export function classifyFinding(code: string, message: string, source: string): SpecificFinding | null {
  const searchable = `${code} ${message} ${source}`.toLowerCase();

  for (const { pattern, changeType, target } of findingPatterns) {
    if (pattern.test(searchable)) {
      return {
        changeType,
        target,
        reason: message,
        suggestedAction: deriveSuggestedAction(changeType, target, message),
      };
    }
  }

  // Default fallback
  return {
    changeType: "Content",
    target: "Source Of Truth",
    reason: message,
    suggestedAction: "Review and update the source content to address this finding.",
  };
}

function deriveSuggestedAction(changeType: FindingChangeType, target: FindingTarget, message: string): string {
  switch (changeType) {
    case "Content":
      return `Update the ${target} section to address this finding.`;
    case "Code":
      return `This is a code-level issue. ${message}`;
    case "Config":
      return `Update project or brand settings for ${target}.`;
    case "Asset":
      return `Select or upload the required ${target}.`;
    case "Generated Output":
      return `${message}`;
    default:
      return "Review and address this finding.";
  }
}
