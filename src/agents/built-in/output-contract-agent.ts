import { defineSkillAgent } from "./shared";

export const outputContractAgent = defineSkillAgent({
  id: "output-contract-agent",
  name: "Output Contract Agent",
  role: "Output contract reviewer",
  description: "Checks output contracts and channel-specific deterministic rules.",
  skillsUsed: ["output-contract", "document-rules", "visual-rules", "linkedin-rules"],
});
