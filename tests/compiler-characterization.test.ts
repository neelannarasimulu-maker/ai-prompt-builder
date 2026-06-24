import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { compilePrompt, contentItems } from "../src/lib/prompt-builder";

function compileRegistered(pathSuffix: string, outputProfileId: string) {
  const content = contentItems.find((item) => item.path.endsWith(pathSuffix));
  if (!content) throw new Error(`Missing characterization fixture: ${pathSuffix}`);

  return compilePrompt({
    brandId: content.brandId,
    projectId: content.projectId,
    contentId: content.id,
    outputProfileId,
  });
}

function resultHash(result: ReturnType<typeof compilePrompt>): string {
  return createHash("sha256").update(JSON.stringify(result), "utf8").digest("hex");
}

describe("compiler characterization", () => {
  it("preserves the complete visual compiler result", () => {
    const result = compileRegistered(
      "content/projects/supplysync360/brand-positioning/visuals/executive-overview-set/01-business-overview.md",
      "landscape_image_16_9"
    );

    expect(resultHash(result)).toBe("7e17e3f1c0ec267556080e91f9947d3f7a37583be8d8f3d04dd60391a3b45aaa");
  });

  it("preserves the complete document compiler result", () => {
    const result = compileRegistered(
      "content/projects/rainfin/client-contracting/documents/template-document-pack/rainfin-transaction-document-template.md",
      "a4_document_portrait"
    );

    expect(resultHash(result)).toBe("e6fe7a29d26c5676e1a15f17786fcca1221c51c1f2b3621583f583f6e108e4ab");
  });

  it("preserves the complete LinkedIn compiler result", () => {
    const result = compileRegistered(
      "content/projects/supplysync360/brand-positioning/linkedin/public-campaign-set/01-lead-time-volatility.md",
      "linkedin_asset_4_5"
    );

    expect(resultHash(result)).toBe("b50d168d5b6a70ad94e96e4a8884cc9135933c63e528349995b6f6d9c6ebdbe6");
  });
});
