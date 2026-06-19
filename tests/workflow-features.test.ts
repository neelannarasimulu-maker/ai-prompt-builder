import { describe, expect, it } from "vitest";
import {
  buildBatchVisualPrompt,
  buildBatchRunManifest,
  buildBrandQaScorecard,
  buildDocumentAssemblyPrompt,
  buildStyleMemoryPrompt,
  buildVariantPrompt,
  getPromptRecipe,
  getVariantDirection,
  type BatchPromptItem,
} from "../src/lib/prompt-builder/workflow-features";
import type { GeneratedContentFile } from "../src/lib/prompt-builder/project-generated-content-api";

function generatedFile(input: Partial<GeneratedContentFile>): GeneratedContentFile {
  return {
    id: input.id || "file-1",
    filename: input.filename || "01-demo.png",
    displayName: input.displayName || "01 demo",
    relativePath: input.relativePath || "content/projects/demo/generated-content/visuals/Version 1.0/01-demo.png",
    generatedRelativePath: input.generatedRelativePath || "visuals/Version 1.0/01-demo.png",
    category: input.category || "visuals",
    versionLabel: input.versionLabel || "Version 1.0",
    fileUrl: input.fileUrl || "/project-generated-content/content/projects/demo/generated-content/visuals/Version 1.0/01-demo.png",
    fileType: input.fileType || "image",
    sizeBytes: input.sizeBytes || 1024,
    modifiedAt: input.modifiedAt || "2026-06-18T00:00:00.000Z",
  };
}

describe("workflow feature helpers", () => {
  it("builds locked-brand variant prompts", () => {
    const prompt = buildVariantPrompt({
      basePrompt: "TASK\nCreate the slide.",
      recipe: getPromptRecipe("investor_deck"),
      variant: getVariantDirection("diagram_first"),
    });

    expect(prompt).toContain("TASK\nCreate the slide.");
    expect(prompt).toContain("VARIANT DIRECTION");
    expect(prompt).toContain("Investor Deck");
    expect(prompt).toContain("Diagram-First");
    expect(prompt).toContain("locked brand chrome unchanged");
    expect(prompt).toContain("Vary only the body composition");
    expect(prompt).not.toContain("BATCH-ONLY VISUAL QUALITY LOCK");
  });

  it("adds batch-only visual and text layout locks without changing variant prompts", () => {
    const prompt = buildBatchVisualPrompt({
      basePrompt: "TASK\nCreate the slide.",
      recipe: getPromptRecipe("investor_deck"),
      variant: getVariantDirection("cinematic_premium"),
    });

    expect(prompt).toContain("TASK\nCreate the slide.");
    expect(prompt).toContain("BATCH-ONLY VISUAL QUALITY LOCK");
    expect(prompt).toContain("This extra lock applies only to batch generation");
    expect(prompt).toContain("Scene lock");
    expect(prompt).toContain("Text layout lock");
    expect(prompt).toContain("Panel lock");
    expect(prompt).toContain("polished as a manually generated individual slide");
  });

  it("scores brand QA with blocking and advisory states", () => {
    const scorecard = buildBrandQaScorecard({
      logoAsset: "",
      headerText: "Header",
      footerText: "Footer",
      visibleText: "Exact visible text",
      outputFilename: "01-demo.png",
      selectedFile: generatedFile({ filename: "01-demo.png" }),
      promptIssues: [
        { severity: "error", code: "invalid-background", message: "Unknown background preset." },
        { severity: "warning", code: "long-prompt", message: "Prompt is long." },
      ],
    });

    expect(scorecard.blockingCount).toBe(1);
    expect(scorecard.advisoryCount).toBe(1);
    expect(scorecard.items.find((item) => item.id === "logo")?.status).toBe("action");
    expect(scorecard.items.find((item) => item.id === "lint")?.status).toBe("action");
    expect(scorecard.score).toBeLessThan(100);
  });

  it("builds a batch queue manifest with prompts and output filenames", () => {
    const items: BatchPromptItem[] = [
      {
        id: "one",
        label: "Opening Slide",
        filename: "01-opening.md",
        prompt: "Prompt one",
        outputFilename: "01-opening.png",
      },
      {
        id: "two",
        label: "Operating Model",
        filename: "02-model.md",
        prompt: "Prompt two",
        outputFilename: "02-model.png",
      },
    ];

    const manifest = buildBatchRunManifest(items);

    expect(manifest).toContain("BATCH GENERATION QUEUE");
    expect(manifest).toContain("Do not generate a combined contact sheet");
    expect(manifest).toContain("Each item is a separate finished full-quality visual");
    expect(manifest).toContain("ITEM 1: Opening Slide");
    expect(manifest).toContain("Output filename: 01-opening.png");
    expect(manifest).toContain("Prompt two");
  });

  it("builds style memory only from approved generated files", () => {
    const memory = buildStyleMemoryPrompt({
      files: [
        generatedFile({ id: "approved", filename: "01-approved.png", generatedRelativePath: "visuals/Version 1.0/01-approved.png" }),
        generatedFile({ id: "ignored", filename: "02-ignored.png", generatedRelativePath: "visuals/Version 1.0/02-ignored.png" }),
      ],
      approvedIds: ["approved"],
    });

    expect(memory).toContain("PROJECT STYLE MEMORY");
    expect(memory).toContain("01-approved");
    expect(memory).not.toContain("02-ignored");
  });

  it("builds a document assembly prompt from ordered source sections", () => {
    const prompt = buildDocumentAssemblyPrompt({
      brandLabel: "Demo Brand",
      projectLabel: "Demo Project",
      documentTitle: "Demo Pack",
      entries: [
        { label: "Brief", filename: "01-brief.md", raw: "## Body Content\nBrief body." },
        { label: "Pricing", filename: "02-pricing.md", raw: "## Body Content\nPricing body." },
      ],
    });

    expect(prompt).toContain("DOCUMENT ASSEMBLY MODE");
    expect(prompt).toContain("Brand: Demo Brand");
    expect(prompt).toContain("SECTION 2: Pricing");
    expect(prompt).toContain("BEGIN SECTION SOURCE");
  });
});
