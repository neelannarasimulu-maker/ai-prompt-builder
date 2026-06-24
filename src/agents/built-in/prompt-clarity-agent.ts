import { defineSkillAgent } from "./shared";

export const promptClarityAgent = defineSkillAgent({
  id: "prompt-clarity-agent",
  name: "Prompt Clarity Agent",
  role: "Prompt clarity reviewer",
  description: "Surfaces existing compiler warnings and clarity concerns.",
  skillsUsed: ["prompt-clarity"],
});
