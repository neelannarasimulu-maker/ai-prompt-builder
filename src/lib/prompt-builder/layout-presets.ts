export type LayoutPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const layoutPresets: LayoutPreset[] = [
  {
    id: "auto",
    label: "Auto / Content-Aware",
    prompt:
      "Choose a content-aware layout based on visible text structure, density, semantic fields and message. Reserve fixed header/footer zones, define clean text/image zones and preserve all supplied visible text.",
  },
  {
    id: "agenda_numbered_blocks",
    label: "Agenda Numbered Blocks",
    prompt:
      "Use a clean agenda layout with one distinct block per agenda item. Number the items visually only where appropriate and keep the agenda title separate.",
  },
  {
    id: "status_programme_board",
    label: "Status Programme Board",
    prompt:
      "Use a programme status-board layout. Treat each Title item as a separate workstream card and use Status fields as status text inside the correct card.",
  },
  {
    id: "status_readiness_cards",
    label: "Status Readiness Cards",
    prompt:
      "Use readiness cards with completion or remaining-action markers. Each Title becomes a readiness card with Status, Remaining and Body fields nested within it.",
  },
  {
    id: "timeline_status_cards",
    label: "Timeline Status Cards",
    prompt:
      "Use a timeline with supporting status cards. Treat Phase fields as timeline milestones and Title/Status items as action cards.",
  },
  {
    id: "roadmap_lane_timeline",
    label: "Roadmap Lane Timeline",
    prompt:
      "Use a roadmap with Date fields as columns, Lane fields as horizontal lanes and Item fields as activities in those lanes.",
  },
  {
    id: "operational_action_cards",
    label: "Operational Action Cards",
    prompt:
      "Use operational action cards. Each Title becomes an action item; Body, Option and Status fields are nested within the same card.",
  },
  {
    id: "partnership_action_tracker",
    label: "Partnership Action Tracker",
    prompt:
      "Use an executive action tracker with grouped rows or cards. Each Title becomes a partnership action; Body and Status fields show context and current position.",
  },
  {
    id: "executive_summary_cards",
    label: "Executive Summary Cards",
    prompt:
      "Use concise executive summary cards with one clear statement per card. Keep the summary title separate from the cards.",
  },
  {
    id: "executive_opening_split",
    label: "Executive Opening Split",
    prompt:
      "Use a premium opening layout with a strong headline zone, concise narrative grouping and a supporting visual zone. Best for low-to-medium text.",
  },
  {
    id: "problem_network_map",
    label: "Problem Network Map",
    prompt:
      "Use a diagnostic problem-map layout with fragmented signals or disconnected nodes pulled into focus. Place text in a protected panel and keep visual activity away from the text zone.",
  },
  {
    id: "circular_control_loop",
    label: "Circular Control Loop",
    prompt:
      "Use a circular or loop-based operating model showing sequence, accountability and feedback. Reserve stage labels around the loop and keep supporting text grouped.",
  },
  {
    id: "operating_layer_bridge",
    label: "Operating Layer Bridge",
    prompt:
      "Use a bridge/layer layout showing a platform or spine connecting systems, people and operational routes. Keep text in one or two protected zones.",
  },
  {
    id: "capability_grid",
    label: "Capability Grid",
    prompt:
      "Use a modular grid with grouped capability cards and subtle connectors. Best for bullet-heavy content that needs structure.",
  },
  {
    id: "timeline_flow",
    label: "Timeline Flow",
    prompt:
      "Use a timeline flow with clear milestones, sequence and action cards. Keep dates and phases distinct.",
  },
  {
    id: "hero_statement_cards",
    label: "Hero Statement Cards",
    prompt:
      "Use a hero title with grouped supporting statement cards. Best for summary or position-at-a-glance slides.",
  },
  {
    id: "multi_panel_cards",
    label: "Multi-Panel Cards",
    prompt:
      "Use a multi-panel card layout with grouped content zones, short headings and supporting visual elements. Best for heavy visible text.",
  },
  {
    id: "dense_text_editorial",
    label: "Dense Text Editorial",
    prompt:
      "Use an editorial layout with structured text blocks, section bands and minimal supporting imagery. Best when visible text is too dense for a hero layout.",
  },
  {
    id: "comparison_split",
    label: "Comparison Split",
    prompt:
      "Use a clear left-versus-right comparison layout with a bridging or differentiating centre element.",
  },
  {
    id: "financial_dashboard",
    label: "Financial Dashboard",
    prompt:
      "Use a premium financial presentation layout with charts, forecast cards, capital allocation panels and clear financial hierarchy.",
  },
  {
    id: "outcome_scorecard",
    label: "Outcome Scorecard",
    prompt:
      "Use grouped outcome cards, financial cards or metric panels with clear hierarchy. Best for outcome or financial summary content.",
  },
  {
    id: "cta_action_path",
    label: "CTA Action Path",
    prompt:
      "Use a call-to-action path with a clear next step and compact contact area. Keep visual support secondary.",
  },
  {
    id: "industry_ecosystem_map",
    label: "Industry Ecosystem Map",
    prompt:
      "Use an ecosystem map with multiple industry or participant groups connected to a central platform or spine.",
  },
  {
    id: "governance_timeline",
    label: "Governance Timeline",
    prompt:
      "Use a milestone or accountability timeline showing progress, ownership, escalation, approval, closure and evidence.",
  },
];

export function getLayoutPreset(id?: string): LayoutPreset {
  return layoutPresets.find((preset) => preset.id === id) ?? layoutPresets[0];
}
