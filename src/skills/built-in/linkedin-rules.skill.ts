import { defineBuiltInSkill, finding, output } from "./shared";

const id = "linkedin-rules";

export const linkedInRulesSkill = defineBuiltInSkill({
  id,
  name: "LinkedIn Rules",
  description: "Checks separation between LinkedIn caption text and image-generation instructions.",
  execute({ buildInput, buildOutput }) {
    if (buildInput.outputProfileId !== "linkedin_asset_4_5") return output(id, []);

    const findings = [];
    const postText = buildOutput.promptPreview.linkedinPostText.trim();
    if (!postText) {
      findings.push(finding(id, "missing-linkedin-post-text", "No LinkedIn post text is available."));
    } else if (buildOutput.productionPrompt.includes(postText)) {
      findings.push(finding(id, "linkedin-post-in-image-prompt", "LinkedIn post text appears in the image prompt.", "error"));
    }

    return output(id, findings);
  },
});
