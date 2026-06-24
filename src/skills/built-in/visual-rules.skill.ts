import { defineBuiltInSkill, finding, output } from "./shared";

const id = "visual-rules";

export const visualRulesSkill = defineBuiltInSkill({
  id,
  name: "Visual Rules",
  description: "Checks existing exact-text and visual-layout signals.",
  execute({ buildInput, buildOutput }) {
    if (!["landscape_image_16_9", "linkedin_asset_4_5"].includes(buildInput.outputProfileId)) {
      return output(id, []);
    }

    const findings = [];
    if (!buildOutput.promptPreview.visibleText.trim()) {
      findings.push(finding(id, "missing-visible-text", "No exact visible text is available.", "error"));
    }
    if (!buildOutput.dynamicLayoutPlan?.layoutPresetId) {
      findings.push(finding(id, "missing-layout-plan", "No deterministic layout plan is resolved.", "error"));
    }

    return output(id, findings);
  },
});
