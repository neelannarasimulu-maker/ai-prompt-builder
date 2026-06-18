import { describe, expect, it } from "vitest";
import {
  getDefaultRpaVersionLabel,
  normalizeRpaImageFilename,
  normalizeRpaVersionLabel,
  validateRpaStartInput,
} from "../src/lib/prompt-builder/chatgpt-rpa";
import type { GeneratedContentFile } from "../src/lib/prompt-builder/project-generated-content-api";

function visualFile(input: Partial<GeneratedContentFile>): GeneratedContentFile {
  return {
    id: input.id || "v1",
    filename: input.filename || "01-demo.png",
    displayName: input.displayName || "01 demo",
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

describe("ChatGPT RPA helpers", () => {
  it("rejects invalid start payloads before browser automation starts", () => {
    expect(validateRpaStartInput({
      outputType: "document",
      prompt: "",
      projectFolder: "",
      outputFilename: "",
      logoAsset: "",
      versionLabel: "",
    })).toEqual([
      "Only image outputs can run through ChatGPT visual automation.",
      "A compiled prompt is required.",
      "Project folder is required.",
      "Output filename is required.",
      "Resolved logo asset is required.",
      "Target version folder is required.",
    ]);
  });

  it("chooses the active visual version or newest generated visual version", () => {
    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "Version 1.1",
      generatedFiles: [],
    })).toBe("Version 1.1");

    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "",
      generatedFiles: [
        visualFile({ versionLabel: "Version 1.0" }),
        visualFile({ id: "v2", versionLabel: "Version 1.2" }),
      ],
    })).toBe("Version 1.2");

    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "Unversioned",
      generatedFiles: [],
    })).toBe("Version 1.0");
  });

  it("normalizes target version folders and output filenames", () => {
    expect(normalizeRpaVersionLabel("Version 1.0/unsafe")).toBe("Version 1.0-unsafe");
    expect(normalizeRpaVersionLabel("Unversioned")).toBe("Version 1.0");
    expect(normalizeRpaImageFilename("01-slide.png.png")).toBe("01-slide.png");
    expect(normalizeRpaImageFilename("02-slide")).toBe("02-slide.png");
    expect(normalizeRpaImageFilename("03-slide.JPG")).toBe("03-slide.jpg");
  });
});
