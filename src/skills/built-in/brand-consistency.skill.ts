import { defineBuiltInSkill, finding, output } from "./shared";

const id = "brand-consistency";

export const brandConsistencySkill = defineBuiltInSkill({
  id,
  name: "Brand Consistency",
  description: "Reports missing resolved brand assets and project chrome.",
  execute({ buildOutput }) {
    const preview = buildOutput.promptPreview;
    const findings = [];

    if (!preview.logoAsset) findings.push(finding(id, "missing-logo", "No logo asset is resolved."));
    if (!preview.headerText) findings.push(finding(id, "missing-header", "No header text is resolved."));
    if (!preview.footerText) findings.push(finding(id, "missing-footer", "No footer text is resolved."));
    if (!preview.brandColours) findings.push(finding(id, "missing-brand-colours", "No explicit brand colours are resolved."));

    return output(id, findings);
  },
});
