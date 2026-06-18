import { describe, expect, it } from "vitest";
import {
  filterLatestAssistDownload,
  getDefaultAssistVersionLabel,
  isSupportedAssistDownloadFilename,
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
} from "../src/lib/prompt-builder/chatgpt-assist";
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

describe("ChatGPT assistant helpers", () => {
  it("validates latest-download import payloads", () => {
    expect(validateAssistImportInput({
      projectFolder: "",
      outputFilename: "",
      versionLabel: "",
      runStartedAt: "not-a-date",
    })).toEqual([
      "Project folder is required.",
      "Output filename is required.",
      "Target version folder is required.",
      "Run start time is invalid.",
    ]);
  });

  it("chooses active or newest visual version", () => {
    expect(getDefaultAssistVersionLabel({
      selectedGeneratedVersion: "Version 1.1",
      generatedFiles: [],
    })).toBe("Version 1.1");

    expect(getDefaultAssistVersionLabel({
      selectedGeneratedVersion: "",
      generatedFiles: [
        visualFile({ versionLabel: "Version 1.0" }),
        visualFile({ id: "v2", versionLabel: "Version 2.0" }),
      ],
    })).toBe("Version 2.0");
  });

  it("normalizes version folders and image filenames", () => {
    expect(normalizeAssistVersionLabel("Version 1.0/unsafe")).toBe("Version 1.0-unsafe");
    expect(normalizeAssistVersionLabel("Unversioned")).toBe("Version 1.0");
    expect(normalizeAssistImageFilename("01-slide.png.png")).toBe("01-slide.png");
    expect(normalizeAssistImageFilename("02-slide", ".webp")).toBe("02-slide.webp");
    expect(normalizeAssistImageFilename("03-slide.JPG")).toBe("03-slide.jpg");
  });

  it("detects supported downloaded image formats only", () => {
    expect(isSupportedAssistDownloadFilename("slide.png")).toBe(true);
    expect(isSupportedAssistDownloadFilename("slide.jpeg")).toBe(true);
    expect(isSupportedAssistDownloadFilename("slide.webp")).toBe(true);
    expect(isSupportedAssistDownloadFilename("slide.svg")).toBe(false);
    expect(isSupportedAssistDownloadFilename("slide.pdf")).toBe(false);
  });

  it("selects the newest supported image modified after the run started", () => {
    const selected = filterLatestAssistDownload([
      { path: "old.png", filename: "old.png", modifiedAt: "2026-06-17T08:59:00.000Z" },
      { path: "doc.pdf", filename: "doc.pdf", modifiedAt: "2026-06-17T09:10:00.000Z" },
      { path: "first.png", filename: "first.png", modifiedAt: "2026-06-17T09:01:00.000Z" },
      { path: "latest.webp", filename: "latest.webp", modifiedAt: "2026-06-17T09:04:00.000Z" },
    ], "2026-06-17T09:00:00.000Z");

    expect(selected?.filename).toBe("latest.webp");
  });
});
