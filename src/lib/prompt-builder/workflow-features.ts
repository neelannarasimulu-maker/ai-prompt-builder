import type { GeneratedContentFile } from "./project-generated-content-api";
import type { PromptLintIssue } from "./prompt-lint";

export type WorkflowMode = "create" | "run" | "review" | "export" | "distribution";

export type PromptRecipe = {
  id: string;
  label: string;
  outputProfileId: string;
  layoutFamily: string;
  densityTolerance: "low" | "medium" | "high";
  tone: string;
  instruction: string;
};

export type VariantDirection = {
  id: string;
  label: string;
  emphasis: string;
  layoutTreatment: string;
  imageTreatment: string;
};

export type BrandQaItem = {
  id: string;
  label: string;
  status: "pass" | "review" | "action";
  detail: string;
};

export type BrandQaScorecard = {
  score: number;
  blockingCount: number;
  advisoryCount: number;
  items: BrandQaItem[];
};

export type BatchPromptItem = {
  id: string;
  label: string;
  filename: string;
  prompt: string;
  outputFilename: string;
};

export const workflowModes: Array<{ id: WorkflowMode; label: string; summary: string }> = [
  { id: "create", label: "Create", summary: "Edit source, chrome, recipe and variant controls." },
  { id: "run", label: "Run", summary: "Move faster through ChatGPT, filenames, attachments and imports." },
  { id: "review", label: "Review", summary: "Check brand QA, compare versions and approve examples." },
  { id: "export", label: "Export", summary: "Select generated assets and build delivery packs." },
  { id: "distribution", label: "Distribution", summary: "Plan delivery and record where generated content was sent." },
];

export const promptRecipes: PromptRecipe[] = [
  {
    id: "client_proposal",
    label: "Client Proposal",
    outputProfileId: "a4_document_portrait",
    layoutFamily: "structured document",
    densityTolerance: "high",
    tone: "commercial, precise and client-facing",
    instruction: "Prioritize clear decision context, recommended actions, tables and polished proposal structure.",
  },
  {
    id: "investor_deck",
    label: "Investor Deck",
    outputProfileId: "landscape_image_16_9",
    layoutFamily: "executive visual deck",
    densityTolerance: "medium",
    tone: "confident, strategic and evidence-led",
    instruction: "Prioritize thesis, market logic, traction, differentiation and memorable executive visuals.",
  },
  {
    id: "board_pack",
    label: "Board Pack",
    outputProfileId: "a4_pdf_portrait",
    layoutFamily: "governance pack",
    densityTolerance: "high",
    tone: "controlled, accountable and concise",
    instruction: "Prioritize status, decisions required, risks, actions, owners and repeatable governance structure.",
  },
  {
    id: "linkedin_launch",
    label: "LinkedIn Launch",
    outputProfileId: "linkedin_asset_4_5",
    layoutFamily: "social visual launch",
    densityTolerance: "low",
    tone: "human, credible and commercially sharp",
    instruction: "Prioritize a strong mobile-readable visual; keep the separate LinkedIn Post Text caption out of the generated asset.",
  },
  {
    id: "executive_one_pager",
    label: "Executive One-Pager",
    outputProfileId: "a4_pdf_portrait",
    layoutFamily: "single-page executive brief",
    densityTolerance: "medium",
    tone: "premium, concise and outcome-led",
    instruction: "Prioritize problem, solution, operating model, outcomes and next-step clarity on one page.",
  },
];

export const variantDirections: VariantDirection[] = [
  {
    id: "executive_minimal",
    label: "Executive Minimal",
    emphasis: "quiet authority, strong whitespace and very selective accent colour",
    layoutTreatment: "use a restrained grid with fewer panels and a strong title hierarchy",
    imageTreatment: "use minimal supporting geometry or subtle brand texture only",
  },
  {
    id: "data_rich",
    label: "Data-Rich",
    emphasis: "structured evidence, metrics, comparative panels and operational clarity",
    layoutTreatment: "use denser cards, scorecards, tables or chart-like groupings while preserving readability",
    imageTreatment: "use clean chart scaffolding, signal paths and data visual cues without inventing numbers",
  },
  {
    id: "cinematic_premium",
    label: "Cinematic Premium",
    emphasis: "high-end depth, dramatic branded atmosphere and memorable executive presence",
    layoutTreatment: "use a protected content zone with larger supporting visual depth around it",
    imageTreatment: "use premium lighting, subtle depth and brand-led environmental cues",
  },
  {
    id: "diagram_first",
    label: "Diagram-First",
    emphasis: "architecture, process, flow, relationships and operating model clarity",
    layoutTreatment: "make the central diagram the organising structure and place exact text in labelled zones",
    imageTreatment: "use connectors, layers, loops, bridges or ecosystem maps based on the content",
  },
  {
    id: "document_style",
    label: "Document-Style",
    emphasis: "formal page discipline, editorial hierarchy and printable polish",
    layoutTreatment: "use document-like sections, tables, section bands and controlled margins",
    imageTreatment: "use subtle paper, panel and rule-line treatments rather than decorative imagery",
  },
];

export function getPromptRecipe(id?: string): PromptRecipe {
  return promptRecipes.find((recipe) => recipe.id === id) ?? promptRecipes[0];
}

export function getVariantDirection(id?: string): VariantDirection {
  return variantDirections.find((variant) => variant.id === id) ?? variantDirections[0];
}

export function buildVariantPrompt(input: {
  basePrompt: string;
  recipe: PromptRecipe;
  variant: VariantDirection;
}): string {
  return [
    input.basePrompt.trim(),
    "",
    "VARIANT DIRECTION",
    `Recipe: ${input.recipe.label}. Tone: ${input.recipe.tone}.`,
    `Recipe instruction: ${input.recipe.instruction}`,
    `Variant: ${input.variant.label}. Emphasis: ${input.variant.emphasis}.`,
    `Layout treatment: ${input.variant.layoutTreatment}.`,
    `Image treatment: ${input.variant.imageTreatment}.`,
    "Keep the locked brand chrome unchanged: logo, header, footer, margins, colours, typography hierarchy and exact visible/source text must remain faithful.",
    "Vary only the body composition, supporting imagery, diagram structure, background treatment and content grouping.",
  ].join("\n");
}

export function buildBatchVisualPrompt(input: {
  basePrompt: string;
  recipe: PromptRecipe;
  variant: VariantDirection;
}): string {
  return [
    input.basePrompt.trim(),
    "",
    "BATCH-ONLY VISUAL QUALITY LOCK",
    "This extra lock applies only to batch generation. It must not be copied back into the individual prompt.",
    `Recipe: ${input.recipe.label}. Tone: ${input.recipe.tone}.`,
    `Recipe instruction: ${input.recipe.instruction}`,
    `Variant: ${input.variant.label}. Emphasis: ${input.variant.emphasis}.`,
    `Layout treatment: ${input.variant.layoutTreatment}.`,
    `Image treatment: ${input.variant.imageTreatment}.`,
    "Keep the locked brand chrome unchanged: logo, header, footer, margins, colours, typography hierarchy and exact visible/source text must remain faithful.",
    "Vary only the body composition, supporting imagery, diagram structure, background treatment and content grouping.",
    "Scene lock: the base prompt's Scene, Image Brief, background theme and visual rules remain primary. Do not downgrade rich scene guidance into placeholders, wireframes, flat icons, simple generic diagrams, or repeated decorative geometry.",
    "If the base prompt asks for dimensional imagery, a hero scene, operational environment, product scene, or content-specific visual metaphor, render that full-quality scene while applying the variant only to pacing and emphasis.",
    "Text layout lock: treat the exact visible text as designed slide typography, not a pasted text block. Use a disciplined grid, generous internal padding, readable line lengths, consistent line-height and clear paragraph spacing.",
    "Size hierarchy lock: title large but contained, subtitle clearly secondary, body text smaller and calmer, highlighted statements prominent but not oversized. Never let one highlighted line run into panel edges or dominate the slide.",
    "Panel lock: text panels must fit the text with balanced whitespace. Avoid huge empty white panels, cramped margins, over-wide callout pills, accidental full-width boxes, clipped text, overlapping text, or text touching borders.",
    "Highlight lock: use restrained teal/deep-teal emphasis and one signal-yellow cue. Highlight bands or callout pills should wrap the message cleanly with comfortable padding; they must not look like form fields.",
    "Before finalizing each batch item, visually check that the text composition looks as polished as a manually generated individual slide.",
  ].join("\n");
}

function issueSeverityRank(issue: PromptLintIssue): number {
  if (issue.severity === "error") return 3;
  if (issue.severity === "warning") return 2;
  return 1;
}

export function buildBrandQaScorecard(input: {
  logoAsset?: string;
  headerText?: string;
  footerText?: string;
  visibleText?: string;
  selectedFile?: GeneratedContentFile | null;
  outputFilename?: string;
  promptIssues?: PromptLintIssue[];
}): BrandQaScorecard {
  const issues = [...(input.promptIssues || [])].sort((a, b) => issueSeverityRank(b) - issueSeverityRank(a));
  const blockingCount = issues.filter((issue) => issue.severity === "error").length;
  const advisoryCount = issues.filter((issue) => issue.severity !== "error").length;

  const expectedBase = (input.outputFilename || "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  const selectedBase = (input.selectedFile?.filename || "").replace(/\.[a-z0-9]+$/i, "").toLowerCase();
  const filenameMatches = Boolean(expectedBase && selectedBase && selectedBase.includes(expectedBase));

  const items: BrandQaItem[] = [
    {
      id: "logo",
      label: "Logo lock",
      status: input.logoAsset ? "pass" : "action",
      detail: input.logoAsset ? `Resolved asset: ${input.logoAsset}` : "No logo asset is resolved for this output.",
    },
    {
      id: "header-footer",
      label: "Header and footer",
      status: input.headerText && input.footerText ? "pass" : "action",
      detail: input.headerText && input.footerText ? `${input.headerText} / ${input.footerText}` : "Header or footer text is missing.",
    },
    {
      id: "visible-text",
      label: "Exact source text",
      status: input.visibleText?.trim() ? "pass" : "review",
      detail: input.visibleText?.trim() ? "Source text is present and governed by the prompt contract." : "No visible/body text was detected for this output.",
    },
    {
      id: "filename",
      label: "Filename discipline",
      status: !input.selectedFile ? "review" : filenameMatches ? "pass" : "review",
      detail: input.selectedFile ? input.selectedFile.filename : "Select a generated file to compare against the suggested filename.",
    },
    {
      id: "lint",
      label: "Prompt lint",
      status: blockingCount > 0 ? "action" : advisoryCount > 0 ? "review" : "pass",
      detail: issues[0]?.message || "No prompt lint issues detected.",
    },
  ];

  const penalty = items.reduce((total, item) => {
    if (item.status === "action") return total + 18;
    if (item.status === "review") return total + 8;
    return total;
  }, 0);

  return {
    score: Math.max(0, 100 - penalty),
    blockingCount,
    advisoryCount,
    items,
  };
}

export function buildBatchRunManifest(items: BatchPromptItem[]): string {
  return [
    "BATCH GENERATION QUEUE",
    "Run each item separately in ChatGPT. Do not ask ChatGPT to complete the whole batch in one response.",
    "For each item: paste only that item's prompt, wait for that single visual to finish, save it with the supplied filename, then move to the next item.",
    "Do not generate a combined contact sheet, summary deck, wireframe deck, placeholder deck or simplified preview. Each item is a separate finished full-quality visual.",
    "For every item, preserve that item's Scene/Image Brief, background theme, exact visible text, header, footer and logo rules. Keep the deck chrome consistent, but make the body imagery content-specific and dimensional.",
    "",
    ...items.map((item, index) => [
      `ITEM ${index + 1}: ${item.label}`,
      `Source file: ${item.filename}`,
      `Output filename: ${item.outputFilename}`,
      "Instruction: create this item as one standalone finished visual only. Do not summarize, combine, queue internally, or simplify it because other items exist.",
      "Prompt:",
      item.prompt,
    ].join("\n")),
  ].join("\n\n---\n\n");
}

export function buildStyleMemoryPrompt(input: {
  files: GeneratedContentFile[];
  approvedIds: string[];
}): string {
  const approvedFiles = input.files.filter((file) => input.approvedIds.includes(file.id));
  if (approvedFiles.length === 0) {
    return "No approved examples selected yet. Approve generated files in Review mode to create project style memory.";
  }

  return [
    "PROJECT STYLE MEMORY",
    "Use these approved examples as style references for future outputs in this project. Preserve brand chrome and source facts; borrow only composition, pacing, hierarchy and finish quality.",
    "",
    ...approvedFiles.map((file, index) => `${index + 1}. ${file.displayName || file.filename} (${file.versionLabel || "Unversioned"}) - ${file.projectRelativePath || file.generatedRelativePath}`),
  ].join("\n");
}

export function buildDocumentAssemblyPrompt(input: {
  brandLabel: string;
  projectLabel: string;
  documentTitle: string;
  entries: Array<{ label: string; filename: string; raw: string }>;
}): string {
  return [
    "DOCUMENT ASSEMBLY MODE",
    `Brand: ${input.brandLabel}`,
    `Project: ${input.projectLabel}`,
    `Document title: ${input.documentTitle}`,
    "Create one polished, brand-consistent Word/PDF-style document from the ordered source sections below.",
    "Preserve facts, headings, tables, checkboxes, fields and scoring values. Add a cover, table of contents, repeated header/footer, page numbers and appendix only where the supplied sections support it.",
    "",
    ...input.entries.map((entry, index) => [
      `SECTION ${index + 1}: ${entry.label}`,
      `Source file: ${entry.filename}`,
      "BEGIN SECTION SOURCE",
      entry.raw.trim(),
      "END SECTION SOURCE",
    ].join("\n")),
  ].join("\n\n---\n\n");
}
