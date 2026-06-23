import { describe, expect, it } from "vitest";
import { compilePrompt } from "../src/lib/prompt-builder";

const requiredHeadings = [
  "TASK",
  "SOURCE OF TRUTH",
  "BRAND + PROJECT",
  "OUTPUT PROFILE",
  "CONTENT GUIDANCE",
  "LINKEDIN ASSET RENDERING RULES",
  "FINAL OUTPUT REQUIREMENT",
];

function compileLinkedIn(markdownOverride?: string) {
  return compilePrompt({
    brandId: "supplysync360",
    projectId: "brand-positioning",
    contentId: "ss360-linkedin-01",
    outputProfileId: "linkedin_asset_4_5",
    layoutPresetId: "operating_layer_bridge",
    backgroundPresetId: "balanced_in_between_depth",
    markdownOverride,
  });
}

describe("LinkedIn prompt compiler", () => {
  it("uses the cleaned seven-section LinkedIn structure", () => {
    const prompt = compileLinkedIn().productionPrompt;
    const headingPositions = requiredHeadings.map((heading) => prompt.indexOf(`${heading}\n`));

    expect(headingPositions.every((position) => position >= 0)).toBe(true);
    expect(headingPositions).toEqual([...headingPositions].sort((a, b) => a - b));
    expect(prompt.match(/^(?:TASK|SOURCE OF TRUTH|BRAND \+ PROJECT|OUTPUT PROFILE|CONTENT GUIDANCE|LINKEDIN ASSET RENDERING RULES|FINAL OUTPUT REQUIREMENT)$/gm)).toEqual(requiredHeadings);
  });

  it("keeps exact visible text authoritative and excludes captions and document rules", () => {
    const result = compileLinkedIn([
      "## Intent",
      "Create a credible campaign asset.",
      "",
      "## Visible Text",
      "Title: Exact wording",
      "Body: Preserve this line.",
      "",
      "## LinkedIn Post Text",
      "Caption copy must stay outside the artwork.",
      "",
      "## Body Content",
      "Legacy caption must also stay outside the artwork.",
      "",
      "## Document Output Rules",
      "Add a table of contents and dynamic page numbering.",
      "",
      "## Image Brief",
      "Create one clear LinkedIn visual.",
    ].join("\n"));
    const prompt = result.productionPrompt;

    expect(prompt).toContain("Use only the text inside BEGIN EXACT VISIBLE TEXT / END EXACT VISIBLE TEXT as on-image text.");
    expect(prompt).toContain("Do not alter, omit, duplicate, rewrite or reorder the exact visible wording.");
    expect(prompt).toContain("BEGIN EXACT VISIBLE TEXT\nTitle: Exact wording\nBody: Preserve this line.\nEND EXACT VISIBLE TEXT");
    expect(prompt).not.toMatch(/Caption copy|Legacy caption|Body Content|Document Output Rules|A4|Word document|Table of contents|Signature sections|Markdown pipe tables|Dynamic page numbering|Header on every page|Footer on every page/i);
    expect(prompt.match(/Use only the text inside BEGIN EXACT VISIBLE TEXT/g)).toHaveLength(1);
  });

  it("includes profile, brand, project and preset details without conflicting output formats", () => {
    const prompt = compileLinkedIn().productionPrompt;

    expect(prompt).toContain("Brand: SupplySync360");
    expect(prompt).toContain("Project: Brand Positioning");
    expect(prompt).toContain("Workflow: linkedin_campaign");
    expect(prompt).toMatch(/Audience: .+/);
    expect(prompt).toMatch(/Purpose: .+/);
    expect(prompt).toMatch(/Tone: .+/);
    expect(prompt).toContain("teal #008B8B");
    expect(prompt).toContain("Canvas: 2160x2700px");
    expect(prompt).toContain("safe margins of approximately 6% from every edge");
    expect(prompt).toContain("44-64 px");
    expect(prompt).toContain("Follow the selected layout preset: operating_layer_bridge.");
    expect(prompt).toContain("Follow the selected background preset: balanced_in_between_depth.");
    expect(prompt).toContain("Return format: PNG asset set only");
    expect(prompt).not.toMatch(/\.pdf\b|PDF document|\.docx\b|Word document/i);
  });

  it("derives carousel mode from the Image Brief rather than the output profile", () => {
    const carousel = compileLinkedIn([
      "## Intent",
      "Create a carousel.",
      "",
      "## Visible Text",
      "Page 1 Title: First",
      "Page 2 Title: Second",
      "",
      "## Image Brief",
      "Create a 2-image carousel as separate 4:5 images, one image per page.",
    ].join("\n")).productionPrompt;

    expect(carousel).toContain("Asset mode: separate carousel images");
    expect(carousel).toContain("create one separate 4:5 image per page");
    expect(carousel).toContain("Do not combine multiple carousel pages into one image.");
    expect(carousel).toContain("Do not infer carousel page count from the output profile.");
  });

  it("omits empty content placeholders", () => {
    const prompt = compileLinkedIn("## Visible Text\nTitle: Only supplied field").productionPrompt;

    expect(prompt).not.toContain("Intent:");
    expect(prompt).not.toContain("Image Brief:");
    expect(prompt).toContain("BEGIN EXACT VISIBLE TEXT\nTitle: Only supplied field\nEND EXACT VISIBLE TEXT");
  });
});
