import { defineBuiltInSkill, finding, output } from "./shared";

const id = "output-contract";

export const outputContractSkill = defineBuiltInSkill({
  id,
  name: "Output Contract",
  description: "Checks the existing compiled output aliases and render contract.",
  execute({ buildOutput }) {
    const findings = [];

    if (buildOutput.prompt !== buildOutput.productionPrompt) {
      findings.push(finding(id, "prompt-alias-mismatch", "The backwards-compatible prompt alias differs from productionPrompt.", "error"));
    }
    if (!buildOutput.contractPrompt.trim()) {
      findings.push(finding(id, "missing-contract-prompt", "The compiled contract prompt is empty."));
    }
    if (!buildOutput.renderContract) {
      findings.push(finding(id, "missing-render-contract", "No render contract is available.", "error"));
    }

    return output(id, findings);
  },
});
