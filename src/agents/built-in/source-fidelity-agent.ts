import { defineSkillAgent } from "./shared";

export const sourceFidelityAgent = defineSkillAgent({
  id: "source-fidelity-agent",
  name: "Source Fidelity Agent",
  role: "Source integrity reviewer",
  description: "Checks that source-of-truth signals remain explicit and complete.",
  skillsUsed: ["source-of-truth"],
});
