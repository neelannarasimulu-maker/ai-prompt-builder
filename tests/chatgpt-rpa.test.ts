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
      "Content set is required.",
      "Output filename is required.",
      "Output profile is required.",
      "Resolved logo asset is required.",
      "Target version folder is required.",
    ]);
  });

  it("chooses the active visual version or newest generated visual version", () => {
    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "v002",
      generatedFiles: [],
    })).toBe("v002");

    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "",
      generatedFiles: [
        visualFile({ versionLabel: "v001" }),
        visualFile({ id: "v2", versionLabel: "v002" }),
      ],
    })).toBe("v003");

    expect(getDefaultRpaVersionLabel({
      selectedGeneratedVersion: "Unversioned",
      generatedFiles: [],
    })).toBe("v001");
  });

  it("normalizes target version folders and output filenames", () => {
    expect(normalizeRpaVersionLabel("Version 1.0/unsafe")).toBe("v001");
    expect(normalizeRpaVersionLabel("Unversioned")).toBe("v001");
    expect(normalizeRpaImageFilename("01-slide.png.png")).toBe("01-slide.png");
    expect(normalizeRpaImageFilename("02-slide")).toBe("02-slide.png");
    expect(normalizeRpaImageFilename("03-slide.JPG")).toBe("03-slide.jpg");
  });
});
