import { ParsedSections, getSection, linesFromBlock } from "./content-sections";
import { DynamicLayoutPlan } from "./layout-solver";

export type RenderContract = {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputLabel: string;
  logoAsset?: string;
  layoutPresetId: string;
  backgroundPresetId: string;
  zones: DynamicLayoutPlan["zones"];
  exactVisibleText: string[];
  semanticSummary: string;
  textPlacement: string;
  imagePlacement: string;
  fontStrategy: string;
  validation: {
    status: "ready" | "warning";
    warnings: string[];
  };
};

export function buildRenderContract(input: {
  brandLabel: string;
  projectLabel: string;
  contentLabel: string;
  outputLabel: string;
  logoAsset?: string;
  sections: ParsedSections;
  plan: DynamicLayoutPlan;
}): RenderContract {
  const exactVisibleText = linesFromBlock(getSection(input.sections, "Visible Text"));
  const warnings = [...input.plan.warnings];

  if (exactVisibleText.length === 0) {
    warnings.push("No Visible Text found.");
  }

  return {
    brandLabel: input.brandLabel,
    projectLabel: input.projectLabel,
    contentLabel: input.contentLabel,
    outputLabel: input.outputLabel,
    logoAsset: input.logoAsset,
    layoutPresetId: input.plan.layoutPresetId,
    backgroundPresetId: input.plan.backgroundPresetId,
    zones: input.plan.zones,
    exactVisibleText,
    semanticSummary: input.plan.semanticSummary,
    textPlacement: input.plan.textPlacement,
    imagePlacement: input.plan.imagePlacement,
    fontStrategy: input.plan.fontStrategy,
    validation: {
      status: warnings.length > 0 ? "warning" : "ready",
      warnings,
    },
  };
}

export function renderContractToPrompt(contract: RenderContract): string {
  const zones = contract.zones
    .map(
      (zone) =>
        `${zone.name}: x ${zone.x}%, y ${zone.y}%, w ${zone.width}%, h ${zone.height}%. ${zone.purpose}`
    )
    .join("\n");

  return [
    "Render Contract",
    `Brand: ${contract.brandLabel}`,
    `Project: ${contract.projectLabel}`,
    `Content: ${contract.contentLabel}`,
    `Output: ${contract.outputLabel}`,
    `Layout: ${contract.layoutPresetId}`,
    `Background: ${contract.backgroundPresetId}`,
    `Zones:\n${zones}`,
    `Semantic Visible Text:\n${contract.semanticSummary}`,
    `Text placement: ${contract.textPlacement}`,
    `Image placement: ${contract.imagePlacement}`,
    `Font strategy: ${contract.fontStrategy}`,
    `Exact Visible Text:\n${contract.exactVisibleText.join("\n")}`,
  ].join("\n\n");
}
