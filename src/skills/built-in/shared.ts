import type {
  PromptQualitySkill,
  PromptSkillInput,
  SkillFinding,
  SkillOutput,
} from "../types";

export const promptSkillInputSchema = {
  type: "PromptSkillInput",
  validate(value: unknown): value is PromptSkillInput {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<PromptSkillInput>;
    return Boolean(
      candidate.buildInput &&
      typeof candidate.buildInput.outputProfileId === "string" &&
      candidate.buildOutput &&
      typeof candidate.buildOutput.productionPrompt === "string"
    );
  },
};

export function finding(
  skillId: string,
  code: string,
  message: string,
  severity: SkillFinding["severity"] = "warning"
): SkillFinding {
  return { code, message, severity, source: skillId };
}

export function output(skillId: string, findings: SkillFinding[]): SkillOutput {
  return { skillId, findings };
}

export function defineBuiltInSkill(
  definition: Omit<PromptQualitySkill, "inputSchema" | "deterministic" | "sideEffectLevel">
): PromptQualitySkill {
  return {
    ...definition,
    inputSchema: promptSkillInputSchema,
    deterministic: true,
    sideEffectLevel: "none",
  };
}
