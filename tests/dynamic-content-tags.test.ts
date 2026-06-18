import { describe, expect, it } from "vitest";
import {
  applyDynamicContentTagsToMarkdown,
  generateDynamicContentTags,
} from "../src/lib/prompt-builder/dynamic-content-tags";
import { parseMarkdownSections } from "../src/lib/prompt-builder/content-sections";

describe("dynamic content tags", () => {
  it("generates concise image tags from Visible Text only", () => {
    const markdown = [
      "## Intent",
      "Old intent that should be replaced.",
      "",
      "## Visible Text",
      "Board Launch",
      "Title: Member readiness",
      "Status: Complete",
      "Body: Staff onboarding and member launch checks are ready.",
      "",
      "## Image Brief",
      "This old brief mentions fake KPIs, external market claims and narrative that is not in visible text.",
      "It must not be reused by dynamic tag generation.",
    ].join("\n");

    const update = generateDynamicContentTags({
      brandLabel: "RainFin",
      projectLabel: "Advisory Forum",
      contentLabel: "Launch Readiness",
      contentType: "visuals",
      outputType: "image",
      sections: parseMarkdownSections(markdown),
      selectedLayoutPresetId: "auto",
      selectedBackgroundPresetId: "auto",
    });

    expect(update.updates.Intent.length).toBeLessThanOrEqual(180);
    expect(update.updates["Image Brief"].length).toBeLessThan(620);
    expect(update.updates["Image Brief"]).toContain("Visible Text only");
    expect(update.updates["Image Brief"]).toContain("Member readiness");
    expect(update.updates["Image Brief"]).not.toContain("fake KPIs");
    expect(update.updates["Image Brief"]).not.toContain("external market claims");
  });

  it("applies dynamic updates without altering Visible Text", () => {
    const markdown = [
      "## Visible Text",
      "Title: One",
      "Body: Two",
      "",
      "## Optional Notes",
      "Notes outside visible text.",
    ].join("\n");
    const visibleBefore = parseMarkdownSections(markdown)["visible text"];
    const update = generateDynamicContentTags({
      brandLabel: "SupplySync360",
      projectLabel: "Executive Overview",
      contentLabel: "Slide",
      contentType: "visuals",
      outputType: "image",
      sections: parseMarkdownSections(markdown),
    });

    const next = applyDynamicContentTagsToMarkdown(markdown, update);
    expect(parseMarkdownSections(next)["visible text"]).toBe(visibleBefore);
  });
});
