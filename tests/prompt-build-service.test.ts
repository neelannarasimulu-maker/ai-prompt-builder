import { describe, expect, it } from "vitest";
import { LegacyCompilerAdapter } from "../src/core/prompt-builder/legacy-compiler-adapter";
import { PromptBuildService } from "../src/core/prompt-builder/prompt-build-service";
import type { PromptBuildInput } from "../src/core/prompt-builder/prompt-build-types";
import { compilePrompt, contentItems } from "../src/lib/prompt-builder";

const fixtures = [
  {
    path: "content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md",
    outputProfileId: "landscape_image_16_9",
  },
  {
    path: "content/projects/rainfin/client-contracting/documents/template-document-pack/rainfin-transaction-document-template.md",
    outputProfileId: "a4_document_portrait",
  },
  {
    path: "content/projects/supplysync360/brand-positioning/linkedin/public-campaign-set/01-lead-time-volatility.md",
    outputProfileId: "linkedin_asset_4_5",
  },
] as const;

function inputFor(path: string, outputProfileId: string): PromptBuildInput {
  const content = contentItems.find((item) => item.path.endsWith(path));
  if (!content) throw new Error(`Missing parity fixture: ${path}`);

  return {
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId,
  };
}

describe("PromptBuildService parity", () => {
  const adapter = new LegacyCompilerAdapter();
  const service = new PromptBuildService(adapter);

  for (const fixture of fixtures) {
    it(`matches direct compilePrompt output for ${fixture.outputProfileId}`, () => {
      const input = inputFor(fixture.path, fixture.outputProfileId);
      const direct = compilePrompt(input);
      const adapted = adapter.compile(input);
      const serviced = service.build(input);

      expect(adapted).toEqual(direct);
      expect(serviced).toEqual(direct);
      expect(JSON.stringify(adapted)).toBe(JSON.stringify(direct));
      expect(JSON.stringify(serviced)).toBe(JSON.stringify(direct));
    });
  }
});
