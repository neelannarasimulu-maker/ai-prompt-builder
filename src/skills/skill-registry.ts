import { brandConsistencySkill } from "./built-in/brand-consistency.skill";
import { documentRulesSkill } from "./built-in/document-rules.skill";
import { linkedInRulesSkill } from "./built-in/linkedin-rules.skill";
import { outputContractSkill } from "./built-in/output-contract.skill";
import { promptClaritySkill } from "./built-in/prompt-clarity.skill";
import { sourceOfTruthSkill } from "./built-in/source-of-truth.skill";
import { visualRulesSkill } from "./built-in/visual-rules.skill";
import type {
  PromptQualitySkill,
  PromptSkillInput,
  SkillOutput,
} from "./types";

export const builtInSkills: PromptQualitySkill[] = [
  sourceOfTruthSkill,
  brandConsistencySkill,
  outputContractSkill,
  promptClaritySkill,
  documentRulesSkill,
  visualRulesSkill,
  linkedInRulesSkill,
];

export class SkillRegistry {
  private readonly skills = new Map<string, PromptQualitySkill>();

  constructor(initialSkills: PromptQualitySkill[] = []) {
    for (const skill of initialSkills) this.register(skill);
  }

  register(skill: PromptQualitySkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill ID is already registered: ${skill.id}`);
    }
    this.skills.set(skill.id, skill);
  }

  get(id: string): PromptQualitySkill | undefined {
    return this.skills.get(id);
  }

  list(): PromptQualitySkill[] {
    return Array.from(this.skills.values());
  }

  execute(id: string, input: PromptSkillInput): SkillOutput {
    const skill = this.skills.get(id);
    if (!skill) throw new Error(`Unknown skill ID: ${id}`);
    if (!skill.inputSchema.validate(input)) {
      throw new Error(`Invalid input for skill: ${id}`);
    }
    return skill.execute(input);
  }
}

export function createBuiltInSkillRegistry(): SkillRegistry {
  return new SkillRegistry(builtInSkills);
}
