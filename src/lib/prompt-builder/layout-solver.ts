import { getSection, ParsedSections, sectionIdFromHint } from "./content-sections";
import { analyseVisibleText, TextDensityAnalysis } from "./text-density";
import {
  parseSemanticVisibleText,
  semanticItemsToPromptSummary,
  type SemanticVisibleTextAnalysis,
} from "./semantic-visible-text";

export type LayoutZone = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  purpose: string;
};

export type DynamicLayoutPlan = {
  layoutPresetId: string;
  backgroundPresetId: string;
  contentKind: string;
  density: TextDensityAnalysis;
  semantic: SemanticVisibleTextAnalysis;
  semanticSummary: string;
  zones: LayoutZone[];
  textPlacement: string;
  imagePlacement: string;
  fontStrategy: string;
  imageGuidance: string;
  warnings: string[];
};

export type SolveLayoutInput = {
  contentLabel: string;
  contentType: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  sections: ParsedSections;
  requestedLayoutPresetId?: string;
  requestedBackgroundPresetId?: string;
};

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function detectContentKind(input: SolveLayoutInput, semantic: SemanticVisibleTextAnalysis): string {
  const visibleText = getSection(input.sections, "Visible Text");
  const combined = [
    input.contentLabel,
    input.contentType,
    visibleText,
    getSection(input.sections, "Image Brief"),
  ].join(" ");

  switch (semantic.pattern) {
    case "agenda":
      return "agenda";
    case "roadmap_lanes":
      return "roadmap";
    case "timeline_status":
      return "timeline_status";
    case "readiness_board":
      return "readiness";
    case "status_board":
      return "status_board";
    case "operational_action_tracker":
      return "operational_actions";
    case "partnership_action_tracker":
      return "partnership_actions";
    case "executive_summary_cards":
      return "executive_summary";
    case "financial_or_metric_cards":
      return "financial";
  }

  if (containsAny(combined, ["financial", "revenue", "ebitda", "forecast", "capital", "profit"])) return "financial";
  if (containsAny(combined, ["flywheel", "cycle", "loop", "more participation"])) return "flywheel";
  if (containsAny(combined, ["ecosystem", "hub", "spoke", "industries", "digital spine"])) return "ecosystem";
  if (containsAny(combined, ["competitive", "comparison", "versus", "traditional", "difference"])) return "comparison";
  if (containsAny(combined, ["progress", "traction", "milestone", "first year", "established"])) return "progress";
  if (containsAny(combined, ["problem", "fragmented", "silos", "manual", "disconnected"])) return "problem";
  if (containsAny(combined, ["call to action", "next step", "contact", "start with"])) return "cta";

  return "general";
}

function defaultLayoutForKind(kind: string, density: TextDensityAnalysis): string {
  if (density.level === "very_heavy") return "dense_text_editorial";

  switch (kind) {
    case "agenda": return "agenda_numbered_blocks";
    case "status_board": return "status_programme_board";
    case "readiness": return "status_readiness_cards";
    case "timeline_status": return "timeline_status_cards";
    case "roadmap": return "roadmap_lane_timeline";
    case "operational_actions": return "operational_action_cards";
    case "partnership_actions": return "partnership_action_tracker";
    case "executive_summary": return "executive_summary_cards";
    case "financial": return "financial_dashboard";
    case "flywheel": return "circular_control_loop";
    case "ecosystem": return "industry_ecosystem_map";
    case "comparison": return "comparison_split";
    case "progress": return "governance_timeline";
    case "problem": return "problem_network_map";
    case "cta": return "cta_action_path";
    default:
      return density.level === "heavy" ? "multi_panel_cards" : "capability_grid";
  }
}

function defaultBackgroundForKind(kind: string, density: TextDensityAnalysis): string {
  if (density.level === "very_heavy") return "dark_edge_light_content";

  switch (kind) {
    case "agenda": return "deep_teal_gradient";
    case "status_board": return "midnight_flow";
    case "readiness": return "graphite_panel_canvas";
    case "timeline_status": return "midnight_flow";
    case "roadmap": return "balanced_light_dark";
    case "operational_actions": return "graphite_panel_canvas";
    case "partnership_actions": return "executive_depth_panels";
    case "executive_summary": return "deep_teal_gradient";
    case "financial": return "executive_depth_panels";
    case "flywheel": return "deep_brand_gradient";
    case "ecosystem": return "rich_gradient_frame";
    case "comparison": return "midnight_brand_mesh";
    case "progress": return "executive_depth_panels";
    case "problem": return "brand_control_room_soft";
    case "cta": return "dark_edge_light_content";
    default: return "deep_brand_gradient";
  }
}

function baseZones(): { header: LayoutZone; footer: LayoutZone } {
  return {
    header: {
      name: "header",
      x: 0,
      y: 0,
      width: 100,
      height: 9,
      purpose: "Fixed brand header and logo zone. Keep important artwork out of this area.",
    },
    footer: {
      name: "footer",
      x: 0,
      y: 94,
      width: 100,
      height: 6,
      purpose: "Fixed footer zone. Keep important artwork out of this area.",
    },
  };
}

function zonesForLayout(layoutId: string, density: TextDensityAnalysis, semantic: SemanticVisibleTextAnalysis): LayoutZone[] {
  const { header, footer } = baseZones();

  if (layoutId === "agenda_numbered_blocks") {
    return [header, { name: "agenda-title", x: 6, y: 15, width: 36, height: 14, purpose: "Agenda title zone." }, { name: "agenda-items", x: 6, y: 34, width: 88, height: 50, purpose: "One numbered block per agenda Title item." }, footer];
  }

  if (["status_programme_board", "status_readiness_cards", "operational_action_cards", "executive_summary_cards"].includes(layoutId)) {
    return [header, { name: "title-strip", x: 6, y: 13, width: 88, height: 12, purpose: "Main title and short context." }, { name: "semantic-card-grid", x: 6, y: 28, width: 88, height: 59, purpose: `Card grid for ${semantic.itemCount} semantic item(s). Keep each Title with its matching Body, Status, Remaining and Option fields.` }, footer];
  }

  if (layoutId === "partnership_action_tracker") {
    return [header, { name: "tracker-title", x: 6, y: 13, width: 88, height: 10, purpose: "Action tracker title." }, { name: "action-tracker-rows", x: 5, y: 26, width: 90, height: 62, purpose: "Compact grouped rows. Each Title is an action row with Body and Status in the same row/card." }, footer];
  }

  if (layoutId === "timeline_status_cards") {
    return [header, { name: "timeline", x: 7, y: 16, width: 86, height: 22, purpose: "Phase timeline using Phase fields." }, { name: "remaining-action-cards", x: 6, y: 43, width: 88, height: 45, purpose: "Action cards using Title and Status fields." }, footer];
  }

  if (layoutId === "roadmap_lane_timeline") {
    return [header, { name: "date-columns", x: 7, y: 15, width: 86, height: 10, purpose: "Timeline dates as columns using Date fields." }, { name: "roadmap-lanes", x: 6, y: 28, width: 88, height: 60, purpose: "Lane fields as horizontal lanes; Item fields placed within their lane." }, footer];
  }

  if (layoutId === "dense_text_editorial" || density.level === "very_heavy") {
    return [header, { name: "editorial-content", x: 6, y: 13, width: 88, height: 76, purpose: "Large structured text area with compact cards and section bands." }, footer];
  }

  if (layoutId === "circular_control_loop") {
    return [header, { name: "text-panel", x: 6, y: 16, width: 34, height: 68, purpose: "Title and supporting visible text." }, { name: "loop-visual", x: 44, y: 14, width: 50, height: 72, purpose: "Circular flywheel or loop visual." }, footer];
  }

  if (layoutId === "industry_ecosystem_map") {
    return [header, { name: "central-spine", x: 37, y: 20, width: 26, height: 42, purpose: "Central platform or digital spine." }, { name: "spokes", x: 6, y: 14, width: 88, height: 72, purpose: "Industry spoke cards arranged around the central spine." }, footer];
  }

  if (layoutId === "comparison_split") {
    return [header, { name: "left-comparison", x: 6, y: 16, width: 40, height: 68, purpose: "Traditional or current-state side." }, { name: "right-comparison", x: 54, y: 16, width: 40, height: 68, purpose: "Target-state side." }, { name: "bridge", x: 46, y: 28, width: 8, height: 38, purpose: "Transition or differentiator element." }, footer];
  }

  if (layoutId === "financial_dashboard") {
    return [header, { name: "financial-title", x: 6, y: 13, width: 40, height: 12, purpose: "Financial overview title and subtitle." }, { name: "chart-zone", x: 6, y: 30, width: 52, height: 54, purpose: "Growth chart or trajectory." }, { name: "metric-cards", x: 62, y: 18, width: 32, height: 66, purpose: "Forecast, investment and revenue stream cards." }, footer];
  }

  return [header, { name: "text-panel", x: 6, y: 16, width: 40, height: 68, purpose: "Protected text panel for exact visible text." }, { name: "visual-zone", x: 50, y: 14, width: 44, height: 72, purpose: "Dynamic supporting image, map, diagram or scene." }, footer];
}

export function solveDynamicLayout(input: SolveLayoutInput): DynamicLayoutPlan {
  const visibleText = getSection(input.sections, "Visible Text");
  const semantic = parseSemanticVisibleText(visibleText);
  const density = analyseVisibleText(visibleText);
  const contentKind = detectContentKind(input, semantic);

  const hintedLayout = sectionIdFromHint(getSection(input.sections, "Layout Hint"));
  const hintedBackground = sectionIdFromHint(getSection(input.sections, "Background Hint"));

  const layoutPresetId =
    input.requestedLayoutPresetId && input.requestedLayoutPresetId !== "auto"
      ? input.requestedLayoutPresetId
      : hintedLayout || defaultLayoutForKind(contentKind, density);

  const backgroundPresetId =
    input.requestedBackgroundPresetId && input.requestedBackgroundPresetId !== "auto"
      ? input.requestedBackgroundPresetId
      : hintedBackground || defaultBackgroundForKind(contentKind, density);

  const zones = zonesForLayout(layoutPresetId, density, semantic);
  const warnings = [...density.warnings];

  if (semantic.hasStructuredFields && semantic.itemCount > 0) {
    warnings.push(
      `Semantic Visible Text detected: ${semantic.itemCount} item(s), pattern ${semantic.pattern}. Preserve each field inside the correct card/row/lane.`
    );
  }

  return {
    layoutPresetId,
    backgroundPresetId,
    contentKind,
    density,
    semantic,
    semanticSummary: semanticItemsToPromptSummary(semantic),
    zones,
    textPlacement:
      "Place exact Visible Text inside protected zones. Use semantic fields to keep Title, Body, Status, Remaining, Option, Phase, Lane, Date and Item values together. Never treat field lines as unrelated text.",
    imagePlacement:
      "Generate supporting imagery only around the visual zones. Avoid important details behind text zones, header or footer.",
    fontStrategy:
      density.level === "heavy" || density.level === "very_heavy"
        ? "Use compact hierarchy, smaller body type, grouped cards/rows and strong spacing discipline."
        : "Use strong title hierarchy, readable body type and generous whitespace.",
    imageGuidance:
      "Create imagery around the layout zones rather than placing text after a finished background. Preserve clean zones for text and cards.",
    warnings,
  };
}
