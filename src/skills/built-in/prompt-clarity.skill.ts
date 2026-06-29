import { defineBuiltInSkill, finding, output } from "./shared";

const id = "prompt-clarity";

export const promptClaritySkill = defineBuiltInSkill({
  id,
  name: "Prompt Clarity",
  description: "Surfaces existing warnings and empty prompt statistics as advisory findings.",
  execute({ buildOutput }) {
    const findings = buildOutput.warnings.map((warning, index) =>
      finding(id, `compiler-warning-${index + 1}`, warning, "info")
    );

    if (buildOutput.promptStats.words === 0) {
      findings.push(finding(id, "empty-prompt-statistics", "The compiled prompt contains no words.", "error"));
    }

    return output(id, findings);
  },
});
