import { describe, expect, it } from "vitest";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import {
  builtInSkills,
  createBuiltInSkillRegistry,
  SkillRegistry,
} from "../src/skills/skill-registry";
import { contentItems } from "../src/lib/prompt-builder";

function fixture() {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md")
  );
  if (!content) throw new Error("Missing skills fixture.");

  const buildInput = {
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId: "landscape_image_16_9",
  };

  return {
    buildInput,
    buildOutput: new PromptBuildService().build(buildInput),
  };
}

describe("skills framework", () => {
  it("registers every built-in skill with advisory metadata", () => {
    const registry = createBuiltInSkillRegistry();

    expect(registry.list()).toHaveLength(7);
    expect(registry.list().map((skill) => skill.id)).toEqual(builtInSkills.map((skill) => skill.id));
    for (const skill of registry.list()) {
      expect(skill.deterministic).toBe(true);
      expect(skill.sideEffectLevel).toBe("none");
      expect(skill.inputSchema.type).toBe("PromptSkillInput");
    }
  });

  it("rejects duplicate skill IDs", () => {
    expect(() => new SkillRegistry([builtInSkills[0], builtInSkills[0]]))
      .toThrow("Skill ID is already registered");
  });

  it("executes deterministically", () => {
    const registry = createBuiltInSkillRegistry();
    const input = fixture();

    for (const skill of registry.list()) {
      expect(registry.execute(skill.id, input)).toEqual(registry.execute(skill.id, input));
    }
  });

  it("returns the skill output shape with attributed findings", () => {
    const registry = createBuiltInSkillRegistry();

    for (const skill of registry.list()) {
      const result = registry.execute(skill.id, fixture());
      expect(result.skillId).toBe(skill.id);
      expect(Array.isArray(result.findings)).toBe(true);
      for (const finding of result.findings) {
        expect(finding.source).toBe(skill.id);
        expect(["error", "warning", "info"]).toContain(finding.severity);
      }
    }
  });
});
