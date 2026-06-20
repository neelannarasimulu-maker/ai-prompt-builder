import { describe, expect, it } from "vitest";
import {
  getBackgroundTheme,
  inferBackgroundThemeFromPreset,
} from "../src/lib/prompt-builder/background-themes";
import { backgroundPresets, getBackgroundPreset } from "../src/lib/prompt-builder/background-presets";
import {
  documentBackgroundPresets,
  getDocumentBackgroundPreset,
} from "../src/lib/prompt-builder/document-background-presets";

describe("background taxonomy", () => {
  it("treats light as softly tinted rather than blank white", () => {
    const light = getBackgroundTheme("light");

    expect(light.label).toBe("Light");
    expect(light.visualPrompt).toContain("Light must not mean plain white");
    expect(light.visualPrompt).toContain("brand colour");
    expect(light.visualPrompt).toContain("gradient movement");
  });

  it("defines balanced as the new in-between background class", () => {
    const balanced = getBackgroundTheme("balanced");
    const preset = backgroundPresets.find((item) => item.id === "balanced_in_between_depth");

    expect(balanced.label).toBe("Balanced In-Between");
    expect(balanced.visualPrompt).toContain("saturated brand-colour gradient bands");
    expect(balanced.visualPrompt).toContain("luminous accent lines");
    expect(balanced.visualPrompt).toContain("avoid beige/grey blandness");
    expect(preset?.prompt).toContain("light-to-medium brand gradient");
    expect(preset?.prompt).toContain("bright readable content areas");
  });

  it("keeps dark backgrounds colourful, shaded and gradient-led", () => {
    const dark = getBackgroundTheme("dark");
    const midnight = backgroundPresets.find((item) => item.id === "midnight_brand_mesh");

    expect(dark.visualPrompt).toContain("multi-stop gradients");
    expect(dark.visualPrompt).toContain("luminous brand glows");
    expect(dark.visualPrompt).toContain("never as a single flat dark colour");
    expect(midnight?.prompt).toContain("connected pathways");
    expect(midnight?.prompt).toContain("light protected content panels");
  });

  it("classifies soft in-between presets as light and the new midpoint as balanced", () => {
    expect(inferBackgroundThemeFromPreset({ backgroundPresetId: "soft_brand_depth" })).toBe("light");
    expect(inferBackgroundThemeFromPreset({ backgroundPresetId: "soft_dark_edge_light_content" })).toBe("light");
    expect(inferBackgroundThemeFromPreset({ backgroundPresetId: "balanced_in_between_depth" })).toBe("balanced");
    expect(getBackgroundPreset("balanced_in_between_depth").label).toBe("Balanced In-Between Depth");
  });

  it("keeps auto/default presets away from dark-dominant wording", () => {
    const auto = getBackgroundPreset("auto");
    const balanced = getBackgroundPreset("balanced_brand_gradient");

    expect(auto.prompt).toContain("balanced brand-colour canvas");
    expect(auto.prompt).toContain("protected reading zones");
    expect(balanced.prompt).toContain("bright centre");
    expect(backgroundPresets.every((preset) => preset.prompt.split(/\s+/).length <= 30)).toBe(true);
  });

  it("keeps document page treatments brand-neutral by default", () => {
    expect(getDocumentBackgroundPreset().id).toBe("auto_brand_document");
    expect(documentBackgroundPresets.map((preset) => preset.id)).not.toContain("bma_open_clean_document");
    expect(documentBackgroundPresets[0].prompt).toContain("selected brand and project document rules");
  });
});
