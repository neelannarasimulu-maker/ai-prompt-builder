import { describe, expect, it } from "vitest";
import { compilePrompt, contentItems, listBrands, listProjects } from "../src/lib/prompt-builder";
import { resolvePromptLogoAsset } from "../src/lib/prompt-builder/logo-resolution";

function words(input: string): number {
  return input.trim() ? input.trim().split(/\s+/).length : 0;
}

function occurrences(input: string, needle: string): number {
  return input.split(needle).length - 1;
}

describe("prompt builder registry", () => {
  it("includes the central registry for brands and projects", () => {
    expect(listBrands().map((brand) => brand.id)).toContain("supplysync360");
    expect(listProjects("supplysync360").map((project) => project.id)).toContain("executive-overview");
  });

  it("includes 13 SupplySync360 executive overview slides", () => {
    const slides = contentItems.filter((item) => item.brandId === "supplysync360" && item.projectId === "executive-overview" && item.kind === "slides");
    expect(slides).toHaveLength(13);
  });

  it("lists logo-capable brand assets for selection without cross-brand leakage", () => {
    const thenga = listBrands().find((brand) => brand.id === "thenga");
    const supply = listBrands().find((brand) => brand.id === "supplysync360");

    expect(thenga?.logoAssets.map((asset) => asset.path)).toContain("content/brands/thenga/assets/thenga-logo-transparent-dark.png");
    expect(thenga?.logoAssets.every((asset) => asset.path.startsWith("content/brands/thenga/assets/"))).toBe(true);
    expect(supply?.logoAssets.map((asset) => asset.path)).toContain("content/brands/supplysync360/assets/supplysync360-logo.png");
    expect(supply?.logoAssets[0].isPng).toBe(true);
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
    expect(result.productionPrompt).toContain("TASK");
    expect(result.productionPrompt).toContain("SOURCE OF TRUTH");
    expect(result.productionPrompt).toContain("BRAND CAPSULE");
    expect(result.productionPrompt).toContain("OUTPUT DIRECTION");
    expect(result.productionPrompt).toContain("BEGIN EXACT VISIBLE TEXT");
    expect(result.debugPrompt).toContain("DEBUG PROMPT VIEW");
    expect(result.debugPrompt).toContain("Raw Content Markdown:");
    expect(result.debugPrompt).toContain("Full Source Rules:");
    expect(result.fidelityScore).toBeGreaterThan(80);
    expect(result.debugPrompt.length).toBeGreaterThan(result.productionPrompt.length);
  });

  it("compiles a SupplySync360 slide with a lean brand capsule and one logo rule", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("BRAND CAPSULE");
    expect(result.productionPrompt).toContain("SupplySync360");
    expect(result.productionPrompt).toContain("Create one 16:9 landscape image slide");
    expect(result.productionPrompt).toContain("Header: SupplySync360 | Executive Overview");
    expect(result.productionPrompt).toContain("Footer: SupplySync360 | From visibility to coordinated action.");
    expect(result.productionPrompt).toContain("Brand colours:");
    expect(result.productionPrompt).toContain("#008B8B");
    expect(result.productionPrompt).toContain("#006C70");
    expect(result.productionPrompt).toContain("#FFD700");
    expect(result.productionPrompt).toContain("Theme/style:");
    expect(result.productionPrompt).toContain("Fonts/sizes:");
    expect(result.productionPrompt).toContain("slide title 24-34pt");
    expect(result.productionPrompt).toContain("Deck structure lock: 16:9 landscape");
    expect(result.productionPrompt).toContain("Fixed header zone: 8-10% of slide height");
    expect(result.productionPrompt).toContain("Fixed footer zone: 6-8% of slide height");
    expect(result.productionPrompt).toContain("header text on the same horizontal line as the logo");
    expect(result.productionPrompt).toContain("Only the body area may vary");
    expect(result.productionPrompt).toContain("Logo: use official PNG asset content/brands/supplysync360/assets/supplysync360-logo.png");
    expect(result.productionPrompt).toContain("header on every slide");
    expect(result.productionPrompt).toContain("do not redraw, recolour, stretch, replace, crop or invent a logo.");
    expect(result.productionPrompt).toContain("Stop managing silos. Start coordinating action.");
    expect(result.productionPrompt).toContain("16:9 landscape image");
    expect(result.productionPrompt).not.toContain("Header rules:");
    expect(result.productionPrompt).not.toContain("Footer rules:");
    expect(result.productionPrompt).not.toContain("brand palette above");
    expect(occurrences(result.productionPrompt, "Logo:")).toBe(1);
    expect(words(result.productionPrompt)).toBeLessThanOrEqual(850);
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
    expect(doc.productionPrompt).toContain("Create A4 page(s)");
    expect(doc.productionPrompt).toContain("Brand colours:");
    expect(doc.productionPrompt).toContain("#008B8B");
    expect(doc.productionPrompt).toContain("Header on every page: SupplySync360 | Executive Overview");
    expect(doc.productionPrompt).toContain("Footer on every page: SupplySync360 | From visibility to coordinated action.");
    expect(doc.productionPrompt).toContain("header on every page");
    expect(doc.productionPrompt).toContain("Client Opportunity Brief");
    expect(doc.productionPrompt).toContain("Attached source file workflow");
    expect(doc.productionPrompt).not.toContain("BEGIN SOURCE MARKDOWN");
    expect(doc.productionPrompt).not.toContain("Image Brief:");
    expect(pdf.warnings).toEqual([]);
    expect(pdf.productionPrompt).toContain("A4 portrait PDF document");
    expect(pdf.productionPrompt).toContain("02-a4-pdf-investor-one-pager.md");
  });

  it("can compile a single-message document prompt with inline source markdown", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-doc-01",
      outputProfileId: "a4_document_portrait",
      compressionProfile: "singleMessageDocument",
    });

    expect(result.productionPrompt).toContain("BEGIN SOURCE MARKDOWN");
    expect(result.productionPrompt).toContain("## Body Content");
    expect(result.documentPromptParts.attachmentPrompt).toContain("Attached source file workflow");
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
    expect(result.productionPrompt).toContain("OUTPUT DIRECTION");
    expect(result.productionPrompt).toContain("Format: LinkedIn written post.");
  });

  it("compiles email output as exact text/email without image instructions", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-linkedin-01",
      outputProfileId: "email_brief",
    });

    expect(result.warnings).toEqual([]);
    expect(result.productionPrompt).toContain("OUTPUT DIRECTION");
    expect(result.productionPrompt).toContain("client-facing email");
    expect(result.productionPrompt).not.toContain("BEGIN EXACT VISIBLE TEXT");
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

  it("allows content-level header and footer text to override project defaults", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: [
        "## Intent",
        "Test intent.",
        "",
        "## Header Text",
        "Custom Slide Header",
        "",
        "## Footer Text",
        "Custom Slide Footer",
        "",
        "## Visible Text",
        "Test visible text.",
        "",
        "## Image Brief",
        "Test image brief.",
      ].join("\n"),
    });

    expect(result.productionPrompt).toContain("Header: Custom Slide Header");
    expect(result.productionPrompt).toContain("Footer: Custom Slide Footer");
    expect(result.promptPreview.headerText).toBe("Custom Slide Header");
    expect(result.promptPreview.footerText).toBe("Custom Slide Footer");
  });

  it("returns lint warnings for invalid dynamic preset hints", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: [
        "## Intent",
        "Test intent.",
        "",
        "## Layout Hint",
        "not_a_layout",
        "",
        "## Background Hint",
        "not_a_background",
        "",
        "## Visible Text",
        "Test visible text.",
        "",
        "## Image Brief",
        "Test image brief.",
      ].join("\n"),
    });

    expect(result.warnings).toContain("Unknown layout preset: not_a_layout.");
    expect(result.warnings).toContain("Unknown background preset: not_a_background.");
    expect(result.fidelityScore).toBeLessThan(100);
  });

  it("compiles the Thenga sample and loads the Thenga footer centrally", () => {
    const result = compilePrompt({
      brandId: "thenga",
      projectId: "investor-canvas",
      contentId: "thenga-slide-01",
      outputProfileId: "a4_pdf_portrait",
    });

    expect(result.productionPrompt).toContain("Investment Thesis");
    expect(result.productionPrompt).toContain("Brand colours:");
    expect(result.productionPrompt).toContain("#102A43");
    expect(result.productionPrompt).toContain("#008B8B");
    expect(result.productionPrompt).toContain("#D6A11E");
    expect(result.productionPrompt).toContain("content/brands/thenga/assets/");
    expect(result.productionPrompt).not.toContain("content/brands/supplysync360/assets/");
    expect(result.productionPrompt).toContain("Attached source file workflow");
    expect(result.debugPrompt).toContain("Full Source Rules:");
  });

  it("uses the Thenga Standard Bank project PNG logo override for image prompts", () => {
    const result = compilePrompt({
      brandId: "thenga",
      projectId: "standard-bank-pitch",
      contentId: "thenga-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("Header: THENGA SOCIAL ENTERPRISES | Investor Pitch for Standard Bank");
    expect(result.productionPrompt).toContain("Footer: Trust | Inclusion | Participation | Prosperity | Copyright 2026. Thenga Social Enterprises.");
    expect(result.productionPrompt).toContain("Logo: use official PNG asset content/brands/thenga/assets/thenga-logo-transparent-dark.png");
    expect(result.productionPrompt).toContain("header on every slide");
    expect(result.productionPrompt).toContain("Deck structure lock: 16:9 landscape");
    expect(result.productionPrompt).toContain("Fixed header zone: 8-10% of slide height");
    expect(result.productionPrompt).toContain("Fixed footer zone: 6-8% of slide height");
    expect(result.productionPrompt).toContain("header text on the same horizontal line as the logo");
    expect(result.productionPrompt).toContain("header font 8.5-10pt");
    expect(result.productionPrompt).toContain("footer text 8-9pt");
    expect(result.productionPrompt).toContain("Only the body area may vary");
    expect(result.productionPrompt).toContain("Before finalizing, verify header, footer, logo placement, logo size, outer margins and footer wording match the deck master.");
    expect(result.productionPrompt).not.toContain("Typography: Document title:");
    expect(result.productionPrompt).not.toContain("content/brands/thenga/assets/thenga-logo.svg");
    expect(result.promptPreview.logoAsset).toBe("content/brands/thenga/assets/thenga-logo-transparent-dark.png");
    expect(occurrences(result.productionPrompt, "Logo:")).toBe(1);
  });

  it("adds selected background theme direction to image prompts", () => {
    const balanced = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "balanced",
    });
    const light = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "light",
    });
    const dark = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "dark",
    });

    expect(balanced.productionPrompt).toContain("Background theme: Soft Premium Gradient");
    expect(light.productionPrompt).toContain("Background theme: Light");
    expect(dark.productionPrompt).toContain("Background theme: Dark");
    expect(light.productionPrompt).toContain("brand");
    expect(dark.productionPrompt).toContain("Brand colours:");
  });

  it("adds selected background theme direction to document prompts", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "executive-overview",
      contentId: "ss360-doc-01",
      outputProfileId: "a4_document_portrait",
      backgroundTheme: "dark",
    });

    expect(result.productionPrompt).toContain("Page background theme: Dark");
    expect(result.productionPrompt).toContain("Brand colours:");
    expect(result.promptPreview.backgroundTheme).toBe("Dark");
  });

  it("uses background theme when resolving Thenga logo variants from brand rules", () => {
    const brandLogoRules = [
      "For dark backgrounds, use `content/brands/thenga/assets/thenga-logo-transparent-dark.png`.",
      "For light backgrounds, use `content/brands/thenga/assets/thenga-logo-transparent-light.png`.",
    ].join("\n");
    const light = resolvePromptLogoAsset({
      outputType: "image",
      brandId: "thenga",
      brandLogoRules,
      backgroundText: "light brand background",
    });
    const dark = resolvePromptLogoAsset({
      outputType: "image",
      brandId: "thenga",
      brandLogoRules,
      backgroundText: "dark brand background",
    });

    expect(light.asset).toBe("content/brands/thenga/assets/thenga-logo-transparent-light.png");
    expect(dark.asset).toBe("content/brands/thenga/assets/thenga-logo-transparent-dark.png");
  });

  it("resolves a selected project logo from the linked brand for every existing project", () => {
    const cases = [
      {
        brandId: "supplysync360",
        projectId: "executive-overview",
        expectedLogo: "content/brands/supplysync360/assets/supplysync360-logo.png",
      },
      {
        brandId: "thenga",
        projectId: "investor-canvas",
        expectedLogo: "content/brands/thenga/assets/thenga-logo-transparent-dark.png",
      },
      {
        brandId: "thenga",
        projectId: "standard-bank-pitch",
        expectedLogo: "content/brands/thenga/assets/thenga-logo-transparent-dark.png",
      },
      {
        brandId: "rainfin",
        projectId: "advisory-forum",
        expectedLogo: "content/brands/rainfin/assets/rainfin-logo.png",
      },
      {
        brandId: "bma-open",
        projectId: "client-management",
        expectedLogo: "content/brands/bma-open/assets/bma-open-logo.png",
      },
    ];

    for (const item of cases) {
      const content = contentItems.find((entry) => entry.brandId === item.brandId && entry.projectId === item.projectId);
      expect(content).toBeTruthy();
      const result = compilePrompt({
        brandId: item.brandId,
        projectId: item.projectId,
        contentId: content?.id || "",
        outputProfileId: "landscape_image_16_9",
      });

      expect(result.promptPreview.logoAsset).toBe(item.expectedLogo);
      expect(result.productionPrompt).toContain(item.expectedLogo);
      expect(result.productionPrompt).toContain("Logo: use official PNG asset");
      expect(result.productionPrompt).not.toContain("/brands/supplysync360/assets/unknown");
    }
  });

  it("rejects project and brand combinations that are not linked", () => {
    expect(() => compilePrompt({
      brandId: "supplysync360",
      projectId: "investor-canvas",
      contentId: "thenga-slide-01",
      outputProfileId: "landscape_image_16_9",
    })).toThrow("Project investor-canvas is not linked to brandId supplysync360.");
  });
});
