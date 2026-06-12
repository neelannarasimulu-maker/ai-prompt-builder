import { describe, expect, it } from "vitest";
import { compilePrompt, contentItems, listBrands, listProjects } from "../src/lib/prompt-builder";

describe("prompt builder registry", () => {
  it("includes the central registry for brands and projects", () => {
    expect(listBrands().map((brand) => brand.id)).toContain("supplysync360");
    expect(listProjects("supplysync360").map((project) => project.id)).toContain("executive-overview");
  });

  it("includes 13 SupplySync360 executive overview slides", () => {
    const slides = contentItems.filter((item) => item.brandId === "supplysync360" && item.projectId === "executive-overview" && item.kind === "slides");
    expect(slides).toHaveLength(13);
  });
});

describe("compilePrompt", () => {
  it("returns both compact production and expanded debug prompts", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.warnings).toEqual([]);
    expect(result.prompt).toBe(result.productionPrompt);
    expect(result.productionPrompt).toContain("Task:");
    expect(result.productionPrompt).toContain("Visible Text:");
    expect(result.debugPrompt).toContain("DEBUG PROMPT VIEW");
    expect(result.debugPrompt).toContain("Raw Content Markdown:");
    expect(result.debugPrompt.length).toBeGreaterThan(result.productionPrompt.length);
  });

  it("compiles a SupplySync360 slide with central compact brand, footer and logo instruction", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("SupplySync360 brand: premium executive operational technology");
    expect(result.productionPrompt).toContain("SupplySync360 | From visibility to coordinated action.");
    expect(result.productionPrompt).toContain("Logo asset to attach/render: content/brands/supplysync360/assets/supplysync360-logo.svg");
    expect(result.productionPrompt).toContain("Attach/copy this logo with the prompt");
    expect(result.productionPrompt).toContain("Stop managing silos. Start coordinating action.");
    expect(result.productionPrompt).toContain("16:9 landscape image");
  });

  it("omits missing sections from the compact production prompt", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).not.toContain("[Missing]");
    expect(result.productionPrompt).not.toContain("Body Content:");
    expect(result.productionPrompt).not.toContain("Post Brief:");
  });

  it("works with markdown that has no frontmatter", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-02",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("The Operating Problem");
    expect(result.productionPrompt).not.toContain("default_output:");
  });

  it("compiles document and pdf content with document-specific sections", () => {
    const doc = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-doc-01",
      outputProfileId: "a4_document_portrait",
    });
    const pdf = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-doc-02",
      outputProfileId: "a4_pdf_portrait",
    });

    expect(doc.warnings).toEqual([]);
    expect(doc.productionPrompt).toContain("A4 portrait document");
    expect(doc.productionPrompt).toContain("Client Opportunity Brief");
    expect(doc.productionPrompt).toContain("Body Content:");
    expect(doc.productionPrompt).not.toContain("Image Brief:");
    expect(pdf.warnings).toEqual([]);
    expect(pdf.productionPrompt).toContain("A4 portrait PDF page");
    expect(pdf.productionPrompt).toContain("SupplySync360 Executive One-Pager");
  });

  it("compiles LinkedIn text without image instructions", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-linkedin-01",
      outputProfileId: "linkedin_post_text",
    });

    expect(result.warnings).toEqual([]);
    expect(result.productionPrompt).toContain("Do not create an image.");
    expect(result.productionPrompt).toContain("professional LinkedIn post");
    expect(result.productionPrompt).not.toContain("Logo asset to attach/render");
    expect(result.productionPrompt).not.toContain("Image Brief:");
  });

  it("returns a warning when an image brief is missing", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: "## Intent\nTest intent.\n\n## Visible Text\nTest visible text.",
    });

    expect(result.warnings).toContain("Missing Image Brief section.");
  });

  it("compiles the Thenga sample and loads the Thenga footer centrally", () => {
    const result = compilePrompt({
      brandId: "thenga",
      projectId: "investor-canvas",
      contentId: "thenga-slide-01",
      outputProfileId: "a4_pdf_portrait",
    });

    expect(result.productionPrompt).toContain("Thenga | Trusted Participation. Localised Wealth. Real-Economy Access.");
    expect(result.productionPrompt).toContain("Thenga Investment Thesis");
  });
});
