import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compilePrompt, contentItems, layoutPresets, listBrands, listProjects, outputProfiles } from "../src/lib/prompt-builder";
import { resolvePromptLogoAsset } from "../src/lib/prompt-builder/logo-resolution";

function words(input: string): number {
  return input.trim() ? input.trim().split(/\s+/).length : 0;
}

function occurrences(input: string, needle: string): number {
  return input.split(needle).length - 1;
}

function registeredContent(pathSuffix: string) {
  const content = contentItems.find((item) => item.path.endsWith(pathSuffix));
  if (!content) throw new Error(`Missing test content: ${pathSuffix}`);
  return content;
}

describe("prompt builder registry", () => {
  it("includes the central registry for brands and projects", () => {
    expect(listBrands().map((brand) => brand.id)).toContain("supplysync360");
    expect(listProjects("supplysync360").map((project) => project.id)).toContain("brand-positioning");
  });

  it("includes 13 SupplySync360 executive overview slides", () => {
    const slides = contentItems.filter((item) => item.brandId === "supplysync360" && item.projectId === "brand-positioning" && item.kind === "slides");
    expect(slides).toHaveLength(13);
  });

  it("lists logo-capable brand assets for selection without cross-brand leakage", () => {
    const thenga = listBrands().find((brand) => brand.id === "thenga");
    const supply = listBrands().find((brand) => brand.id === "supplysync360");

    expect(thenga?.logoAssets.map((asset) => asset.path)).toContain("content/brands/thenga/assets/thenga-logo-transparent-dark.png");
    expect(thenga?.logoAssets.every((asset) => asset.path.startsWith("content/brands/thenga/assets/"))).toBe(true);
    expect(supply?.logoAssets.map((asset) => asset.path)).toContain("content/brands/supplysync360/assets/supplysync360-logo-dark.png");
    expect(supply?.logoAssets.map((asset) => asset.path)).toContain("content/brands/supplysync360/assets/supplysync360-logo-white.png");
    expect(supply?.logoAssets[0].isPng).toBe(true);
  });
});

describe("compilePrompt", () => {
  it("returns both compact production and expanded debug prompts", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.warnings).toEqual([
      "Visible Text has many plain lines. Use simple fields like Title:, Body: and Status: to improve dynamic layout interpretation.",
      "One or more visible text lines are long. Use wider text zones, cards, or compact typography.",
    ]);
    expect(result.prompt).toBe(result.productionPrompt);
    expect(result.productionPrompt).toContain("TASK");
    expect(result.productionPrompt).toContain("SOURCE OF TRUTH");
    expect(result.productionPrompt).toContain("BRAND + PROJECT");
    expect(result.productionPrompt).toContain("DECK FRAME");
    expect(result.productionPrompt).toContain("TYPOGRAPHY");
    expect(result.productionPrompt).toContain("CONTENT");
    expect(result.productionPrompt).toContain("IMAGE DIRECTION");
    expect(result.productionPrompt).toContain("GUARDRAILS");
    expect(result.productionPrompt).toContain("BEGIN EXACT VISIBLE TEXT");
    expect(result.productionPrompt).not.toContain("BATCH-ONLY VISUAL QUALITY LOCK");
    expect(result.productionPrompt).not.toContain("Text layout lock:");
    expect(result.debugPrompt).toContain("DEBUG PROMPT VIEW");
    expect(result.debugPrompt).toContain("Raw Content Markdown:");
    expect(result.debugPrompt).toContain("Full Source Rules:");
    expect(result.fidelityScore).toBeGreaterThan(80);
    expect(result.debugPrompt.length).toBeGreaterThan(result.productionPrompt.length);
  });

  it("compiles a SupplySync360 slide with modular brand, deck and preset sections", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("BRAND + PROJECT");
    expect(result.productionPrompt).toContain("SupplySync360");
    expect(result.productionPrompt).toContain("Create one 16:9 landscape image visual");
    expect(result.productionPrompt).toContain("Header: SupplySync360 | Executive Overview");
    expect(result.productionPrompt).toContain("Footer: SupplySync360 | From visibility to coordinated action.");
    expect(result.productionPrompt).toContain("Brand colours:");
    expect(result.productionPrompt).toContain("#008B8B");
    expect(result.productionPrompt).toContain("#006C70");
    expect(result.productionPrompt).toContain("#FFD700");
    expect(result.productionPrompt).toContain("Brand design: Use premium executive operational-technology styling.");
    expect(result.productionPrompt).toContain("Font style:");
    expect(result.productionPrompt).toContain("Title: 28-36 pt");
    expect(result.productionPrompt).toContain("Generation mode: direct_chatgpt");
    expect(result.productionPrompt).toContain("Layout preset: hero_scene_overlay");
    expect(result.productionPrompt).toContain("Background preset: balanced_in_between_depth");
    expect(result.productionPrompt).toContain("Logo: content/brands/supplysync360/assets/supplysync360-logo-white.png");
    expect(result.productionPrompt).toContain("preserve aspect ratio");
    expect(result.productionPrompt).toContain("Stop managing silos. Start coordinating action.");
    expect(result.productionPrompt).toContain("16:9 landscape image");
    expect(result.productionPrompt).not.toContain("Header rules:");
    expect(result.productionPrompt).not.toContain("Footer rules:");
    expect(result.productionPrompt).not.toContain("Deck structure lock:");
    expect(result.productionPrompt).not.toContain("Composition zones:");
    expect(result.productionPrompt).not.toContain("brand palette above");
    expect(occurrences(result.productionPrompt, "Logo:")).toBe(1);
    expect(occurrences(result.productionPrompt, "Layout preset:")).toBe(1);
    expect(occurrences(result.productionPrompt, "Background preset:")).toBe(1);
    expect(words(result.productionPrompt)).toBeLessThanOrEqual(800);
  });

  it("uses one brand-agnostic visual template across registered brands", () => {
    const templateSource = readFileSync(new URL("../src/lib/prompt-builder/visual-prompt-template.ts", import.meta.url), "utf8");
    for (const forbidden of ["SupplySync360", "Executive Overview", "RainFin", "Thenga", "BMA/Open", "content/brands/"]) {
      expect(templateSource).not.toContain(forbidden);
    }

    const moduleHeadings = [
      "TASK",
      "SOURCE OF TRUTH",
      "BRAND + PROJECT",
      "DECK FRAME",
      "TYPOGRAPHY",
      "CONTENT",
      "IMAGE DIRECTION",
      "GUARDRAILS",
    ];

    for (const brandId of ["supplysync360", "rainfin", "thenga", "bma-open"]) {
      const content = contentItems.find((item) => item.brandId === brandId);
      expect(content).toBeTruthy();
      const result = compilePrompt({
        brandId,
        projectId: content!.projectId,
        contentId: content!.id,
        outputProfileId: "landscape_image_16_9",
      });
      const positions = moduleHeadings.map((heading) => result.productionPrompt.indexOf(`\n${heading}\n`) >= 0
        ? result.productionPrompt.indexOf(`\n${heading}\n`)
        : result.productionPrompt.indexOf(`${heading}\n`));

      expect(positions.every((position) => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(occurrences(result.productionPrompt, "Logo:")).toBe(1);
      expect(occurrences(result.productionPrompt, "Layout preset:")).toBe(1);
      expect(occurrences(result.productionPrompt, "Background preset:")).toBe(1);
      if (result.promptPreview.visibleText.trim()) {
        expect(occurrences(result.productionPrompt, result.promptPreview.visibleText.trim())).toBe(1);
      } else {
        expect(result.warnings).toContain("Missing Visible Text section.");
      }
      if (brandId !== "supplysync360") {
        expect(result.productionPrompt).not.toContain("content/brands/supplysync360/");
      }
    }
  });

  it("keeps 16:9 visual slides in one clean generation mode", () => {
    const direct = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });
    const composited = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      generationMode: "app_composited",
    });

    expect(direct.productionPrompt).toContain("Generation mode: direct_chatgpt");
    expect(direct.productionPrompt).toContain("Header: SupplySync360 | Executive Overview");
    expect(direct.productionPrompt).toContain("Logo: content/brands/supplysync360/assets/");
    expect(composited.productionPrompt).toContain("Generation mode: app_composited");
    expect(composited.productionPrompt).toContain("Create the body visual only. The app applies the master frame");
    expect(composited.productionPrompt).not.toContain("Generation mode: direct_chatgpt");

    for (const prompt of [direct.productionPrompt, composited.productionPrompt]) {
      expect(occurrences(prompt, "Generation mode:")).toBe(1);
      expect(prompt).not.toMatch(/3840x2160|3306x1860|\bx=\d+|\by=\d+/);
      expect(prompt).not.toContain("BODY ARTWORK ONLY");
      expect(prompt).not.toContain("APP-RENDERED MASTER FRAME");
      expect(prompt).not.toContain("DIRECT CHATGPT FALLBACK");
      expect(prompt).not.toMatch(/\bLinkedIn\b|\b4:5\b|accompanying post/i);
    }
  });

  it("selects market-aware layouts and validates incompatible overrides", () => {
    const marketContent = contentItems.find((item) =>
      item.path.endsWith("content/projects/supplysync360/coffee-uganda/visuals/market-opportunity-set/V002/03-import-market-by-coffee-type.md")
    );
    expect(marketContent).toBeTruthy();

    const automatic = compilePrompt({
      brandId: marketContent!.brandId,
      projectId: marketContent!.projectId,
      contentId: marketContent!.id,
      outputProfileId: "landscape_image_16_9",
    });
    const incompatible = compilePrompt({
      brandId: marketContent!.brandId,
      projectId: marketContent!.projectId,
      contentId: marketContent!.id,
      outputProfileId: "landscape_image_16_9",
      layoutPresetId: "governance_timeline",
    });

    expect(automatic.dynamicLayoutPlan.contentKind).toBe("trade_flow");
    expect(automatic.dynamicLayoutPlan.layoutPresetId).toBe("trade_flow_map");
    expect(incompatible.promptLint.issues.map((issue) => issue.code)).toContain("market-layout-mismatch");
  });

  it("flags placeholder exact visible text in visual slides", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: "## Intent\nTest.\n\n## Visible Text\nInsert title here\n\n## Image Brief\nTest image.",
    });

    expect(result.promptLint.issues.map((issue) => issue.code)).toContain("placeholder-visible-text");
  });

  it("registers the reusable canonical layout presets", () => {
    const ids = new Set(layoutPresets.map((preset) => preset.id));
    for (const id of [
      "hero_scene_overlay",
      "centre_stage_diagram",
      "vertical_journey",
      "horizontal_timeline",
      "outcome_wall",
      "signal_funnel",
      "layered_architecture",
      "executive_summary_grid",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("omits missing sections from the compact production prompt", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
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
      projectId: "brand-positioning",
      contentId: "ss360-slide-02",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("The Operating Problem");
    expect(result.productionPrompt).not.toContain("default_output:");
  });

  it("compiles concise, exclusive Word and PDF document prompts", () => {
    const content = registeredContent("content/projects/supplysync360/coffee-uganda/documents/market-research-strategy-pack/supplysync360_uganda_coffee_market_research_strategy.md");
    const doc = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
    });
    const pdf = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_pdf_portrait",
    });

    expect(doc.warnings).toEqual([]);
    const requiredHeadings = ["TASK", "SOURCE OF TRUTH", "BRAND + PROJECT", "OUTPUT PROFILE", "DOCUMENT RENDERING RULES", "FINAL OUTPUT REQUIREMENT"];
    for (const heading of requiredHeadings) expect(doc.productionPrompt).toContain(`${heading}\n`);
    expect(doc.productionPrompt).toContain("Create one A4 portrait Word document");
    expect(doc.productionPrompt).toContain("Return only: .docx");
    expect(doc.productionPrompt).toContain("Brand colours:");
    expect(doc.productionPrompt).toContain("#008B8B");
    expect(doc.productionPrompt).toContain("Audience: Uganda coffee makers, South Africa buyers of Uganda coffee");
    expect(doc.productionPrompt).toContain("Purpose: Establish a coffee importing business");
    expect(doc.productionPrompt).toContain("Use the official logo asset: content/brands/supplysync360/assets/supplysync360-logo-white.png.");
    expect(doc.productionPrompt).toContain("Header:\nSupplySync360 | East Africa Coffee Market Assessment");
    expect(doc.productionPrompt).toContain("Footer:\nConfidential | Prepared by SupplySync360 | South Africa Coffee Import Market Assessment");
    expect(doc.productionPrompt).toContain("Supplysync360 Uganda Coffee Market Research Strategy");
    expect(doc.productionPrompt).toContain("Use the supplied Markdown source as the exact document source of truth.");
    expect(doc.productionPrompt).toContain("Render Markdown pipe tables as properly formatted Word tables.");
    expect(doc.productionPrompt).toContain("Signature sections must begin on a new page.");
    expect(doc.productionPrompt).not.toContain("BEGIN SOURCE MARKDOWN");
    expect(doc.productionPrompt).not.toMatch(/EXCLUSIONS|DIRECT CHATGPT FALLBACK ONLY|The production app owns|Attached source file workflow|Image brief|On-image text|16:9|LinkedIn Post Text/i);
    expect(doc.productionPrompt).not.toContain("PDF");
    expect(pdf.warnings).toEqual([]);
    expect(pdf.productionPrompt).toContain("Create one A4 portrait PDF document");
    expect(pdf.productionPrompt).toContain("Return only: .pdf");
    expect(pdf.productionPrompt).not.toContain("Word");
    expect(pdf.productionPrompt).toContain("Render Markdown pipe tables as properly formatted PDF tables.");
  });

  it("treats document layout and page-treatment hints as document analysis, not visual presets", () => {
    const bmaDocument = contentItems.find((item) =>
      item.path.endsWith("content/projects/bma-open/client-management/documents/default-document-pack/new-client-business-case-template.md")
    );

    expect(bmaDocument).toBeTruthy();

    const result = compilePrompt({
      brandId: bmaDocument!.brandId,
      projectId: bmaDocument!.projectId,
      contentId: bmaDocument!.id,
      outputProfileId: "a4_document_portrait",
    });

    expect(result.dynamicLayoutPlan.contentKind).toBe("document_template");
    expect(result.dynamicLayoutPlan.layoutPresetId).toBe("brand_formatted_document");
    expect(result.dynamicLayoutPlan.backgroundPresetId).toBe("clean_white_form");
    expect(result.dynamicLayoutPlan.warnings).toEqual([]);
    expect(result.promptLint.issues.map((issue) => issue.code)).not.toContain("invalid-layout");
    expect(result.promptLint.issues.map((issue) => issue.code)).not.toContain("invalid-background");
    expect(result.warnings).not.toContain("Unknown layout preset: brand_formatted_document.");
    expect(result.warnings).not.toContain("Unknown background preset: clean_document.");
  });

  it("uses the same clean production prompt across document prompt aliases", () => {
    const content = registeredContent("content/projects/supplysync360/coffee-uganda/documents/market-research-strategy-pack/supplysync360_uganda_coffee_market_research_strategy.md");
    const result = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
      compressionProfile: "singleMessageDocument",
    });

    expect(result.documentPromptParts.runPrompt).toBe(result.productionPrompt);
    expect(result.documentPromptParts.attachmentPrompt).toBe(result.productionPrompt);
    expect(result.documentPromptParts.inlinePrompt).toBe(result.productionPrompt);
    expect(result.productionPrompt).not.toMatch(/BEGIN SOURCE MARKDOWN|BEGIN BODY CONTENT|fallback/i);
  });

  it("injects document rules for clean Markdown with cover and table of contents content", () => {
    const rainfinDocument = contentItems.find((item) =>
      item.path.endsWith("content/projects/rainfin/client-contracting/documents/sticcitt-document-pack/rainfin-sticcit-novation-agreement.md")
    );

    expect(rainfinDocument).toBeTruthy();

    const result = compilePrompt({
      brandId: rainfinDocument!.brandId,
      projectId: rainfinDocument!.projectId,
      contentId: rainfinDocument!.id,
      outputProfileId: "a4_document_portrait",
    });

    expect(result.promptPreview.detectedSections).toContain("Cover Page Content");
    expect(result.promptPreview.detectedSections).toContain("Table of Contents");
    expect(result.promptPreview.ignoredLegacySections).toEqual([]);
    expect(result.promptPreview.coverPageContent).toContain("Novation, Release and Replacement Services Agreement");
    expect(result.promptPreview.tableOfContentsContent).toContain("[Background](#1-background)");
    expect(result.productionPrompt).toContain("Use the supplied Markdown source as the exact document source of truth.");
    expect(result.productionPrompt).toContain("If a section would begin too near the bottom of a page");
    expect(result.productionPrompt).toContain("Allow sections to continue naturally across pages once they have started.");
    expect(result.productionPrompt).not.toContain("Insert a page break before each top-level numbered section");
    expect(result.productionPrompt).toContain("Signature sections must begin on a new page");
    expect(result.productionPrompt).toContain("Use increased spacing between signature and completion lines");
    expect(result.productionPrompt).toContain("Use slightly increased spacing between major sections");
    expect(result.productionPrompt).toContain("Render Markdown pipe tables as properly formatted Word tables");
    expect(result.productionPrompt).toContain("Read it completely before creating the document.");
    expect(result.productionPrompt).toContain("Create the requested document immediately");
    expect(result.productionPrompt).not.toContain("Create a brand-formatted Word or PDF document from this central Markdown source file.");
    expect(result.productionPrompt).not.toContain("Logo: Use the official RainFin logo as a large centred logo.");
    expect(result.productionPrompt).not.toContain("[Background](#1-background)");
    expect(result.productionPrompt).not.toContain("Registration number: 2008/029213/07");
    expect(result.productionPrompt).not.toContain("BEGIN SOURCE MARKDOWN");
    expect(result.productionPrompt).not.toContain("END SOURCE MARKDOWN");
    expect(result.productionPrompt).not.toContain("BEGIN BODY CONTENT");
    expect(result.productionPrompt).not.toContain("END BODY CONTENT");
  });

  it("does not inject source-section cleanup or table-of-contents control chatter", () => {
    const content = registeredContent("content/projects/supplysync360/coffee-uganda/documents/market-research-strategy-pack/supplysync360_uganda_coffee_market_research_strategy.md");
    const result = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
    });

    expect(result.promptPreview.detectedSections).not.toContain("Table of Contents");
    expect(result.promptPreview.tableOfContentsContent).toBe("");
    expect(result.productionPrompt).not.toMatch(/## Intent|## Layout Hint|## Background Hint|## Document Output Rules|## Table of Contents|frontmatter|metadata/i);
  });

  it("keeps legacy source diagnostics out of the production document prompt", () => {
    const bmaDocument = contentItems.find((item) =>
      item.path.endsWith("content/projects/bma-open/client-management/documents/default-document-pack/new-client-business-case-template.md")
    );

    expect(bmaDocument).toBeTruthy();

    const result = compilePrompt({
      brandId: bmaDocument!.brandId,
      projectId: bmaDocument!.projectId,
      contentId: bmaDocument!.id,
      outputProfileId: "a4_document_portrait",
    });

    expect(result.promptPreview.ignoredLegacySections).toEqual(["Document Output Rules"]);
    expect(result.warnings).toContain("Legacy output rules found in Markdown. These will be ignored because output rules are now injected by the prompt template.");
    expect(result.productionPrompt).not.toContain("MD Document Output Rules:");
    expect(result.productionPrompt).not.toContain("Use the content in `## Body Content` as the source of truth for document generation.");
    expect(result.productionPrompt).not.toMatch(/legacy|Document Output Rules|Output Rules section/i);
  });

  it("keeps LinkedIn caption text separate from the generated image prompt", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-linkedin-01",
      outputProfileId: "linkedin_asset_4_5",
      markdownOverride: [
        "## Intent",
        "Create a LinkedIn image.",
        "",
        "## Visible Text",
        "Asset Format: 4:5 portrait",
        "Title: Supply Chains Need Closure",
        "Body: Visibility matters only when action is assigned.",
        "",
        "## LinkedIn Post Text",
        "This caption is pasted into LinkedIn and must not appear on the image.",
        "",
        "## Image Brief",
        "Create a mobile-readable executive visual.",
      ].join("\n"),
    });

    expect(result.productionPrompt).toContain("Supply Chains Need Closure");
    expect(result.productionPrompt).toContain("LINKEDIN ASSET RENDERING RULES");
    expect(result.productionPrompt).toContain("44-64 px");
    expect(result.productionPrompt).not.toContain("This caption is pasted into LinkedIn");
    expect(result.productionPrompt).not.toContain("Asset Format: 4:5 portrait");
    expect(result.productionPrompt).not.toContain("Header:");
    expect(result.productionPrompt).not.toContain("Footer:");
    expect(result.productionPrompt).not.toContain("signature");
    expect(result.promptPreview.linkedinPostText).toContain("This caption is pasted into LinkedIn");
  });

  it("treats legacy LinkedIn Body Content as separate post text and removes the text-post output", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-linkedin-01",
      outputProfileId: "linkedin_asset_4_5",
      markdownOverride: "## Intent\nCreate an image.\n\n## Visible Text\nTitle: Visible\n\n## Body Content\nLegacy caption only.\n\n## Image Brief\nUse a simple visual.",
    });

    expect(result.promptPreview.linkedinPostText).toBe("Legacy caption only.");
    expect(result.productionPrompt).not.toContain("Legacy caption only.");
    expect(outputProfiles.some((profile) => profile.id === "linkedin_post_text" || profile.label === "LinkedIn Text Post")).toBe(false);
  });

  it("keeps every stored LinkedIn caption in the separate preview field and out of image prompts", () => {
    const linkedInItems = contentItems.filter((item) => item.kind === "linkedin" && item.file.toLowerCase() !== "readme.md");

    expect(linkedInItems.length).toBeGreaterThan(0);
    for (const item of linkedInItems) {
      const result = compilePrompt({
        brandId: item.brandId,
        projectId: item.projectId,
        contentId: item.id,
        outputProfileId: "linkedin_asset_4_5",
      });

      expect(result.promptPreview.detectedSections).toContain("LinkedIn Post Text");
      expect(result.promptPreview.detectedSections).not.toContain("Body Content");
      expect(result.promptPreview.linkedinPostText.trim()).not.toBe("");
      expect(result.productionPrompt).not.toContain(result.promptPreview.linkedinPostText.trim());
    }
  });

  it("derives single-image or carousel behavior from Image Brief", () => {
    const carousel = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-linkedin-01",
      outputProfileId: "linkedin_asset_4_5",
      markdownOverride: "## Intent\nCreate a LinkedIn asset.\n\n## Visible Text\nPage 1 Title: First\nPage 2 Title: Second\n\n## LinkedIn Post Text\nCaption only.\n\n## Image Brief\nCreate a 2-image carousel as separate 4:5 images, one image per page.",
    });
    const single = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-linkedin-01",
      outputProfileId: "linkedin_asset_4_5",
      markdownOverride: "## Intent\nCreate a LinkedIn asset.\n\n## Visible Text\nTitle: One image\n\n## LinkedIn Post Text\nCaption only.\n\n## Image Brief\nCreate one clear 4:5 social visual.",
    });

    expect(carousel.productionPrompt).toContain("Asset mode: separate carousel images");
    expect(single.productionPrompt).toContain("Asset mode: single image");
    expect(outputProfiles.filter((profile) => profile.id.startsWith("linkedin_")).map((profile) => profile.id)).toEqual(["linkedin_asset_4_5"]);
  });

  it("keeps visual and LinkedIn image prompts free of document pagination rules", () => {
    const visual = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
    });
    const linkedinImage = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "linkedin_asset_4_5",
    });

    for (const prompt of [visual.productionPrompt, linkedinImage.productionPrompt]) {
      expect(prompt).toContain("BEGIN EXACT VISIBLE TEXT");
      expect(prompt).not.toContain("Insert a page break");
      expect(prompt).not.toContain("table of contents");
      expect(prompt).not.toContain("Table of Contents");
      expect(prompt).not.toContain("signature blocks");
      expect(prompt).not.toContain("Render Markdown pipe tables");
    }
  });

  it("compiles email output as exact text/email without image instructions", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-linkedin-01",
      outputProfileId: "email_brief",
    });

    expect(result.productionPrompt).toContain("OUTPUT DIRECTION");
    expect(result.productionPrompt).toContain("client-facing email");
    expect(result.productionPrompt).not.toContain("BEGIN EXACT VISIBLE TEXT");
  });

  it("returns a warning when an image brief is missing", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: "## Intent\nTest intent.\n\n## Visible Text\nTest visible text.",
    });

    expect(result.warnings).toContain("Missing Image Brief section.");
  });

  it("allows content-level header and footer text to override project defaults", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
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
      projectId: "brand-positioning",
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
      projectId: "business-development",
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
    expect(result.productionPrompt).toContain("Use the supplied Markdown source as the exact document source of truth.");
    expect(result.debugPrompt).toContain("Full Source Rules:");
  });

  it("uses the Thenga business-development PNG logo override for image prompts", () => {
    const result = compilePrompt({
      brandId: "thenga",
      projectId: "business-development",
      contentId: "thenga-slide-01",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("Header: THENGA SOCIAL ENTERPRISES | Business Development");
    expect(result.productionPrompt).toContain("Footer: Trust | Inclusion | Participation | Prosperity | Copyright 2026. All Rights Reserved.");
    expect(result.productionPrompt).toContain("Logo: content/brands/thenga/assets/thenga-logo.png");
    expect(result.productionPrompt).toContain("Generation mode: direct_chatgpt");
    expect(result.productionPrompt).not.toContain("3840x2160");
    expect(result.productionPrompt).toContain("Layout preset: executive_opening_split");
    expect(result.productionPrompt).not.toContain("Typography: Document title:");
    expect(result.productionPrompt).not.toContain("content/brands/thenga/assets/thenga-logo.svg");
    expect(result.promptPreview.logoAsset).toBe("content/brands/thenga/assets/thenga-logo.png");
    expect(occurrences(result.productionPrompt, "Logo:")).toBe(1);
  });

  it("adds selected background theme direction to image prompts", () => {
    const balanced = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "balanced",
    });
    const light = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "light",
    });
    const dark = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      backgroundTheme: "dark",
    });

    expect(balanced.productionPrompt).toContain("Background preset: balanced_in_between_depth");
    expect(balanced.productionPrompt).toContain("balanced light-to-medium mode");
    expect(light.productionPrompt).toContain("Background preset: balanced_in_between_depth");
    expect(light.productionPrompt).toContain("bright, brand-tinted light mode");
    expect(dark.productionPrompt).toContain("Background preset: balanced_in_between_depth");
    expect(dark.productionPrompt).toContain("deep brand-toned mode");
    expect(light.productionPrompt).toContain("brand");
    expect(dark.productionPrompt).toContain("Brand colours:");
  });

  it("adds selected background theme direction to document prompts", () => {
    const content = registeredContent("content/projects/supplysync360/coffee-uganda/documents/market-research-strategy-pack/supplysync360_uganda_coffee_market_research_strategy.md");
    const result = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
      backgroundTheme: "dark",
    });

    expect(result.productionPrompt).toContain("Page background theme: Dark");
    expect(result.productionPrompt).toContain("Brand colours:");
    expect(result.promptPreview.backgroundTheme).toBe("Dark");
  });

  it("auto-selects lighter balanced presets when no background hint is supplied", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-01",
      outputProfileId: "landscape_image_16_9",
      markdownOverride: [
        "## Intent",
        "Create a general executive overview slide.",
        "",
        "## Visible Text",
        "Title: Coordinated Supply Chain Control",
        "Body: Give executives a clearer way to coordinate supply, inventory and supplier action.",
        "",
        "## Image Brief",
        "Use a balanced branded executive overview visual with protected text zones.",
      ].join("\n"),
    });

    expect(result.dynamicLayoutPlan.backgroundPresetId).not.toMatch(/midnight|graphite/i);
    expect(result.productionPrompt).toContain(`Background preset: ${result.dynamicLayoutPlan.backgroundPresetId}`);
    expect(occurrences(result.productionPrompt, "Background preset:")).toBe(1);
  });

  it("uses varied content-aware layouts for the SupplySync360 executive overview deck", () => {
    const cases = [
      ["ss360-slide-01", "hero_scene_overlay"],
      ["ss360-slide-02", "converging_signal_map"],
      ["ss360-slide-03", "circular_control_loop"],
      ["ss360-slide-04", "operating_layer_bridge"],
      ["ss360-slide-05", "capability_orbit_map"],
      ["ss360-slide-06", "signal_priority_funnel"],
      ["ss360-slide-07", "inventory_value_map"],
      ["ss360-slide-08", "supplier_journey_path"],
      ["ss360-slide-09", "forecasting_horizon"],
      ["ss360-slide-10", "industry_constellation"],
      ["ss360-slide-11", "governance_evidence_flow"],
      ["ss360-slide-12", "outcome_value_stream"],
      ["ss360-slide-13", "cta_action_path"],
    ];

    const layouts = cases.map(([contentId, expectedLayout]) => {
      const result = compilePrompt({
        brandId: "supplysync360",
      projectId: "brand-positioning",
        contentId,
        outputProfileId: "landscape_image_16_9",
      });
      expect(result.dynamicLayoutPlan.layoutPresetId).toBe(expectedLayout);
      return result.dynamicLayoutPlan.layoutPresetId;
    });

    expect(new Set(layouts).size).toBe(cases.length);
  });

  it("uses one selected layout preset without a list of deck alternatives", () => {
    const result = compilePrompt({
      brandId: "supplysync360",
      projectId: "brand-positioning",
      contentId: "ss360-slide-03",
      outputProfileId: "landscape_image_16_9",
    });

    expect(result.productionPrompt).toContain("Layout preset: circular_control_loop");
    expect(result.productionPrompt).toContain("centre-stage circular operating model");
    expect(result.productionPrompt).not.toContain("Composition zones:");
    expect(result.productionPrompt).not.toContain("vertical journeys, horizontal timelines");
    expect(occurrences(result.productionPrompt, "Layout preset:")).toBe(1);
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
      projectId: "brand-positioning",
        expectedLogo: "content/brands/supplysync360/assets/supplysync360-logo-white.png",
      },
      {
        brandId: "thenga",
        projectId: "business-development",
        expectedLogo: "content/brands/thenga/assets/thenga-logo.png",
      },
      {
        brandId: "rainfin",
        projectId: "client-presentations",
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
      expect(result.productionPrompt).toContain(`Logo: ${item.expectedLogo}`);
      expect(result.productionPrompt).toContain("Generation mode: direct_chatgpt");
      expect(result.productionPrompt).not.toContain("/brands/supplysync360/assets/unknown");
    }
  });

  it("rejects project and brand combinations that are not linked", () => {
    expect(() => compilePrompt({
      brandId: "supplysync360",
      projectId: "business-development",
      contentId: "thenga-slide-01",
      outputProfileId: "landscape_image_16_9",
    })).toThrow("Project business-development is not linked to brandId supplysync360.");
  });
});
