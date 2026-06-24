import { defineSkillAgent } from "./shared";

export const brandGuardianAgent = defineSkillAgent({
  id: "brand-guardian-agent",
  name: "Brand Guardian Agent",
  role: "Brand consistency reviewer",
  description: "Checks resolved brand assets, colours and project chrome.",
  skillsUsed: ["brand-consistency"],
});
