import { describe, expect, it } from "vitest";
import {
  basenameWithoutExtension,
  copyableFilename,
  enrichGeneratedContentFile,
  getGeneratedFileDisplayName,
  getGeneratedFileVersionLabel,
  generatedContentCategories,
  generatedCategoryForProfile,
  type GeneratedContentFile,
} from "../src/lib/prompt-builder/project-generated-content-api";
import { getDeliveryPackFilenameBase } from "../src/lib/prompt-builder/output-naming";

function file(input: Partial<GeneratedContentFile>): GeneratedContentFile {
  return {
    id: input.id || "content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
    filename: input.filename || "01-demo.png",
    displayName: input.displayName || "",
    relativePath: input.relativePath || "content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
    generatedRelativePath: input.generatedRelativePath || "visuals/default-visual-set/_generated/v001/01-demo.png",
    category: input.category || "visuals",
    contentSet: input.contentSet || "default-visual-set",
    versionLabel: input.versionLabel,
    fileUrl: input.fileUrl || "/project-generated-content/content/projects/demo/visuals/default-visual-set/_generated/v001/01-demo.png",
    fileType: input.fileType || "image",
    sizeBytes: input.sizeBytes || 1024,
    modifiedAt: input.modifiedAt || "2026-06-12T00:00:00.000Z",
  };
}

describe("generated content UI helpers", () => {
  it("exposes only documents, LinkedIn and visuals as generated folders", () => {
    expect(generatedContentCategories.map((category) => category.id)).toEqual(["all", "visuals", "documents", "linkedin"]);
    expect(generatedCategoryForProfile({ outputType: "pdf", profileId: "a4_pdf" })).toBe("documents");
    expect(generatedCategoryForProfile({ outputType: "email", profileId: "email" })).toBe("documents");
    expect(generatedCategoryForProfile({ outputType: "text", profileId: "linkedin_post_text" })).toBe("linkedin");
  });

  it("copies filenames without extensions", () => {
    expect(copyableFilename("01-thenga-introduction.png")).toBe("01-thenga-introduction");
    expect(copyableFilename("Client Deck v1.1.pptx")).toBe("Client Deck v1.1");
  });

  it("normalizes duplicate image extensions for display", () => {
    expect(basenameWithoutExtension("07-product-operational-items.png.png")).toBe("07-product-operational-items");
    expect(getGeneratedFileDisplayName({ filename: "07-product-operational-items.png.png" })).toBe("07 product operational items");
  });

  it("parses generated visual version folders", () => {
    expect(getGeneratedFileVersionLabel("visuals/deck/_generated/v001/01-demo.png")).toBe("v001");
    expect(getGeneratedFileVersionLabel("visuals/deck/_generated/v002/01-demo.png")).toBe("v002");
    expect(getGeneratedFileVersionLabel("visuals/01-demo.png")).toBeUndefined();
  });

  it("supports filtering one version without combining folders", () => {
    const files = [
      enrichGeneratedContentFile(file({ id: "v1", generatedRelativePath: "visuals/deck/_generated/v001/01-demo.png" })),
      enrichGeneratedContentFile(file({ id: "v2", generatedRelativePath: "visuals/deck/_generated/v002/01-demo.png" })),
      enrichGeneratedContentFile(file({ id: "plain", generatedRelativePath: "visuals/01-demo.png" })),
    ];

    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "v001").map((item) => item.id)).toEqual(["v1"]);
    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "v002").map((item) => item.id)).toEqual(["v2"]);
    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "Unversioned").map((item) => item.id)).toEqual(["plain"]);
  });

  it("names delivery exports from brand, project and version", () => {
    expect(getDeliveryPackFilenameBase({
      brandLabel: "Thenga",
      projectLabel: "Standard Bank Pitch",
      versionLabel: "Version 03",
    })).toBe("thenga-standard-bank-pitch-version-03");

    expect(getDeliveryPackFilenameBase({
      brandLabel: "SupplySync360",
      projectLabel: "Executive Overview",
      versionLabel: "Version 1.0",
    })).toBe("supplysync360-executive-overview-version-1-0");
  });
});
