import type {
  PromptBuildInput,
  PromptBuildOutput,
} from "../core/prompt-builder/prompt-build-types";
import type { QualityFinding } from "../quality/types";

export type SkillSideEffectLevel = "none" | "read" | "write";

export type SkillInputSchema<TInput> = {
  readonly type: string;
  validate(value: unknown): value is TInput;
};

export type PromptSkillInput = {
  buildInput: PromptBuildInput;
  buildOutput: PromptBuildOutput;
};

export type SkillFinding = QualityFinding;

export type SkillOutput = {
  skillId: string;
  findings: SkillFinding[];
};

export interface PromptQualitySkill<TInput = PromptSkillInput> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly inputSchema: SkillInputSchema<TInput>;
  readonly deterministic: boolean;
  readonly sideEffectLevel: SkillSideEffectLevel;
  execute(input: TInput): SkillOutput;
}
