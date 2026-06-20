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
  requestedDocumentBackgroundPresetId?: string;
};

function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function isDocumentOutput(outputType: SolveLayoutInput["outputType"]): boolean {
  return outputType === "document" || outputType === "pdf";
}

function normalizeDocumentBackgroundPresetId(id?: string): string {
  if (!id || id === "auto") return "auto_brand_document";
  if (id === "clean_document") return "clean_white_form";
  return id;
}

function normalizeDocumentLayoutPresetId(id?: string): string | undefined {
  if (!id || id === "auto") return undefined;
  if (["brand_formatted_document", "document_template", "legal_document", "commercial_document"].includes(id)) {
    return id;
  }
  return undefined;
}

function detectContentKind(input: SolveLayoutInput, semantic: SemanticVisibleTextAnalysis): string {
  if (isDocumentOutput(input.outputType)) {
    const body = getSection(input.sections, "Body Content", "Document Body Content", "Body");
    const rules = getSection(input.sections, "Document Output Rules");
    const combined = [input.contentLabel, input.contentType, body, rules].join(" ");

    if (containsAny(combined, ["template", "blank fields", "completion fields", "checkbox", "scoring values"])) return "document_template";
    if (containsAny(combined, ["agreement", "novation", "contract", "terms", "schedule"])) return "legal_document";
    if (containsAny(combined, ["pricing", "commercial", "fees", "rate", "cost"])) return "commercial_document";
    return "document";
  }

  const visibleText = getSection(input.sections, "Visible Text");
  const combined = [
    input.contentLabel,
    input.contentType,
    visibleText,
    getSection(input.sections, "Image Brief"),
  ].join(" ");

  if (containsAny(combined, ["import market", "export market", "trade flow", "trade route", "supplying south africa"])) return "trade_flow";
  if (containsAny(combined, ["statistic:", "market size", "market share", "addressable market"])) return "market_statistics";
  if (containsAny(combined, ["market opportunity", "market position", "market demand", "participation economies"])) return "market_opportunity";
  if (containsAny(combined, ["business overview", "start coordinating action", "visibility to orchestration"])) return "opening_overview";
  if (containsAny(combined, ["operating problem", "fragmented execution", "operational drag", "disconnected systems"])) return "problem";
  if (containsAny(combined, ["control loop", "signals are identified", "risks are prioritised", "ownership is assigned"])) return "control_loop";
  if (containsAny(combined, ["core capabilities", "capability", "capabilities", "modules"])) return "capability_map";
  if (containsAny(combined, ["ai-assisted", "prioritise", "recommended actions", "operational noise"])) return "ai_priority";
  if (containsAny(combined, ["business outcomes"])) return "outcomes";
  if (containsAny(combined, ["forecasting and replenishment"])) return "forecasting";
  if (containsAny(combined, ["inventory control"])) return "inventory";
  if (containsAny(combined, ["forecasting", "replenishment", "planning horizon", "demand patterns"])) return "forecasting";
  if (containsAny(combined, ["stock movement", "expiry", "working capital", "cash tied"])) return "inventory";
  if (containsAny(combined, ["manual follow-up", "service reliability", "measurable operational performance"])) return "outcomes";
  if (containsAny(combined, ["supplier coordination", "order journey", "request", "dispatch", "receiving"])) return "supplier_journey";
  if (containsAny(combined, ["cross-industry", "use cases", "pharmacies", "healthcare", "agriculture", "warehousing"])) return "industry_constellation";
  if (containsAny(combined, ["operating layer", "sits between", "system replacement", "platform role", "without forcing"])) return "operating_layer";
  if (containsAny(combined, ["governance", "accountability", "auditability", "escalation", "closure"])) return "governance";
  if (containsAny(combined, ["call to action", "next step", "contact", "start with"])) return "cta";
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

  return "general";
}

function defaultLayoutForKind(kind: string, density: TextDensityAnalysis): string {
  switch (kind) {
    case "opening_overview": return "hero_scene_overlay";
    case "agenda": return "agenda_numbered_blocks";
    case "status_board": return "status_programme_board";
    case "readiness": return "status_readiness_cards";
    case "timeline_status": return "timeline_status_cards";
    case "roadmap": return "roadmap_lane_timeline";
    case "operational_actions": return "operational_action_cards";
    case "partnership_actions": return "partnership_action_tracker";
    case "executive_summary": return "executive_summary_cards";
    case "financial": return "financial_dashboard";
    case "control_loop": return "circular_control_loop";
    case "operating_layer": return "operating_layer_bridge";
    case "capability_map": return "capability_orbit_map";
    case "ai_priority": return "signal_priority_funnel";
    case "inventory": return "inventory_value_map";
    case "supplier_journey": return "supplier_journey_path";
    case "forecasting": return "forecasting_horizon";
    case "industry_constellation": return "industry_constellation";
    case "governance": return "governance_evidence_flow";
    case "outcomes": return "outcome_value_stream";
    case "flywheel": return "circular_control_loop";
    case "ecosystem": return "industry_ecosystem_map";
    case "comparison": return "comparison_split";
    case "market_opportunity": return density.level === "heavy" || density.level === "very_heavy"
      ? "executive_market_brief"
      : "market_opportunity_snapshot";
    case "market_statistics": return density.lineCount <= 8 ? "three_signal_summary" : "stat_card_grid";
    case "trade_flow": return "trade_flow_map";
    case "progress": return "governance_timeline";
    case "problem": return "converging_signal_map";
    case "cta": return "cta_action_path";
    default:
      if (density.level === "very_heavy") return "dense_text_editorial";
      return density.level === "heavy" ? "multi_panel_cards" : "capability_grid";
  }
}

function defaultBackgroundForKind(kind: string, density: TextDensityAnalysis): string {
  if (density.level === "very_heavy") return "balanced_in_between_depth";

  switch (kind) {
    case "opening_overview": return "rich_gradient_frame";
    case "agenda": return "balanced_brand_gradient";
    case "status_board": return "balanced_in_between_depth";
    case "readiness": return "soft_brand_depth";
    case "timeline_status": return "balanced_in_between_depth";
    case "roadmap": return "balanced_light_dark";
    case "operational_actions": return "balanced_in_between_depth";
    case "partnership_actions": return "balanced_in_between_depth";
    case "executive_summary": return "balanced_brand_gradient";
    case "financial": return "executive_depth_panels";
    case "control_loop": return "balanced_brand_gradient";
    case "operating_layer": return "balanced_in_between_depth";
    case "capability_map": return "rich_gradient_frame";
    case "ai_priority": return "brand_control_room_soft";
    case "inventory": return "executive_depth_panels";
    case "supplier_journey": return "balanced_light_dark";
    case "forecasting": return "rich_gradient_frame";
    case "industry_constellation": return "rich_gradient_frame";
    case "governance": return "executive_depth_panels";
    case "outcomes": return "balanced_brand_gradient";
    case "flywheel": return "balanced_brand_gradient";
    case "ecosystem": return "rich_gradient_frame";
    case "comparison": return "balanced_light_dark";
    case "market_opportunity": return "rich_gradient_frame";
    case "market_statistics": return "executive_depth_panels";
    case "trade_flow": return "balanced_brand_gradient";
    case "progress": return "executive_depth_panels";
    case "problem": return "brand_control_room_soft";
    case "cta": return "balanced_in_between_depth";
    default: return "balanced_in_between_depth";
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

  if (layoutId === "dense_text_editorial") {
    return [header, { name: "editorial-content", x: 6, y: 13, width: 88, height: 76, purpose: "Large structured text area with compact cards and section bands." }, footer];
  }

  if (layoutId === "hero_scene_overlay") {
    return [header, { name: "hero-title-stack", x: 6, y: 15, width: 54, height: 22, purpose: "Large title, subtitle and two bold highlighted statements over the scene." }, { name: "immersive-scene", x: 42, y: 12, width: 52, height: 70, purpose: "Striking operational scene or control-layer visual that can bleed behind translucent panels." }, { name: "proof-strip", x: 6, y: 68, width: 66, height: 18, purpose: "Compact highlighted proof/summary strip for final visible lines." }, footer];
  }

  if (layoutId === "converging_signal_map") {
    return [header, { name: "fragmented-signal-field", x: 5, y: 14, width: 90, height: 28, purpose: "Disconnected signal clusters around the top/edges." }, { name: "control-convergence", x: 28, y: 38, width: 44, height: 28, purpose: "Signals converge into a brighter coordinated action layer." }, { name: "impact-cards", x: 7, y: 70, width: 86, height: 17, purpose: "Bold highlighted impact statements." }, footer];
  }

  if (layoutId === "circular_control_loop") {
    return [header, { name: "central-loop", x: 29, y: 18, width: 42, height: 48, purpose: "Large centre-stage loop with icons/stages around the ring." }, { name: "title-band", x: 6, y: 14, width: 42, height: 18, purpose: "Bold title and opening statement integrated into the loop area." }, { name: "supporting-callouts", x: 6, y: 68, width: 88, height: 20, purpose: "Short exact-text callouts placed around or beneath the loop with coloured emphasis." }, footer];
  }

  if (layoutId === "signal_priority_funnel") {
    return [header, { name: "signal-cloud", x: 6, y: 14, width: 88, height: 24, purpose: "Many small signal particles/cards entering from top and sides." }, { name: "priority-core", x: 30, y: 38, width: 40, height: 26, purpose: "AI prioritisation layer, not a robot, compressing noise into decisions." }, { name: "action-markers", x: 12, y: 67, width: 76, height: 20, purpose: "Small set of recommended action cards with one yellow priority marker." }, footer];
  }

  if (layoutId === "operating_layer_bridge") {
    return [header, { name: "systems-layer", x: 6, y: 16, width: 88, height: 18, purpose: "Existing systems, suppliers, inventory and people as lower layer nodes." }, { name: "control-layer-spine", x: 12, y: 39, width: 76, height: 18, purpose: "Bright central SupplySync360 operating layer spanning across the slide." }, { name: "action-layer", x: 8, y: 62, width: 84, height: 25, purpose: "Ownership, accountability and next-action cards above the spine." }, footer];
  }

  if (layoutId === "capability_orbit_map") {
    return [header, { name: "central-platform-hub", x: 35, y: 27, width: 30, height: 28, purpose: "Central SupplySync360 operating layer hub." }, { name: "capability-orbit", x: 6, y: 13, width: 88, height: 72, purpose: "Capability clusters orbiting around the hub with compact coloured headers." }, footer];
  }

  if (layoutId === "inventory_value_map") {
    return [header, { name: "inventory-flow", x: 7, y: 17, width: 86, height: 26, purpose: "Stock movement and location-flow path." }, { name: "risk-value-core", x: 28, y: 42, width: 44, height: 22, purpose: "Cash/value/risk control point with highlighted risk cues." }, { name: "business-value-cards", x: 8, y: 68, width: 84, height: 18, purpose: "Working capital and reliability statements in bold cards." }, footer];
  }

  if (layoutId === "supplier_journey_path") {
    return [header, { name: "journey-path", x: 5, y: 22, width: 90, height: 34, purpose: "S-curve order journey from request to closure with exception marker." }, { name: "accountability-panel", x: 8, y: 60, width: 84, height: 25, purpose: "Transparency, accountability and execution statements in highlighted cards." }, footer];
  }

  if (layoutId === "forecasting_horizon") {
    return [header, { name: "planning-horizon", x: 7, y: 16, width: 86, height: 34, purpose: "Curved future horizon with demand, supply and replenishment flows." }, { name: "decision-signal", x: 32, y: 50, width: 36, height: 18, purpose: "Forward-looking decision point, no fake numbers." }, { name: "planning-benefits", x: 8, y: 70, width: 84, height: 16, purpose: "Benefit statements with bold highlighted final line." }, footer];
  }

  if (layoutId === "industry_constellation") {
    return [header, { name: "shared-control-layer", x: 32, y: 30, width: 36, height: 26, purpose: "Shared control layer at centre." }, { name: "industry-vignettes", x: 5, y: 13, width: 90, height: 68, purpose: "Differentiated operational environments connected as a constellation." }, footer];
  }

  if (layoutId === "governance_evidence_flow") {
    return [header, { name: "evidence-path", x: 8, y: 18, width: 84, height: 24, purpose: "Traceable path from issue to owner to closure." }, { name: "oversight-layer", x: 20, y: 45, width: 60, height: 20, purpose: "Executive oversight/control layer with approval and escalation cues." }, { name: "accountability-cards", x: 8, y: 68, width: 84, height: 18, purpose: "Governance statements in layered evidence cards." }, footer];
  }

  if (layoutId === "outcome_value_stream") {
    return [header, { name: "improvement-stream", x: 7, y: 15, width: 86, height: 28, purpose: "Operational improvements flowing left-to-right or bottom-to-top into value." }, { name: "outcome-wall", x: 9, y: 46, width: 82, height: 30, purpose: "Bold outcome cards with colour-coded emphasis, not generic icons." }, { name: "commercial-summary", x: 18, y: 78, width: 64, height: 10, purpose: "Final commercial statement highlighted as the takeaway." }, footer];
  }

  if (layoutId === "cta_action_path") {
    return [header, { name: "cta-stage", x: 9, y: 16, width: 82, height: 28, purpose: "Large next-step statement and executive action framing." }, { name: "proof-path", x: 12, y: 45, width: 76, height: 20, purpose: "Baseline, gap, model, measurement and scale path." }, { name: "contact-dock", x: 18, y: 70, width: 64, height: 17, purpose: "Clean contact details/action dock with strong visual priority." }, footer];
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
  const bodyText = getSection(input.sections, "Body Content", "Document Body Content", "Body");
  const isDocument = isDocumentOutput(input.outputType);
  const semantic = isDocument ? parseSemanticVisibleText("") : parseSemanticVisibleText(visibleText);
  const density = analyseVisibleText(isDocument ? bodyText || visibleText : visibleText);
  const contentKind = detectContentKind(input, semantic);

  const hintedLayout = sectionIdFromHint(getSection(input.sections, "Layout Hint"));
  const hintedBackground = sectionIdFromHint(getSection(input.sections, "Background Hint"));

  const layoutPresetId = isDocument
    ? normalizeDocumentLayoutPresetId(hintedLayout) || "brand_formatted_document"
    : input.requestedLayoutPresetId && input.requestedLayoutPresetId !== "auto"
      ? input.requestedLayoutPresetId
      : hintedLayout || defaultLayoutForKind(contentKind, density);

  const backgroundPresetId = isDocument
    ? normalizeDocumentBackgroundPresetId(input.requestedDocumentBackgroundPresetId || hintedBackground)
    :
    input.requestedBackgroundPresetId && input.requestedBackgroundPresetId !== "auto"
      ? input.requestedBackgroundPresetId
      : hintedBackground || defaultBackgroundForKind(contentKind, density);

  const zones = isDocument ? [] : zonesForLayout(layoutPresetId, density, semantic);
  const warnings = isDocument ? [] : [...density.warnings];

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
      "Place exact Visible Text inside protected zones, but vary composition by content. Use bold hierarchy, coloured emphasis, highlight pills, callout bands and accent rules to make key phrases stand out. Use semantic fields to keep Title, Body, Status, Remaining, Option, Phase, Lane, Date and Item values together. Never treat field lines as unrelated text.",
    imagePlacement:
      "Generate striking, content-specific imagery around the layout zones. Avoid repeated text-left/image-right splits unless explicitly requested. Avoid important details behind text zones, header or footer.",
    fontStrategy:
      density.level === "heavy" || density.level === "very_heavy"
        ? "Use compact hierarchy, smaller body type, grouped cards/rows and strong spacing discipline."
        : "Use strong title hierarchy, readable body type and generous whitespace.",
    imageGuidance:
      "Create imagery around the layout zones rather than placing text after a finished background. Make images dimensional, colour-rich and specific to the operating story. Preserve clean zones for text and cards.",
    warnings,
  };
}
