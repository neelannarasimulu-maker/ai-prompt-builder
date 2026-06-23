export type LinkedInPromptTemplateInput = {
  brandName: string;
  projectName: string;
  contentTitle: string;
  assetFormat: string;
  canvas: string;
  useCase: string;
  workflow: string;
  audience: string;
  purpose: string;
  tone: string;
  brandColours: string;
  visualTone: string;
  themeStyle: string;
  layoutPresetId: string;
  backgroundPresetId: string;
  safeMargins: string;
  intent: string;
  imageBrief: string;
  exactVisibleText: string;
};

function requestsCarousel(imageBrief: string): boolean {
  return /\bcarousel\b|\b(?:separate|multiple)\s+(?:4:5\s+)?(?:portrait\s+)?images?\b|\b[2-9]\s*[- ]image\b|\bone image per (?:page|panel)\b|\bpage\s+[2-9]\b/i.test(imageBrief);
}

function cleanImageBrief(imageBrief: string): string {
  return imageBrief
    .replace(/,?\s*each\s+\d{3,5}\s*[xX]\s*\d{3,5}\s*px/gi, "")
    .replace(/\s*Do not create a PDF and do not place multiple pages in one image\./gi, "")
    .replace(/\s*The user will combine the images afterwards\./gi, "")
    .replace(/\s*Keep all on-image text exactly from Visible Text\./gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLinkedInProductionPrompt(input: LinkedInPromptTemplateInput): string {
  const carousel = requestsCarousel(input.imageBrief);
  const assetMode = carousel
    ? "separate carousel images"
    : "single image";
  const returnFormat = carousel ? "PNG asset set only" : "PNG asset only";
  const finalAsset = carousel ? "LinkedIn carousel assets" : "LinkedIn visual asset";
  const cleanedImageBrief = cleanImageBrief(input.imageBrief);
  const contentGuidance = [
    "CONTENT GUIDANCE",
    input.intent ? `Intent:\n${input.intent}` : "",
    cleanedImageBrief ? `Image Brief:\n${cleanedImageBrief}` : "",
    input.exactVisibleText
      ? `BEGIN EXACT VISIBLE TEXT\n${input.exactVisibleText}\nEND EXACT VISIBLE TEXT`
      : "",
  ].filter(Boolean).join("\n\n");

  return [
    `TASK\nCreate one LinkedIn ${input.assetFormat} titled "${input.contentTitle}" for ${input.brandName}. Use the ${input.projectName} context.`,
    [
      "SOURCE OF TRUTH",
      "Use only the text inside BEGIN EXACT VISIBLE TEXT / END EXACT VISIBLE TEXT as on-image text.",
      "Do not alter, omit, duplicate, rewrite or reorder the exact visible wording.",
      "Everything outside the exact visible text block is design guidance only.",
    ].join("\n"),
    [
      "BRAND + PROJECT",
      `Brand: ${input.brandName}`,
      `Project: ${input.projectName}`,
      `Workflow: ${input.workflow}`,
      `Audience: ${input.audience}`,
      `Purpose: ${input.purpose}`,
      `Tone: ${input.tone}`,
      "",
      "Brand colours:",
      input.brandColours,
      "",
      "Visual tone:",
      input.visualTone,
      "",
      "Theme/style:",
      input.themeStyle,
    ].join("\n"),
    [
      "OUTPUT PROFILE",
      `Format: LinkedIn ${input.assetFormat}`,
      `Canvas: ${input.canvas}`,
      `Use case: ${input.useCase}`,
      `Asset mode: ${assetMode}`,
      `Return format: ${returnFormat}`,
    ].join("\n"),
    contentGuidance,
    [
      "LINKEDIN ASSET RENDERING RULES",
      "* Create full-bleed LinkedIn artwork.",
      "* Do not create document chrome, slide chrome, header bars or footer bars.",
      "* Do not add a logo unless the source explicitly includes it as part of the exact visible text or selected asset rules require it.",
      "* Do not render workflow labels, asset-format labels, metadata or caption text.",
      "* Keep all visible text mobile-readable.",
      `* Use safe margins of ${input.safeMargins}.`,
      "* Use LinkedIn asset typography only: headline approximately 44-64 px; supporting copy approximately 28-36 px; no essential text below 24 px.",
      "* Use consistent hierarchy, short lines, generous spacing and high contrast.",
      `* Follow the selected layout preset: ${input.layoutPresetId}.`,
      `* Follow the selected background preset: ${input.backgroundPresetId}.`,
      "* Use brand colours for depth, contrast, structure and restrained accents.",
      "* Use signal yellow only as a disciplined accent, not as a dominant colour.",
      "* Avoid clutter, fake dashboards, readable fake interface text, unsupported metrics and unreadable microtext.",
      "* If the Image Brief requests multiple carousel pages, create one separate 4:5 image per page.",
      "* Do not combine multiple carousel pages into one image.",
      "* Do not infer carousel page count from the output profile. Use the Image Brief and exact visible text structure.",
    ].join("\n"),
    `FINAL OUTPUT REQUIREMENT\nCreate the requested ${finalAsset} immediately.\nReturn the completed ${returnFormat}.`,
  ].join("\n\n").trim();
}
