import { defineBuiltInSkill, finding, output } from "./shared";

const id = "source-of-truth";

export const sourceOfTruthSkill = defineBuiltInSkill({
  id,
  name: "Source of Truth",
  description: "Checks that the prompt preserves explicit source-governance signals.",
  execute({ buildInput, buildOutput }) {
    const findings = [];
    const isDocument = ["a4_document_portrait", "a4_pdf_portrait"].includes(buildInput.outputProfileId);

    if (!buildOutput.productionPrompt.trim()) {
      findings.push(finding(id, "empty-production-prompt", "The production prompt is empty.", "error"));
    }
    if (isDocument && !buildOutput.productionPrompt.includes("SOURCE OF TRUTH")) {
      findings.push(finding(id, "missing-source-of-truth-section", "The document prompt has no SOURCE OF TRUTH section.", "error"));
    }
    if (buildOutput.promptPreview.ignoredLegacySections.length > 0) {
      findings.push(finding(id, "legacy-sections-ignored", "Legacy source sections were ignored during compilation.", "info"));
    }

    return output(id, findings);
  },
});
