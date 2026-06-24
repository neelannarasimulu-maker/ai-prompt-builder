import { defineBuiltInSkill, finding, output } from "./shared";

const id = "document-rules";
const documentProfiles = new Set(["a4_document_portrait", "a4_pdf_portrait"]);

export const documentRulesSkill = defineBuiltInSkill({
  id,
  name: "Document Rules",
  description: "Checks existing deterministic document-production requirements.",
  execute({ buildInput, buildOutput }) {
    if (!documentProfiles.has(buildInput.outputProfileId)) return output(id, []);

    const findings = [];
    for (const heading of ["TASK", "SOURCE OF TRUTH", "OUTPUT PROFILE", "DOCUMENT RENDERING RULES"]) {
      if (!buildOutput.productionPrompt.includes(`${heading}\n`)) {
        findings.push(finding(id, "missing-document-heading", `Document prompt is missing ${heading}.`, "error"));
      }
    }
    if (!buildOutput.documentPromptParts.sourceMarkdown.trim()) {
      findings.push(finding(id, "missing-document-source", "No document source Markdown is available.", "error"));
    }

    return output(id, findings);
  },
});
