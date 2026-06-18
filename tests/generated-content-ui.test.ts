import { describe, expect, it } from "vitest";
import {
  basenameWithoutExtension,
  copyableFilename,
  enrichGeneratedContentFile,
  getGeneratedFileDisplayName,
  getGeneratedFileVersionLabel,
  type GeneratedContentFile,
} from "../src/lib/prompt-builder/project-generated-content-api";

function file(input: Partial<GeneratedContentFile>): GeneratedContentFile {
  return {
    id: input.id || "content/projects/demo/generated-content/visuals/Version 1.0/01-demo.png",
    filename: input.filename || "01-demo.png",
    displayName: input.displayName || "",
    relativePath: input.relativePath || "content/projects/demo/generated-content/visuals/Version 1.0/01-demo.png",
    generatedRelativePath: input.generatedRelativePath || "visuals/Version 1.0/01-demo.png",
    category: input.category || "visuals",
    versionLabel: input.versionLabel,
    fileUrl: input.fileUrl || "/project-generated-content/content/projects/demo/generated-content/visuals/Version 1.0/01-demo.png",
    fileType: input.fileType || "image",
    sizeBytes: input.sizeBytes || 1024,
    modifiedAt: input.modifiedAt || "2026-06-12T00:00:00.000Z",
  };
}

describe("generated content UI helpers", () => {
  it("copies filenames without extensions", () => {
    expect(copyableFilename("01-thenga-introduction.png")).toBe("01-thenga-introduction");
    expect(copyableFilename("Client Deck v1.1.pptx")).toBe("Client Deck v1.1");
  });

  it("normalizes duplicate image extensions for display", () => {
    expect(basenameWithoutExtension("07-product-operational-items.png.png")).toBe("07-product-operational-items");
    expect(getGeneratedFileDisplayName({ filename: "07-product-operational-items.png.png" })).toBe("07 product operational items");
  });

  it("parses generated visual version folders", () => {
    expect(getGeneratedFileVersionLabel("visuals/Version 1.0/01-demo.png")).toBe("Version 1.0");
    expect(getGeneratedFileVersionLabel("visuals/Version 1.1/01-demo.png")).toBe("Version 1.1");
    expect(getGeneratedFileVersionLabel("visuals/01-demo.png")).toBeUndefined();
  });

  it("supports filtering one version without combining folders", () => {
    const files = [
      enrichGeneratedContentFile(file({ id: "v1", generatedRelativePath: "visuals/Version 1.0/01-demo.png" })),
      enrichGeneratedContentFile(file({ id: "v2", generatedRelativePath: "visuals/Version 1.1/01-demo.png" })),
      enrichGeneratedContentFile(file({ id: "plain", generatedRelativePath: "visuals/01-demo.png" })),
    ];

    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "Version 1.0").map((item) => item.id)).toEqual(["v1"]);
    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "Version 1.1").map((item) => item.id)).toEqual(["v2"]);
    expect(files.filter((item) => (item.versionLabel || "Unversioned") === "Unversioned").map((item) => item.id)).toEqual(["plain"]);
  });
});
