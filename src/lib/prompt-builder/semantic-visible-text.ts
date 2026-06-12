export type SemanticFieldName =
  | "title"
  | "body"
  | "status"
  | "remaining"
  | "phase"
  | "timeline"
  | "date"
  | "lane"
  | "item"
  | "option"
  | "metric"
  | "owner"
  | "action"
  | "cta"
  | "note"
  | "section"
  | "plain";

export type SemanticFieldLine = {
  field: SemanticFieldName;
  label: string;
  value: string;
  original: string;
  lineNumber: number;
};

export type SemanticVisibleTextItem = {
  id: string;
  kind:
    | "title_card"
    | "status_card"
    | "phase"
    | "timeline"
    | "lane"
    | "item"
    | "metric"
    | "plain_group";
  title: string;
  body: string[];
  status: string[];
  remaining: string[];
  options: string[];
  fields: SemanticFieldLine[];
  rawLines: string[];
};

export type SemanticVisibleTextPattern =
  | "empty"
  | "agenda"
  | "status_board"
  | "readiness_board"
  | "timeline_status"
  | "roadmap_lanes"
  | "operational_action_tracker"
  | "partnership_action_tracker"
  | "executive_summary_cards"
  | "financial_or_metric_cards"
  | "mixed_cards"
  | "plain_text";

export type SemanticVisibleTextAnalysis = {
  originalText: string;
  hasStructuredFields: boolean;
  fields: SemanticFieldLine[];
  fieldNames: SemanticFieldName[];
  items: SemanticVisibleTextItem[];
  primaryTitle: string;
  itemCount: number;
  statusCount: number;
  laneCount: number;
  dateCount: number;
  optionCount: number;
  pattern: SemanticVisibleTextPattern;
  patternConfidence: "low" | "medium" | "high";
  exactLines: string[];
  warnings: string[];
};

const fieldAliases: Record<string, SemanticFieldName> = {
  title: "title",
  heading: "title",
  card: "title",
  body: "body",
  description: "body",
  detail: "body",
  details: "body",
  context: "body",
  status: "status",
  remaining: "remaining",
  dependency: "remaining",
  dependencies: "remaining",
  phase: "phase",
  timeline: "timeline",
  date: "date",
  week: "date",
  lane: "lane",
  stream: "lane",
  workstream: "lane",
  item: "item",
  activity: "item",
  option: "option",
  metric: "metric",
  value: "metric",
  owner: "owner",
  action: "action",
  cta: "cta",
  note: "note",
  section: "section",
};

function normalizeFieldName(input: string): SemanticFieldName | null {
  const key = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  return fieldAliases[key] || null;
}

function parseFieldLine(
  line: string,
  lineNumber: number
): SemanticFieldLine | null {
  const match = line.match(/^([A-Za-z][A-Za-z0-9 /&_.-]{0,38}):\s*(.+)$/);
  if (!match) return null;

  const field = normalizeFieldName(match[1]);
  if (!field) return null;

  return {
    field,
    label: match[1].trim(),
    value: match[2].trim(),
    original: line.trim(),
    lineNumber,
  };
}

function createItem(
  kind: SemanticVisibleTextItem["kind"],
  seed: SemanticFieldLine,
  index: number
): SemanticVisibleTextItem {
  const item: SemanticVisibleTextItem = {
    id: `${kind}-${index}`,
    kind,
    title: "",
    body: [],
    status: [],
    remaining: [],
    options: [],
    fields: [seed],
    rawLines: [seed.original],
  };

  applyFieldToItem(item, seed);
  return item;
}

function applyFieldToItem(
  item: SemanticVisibleTextItem,
  field: SemanticFieldLine
): void {
  if (!item.fields.includes(field)) item.fields.push(field);
  if (!item.rawLines.includes(field.original)) item.rawLines.push(field.original);

  switch (field.field) {
    case "title":
    case "phase":
    case "lane":
    case "timeline":
    case "item":
    case "metric":
    case "section":
      if (!item.title) item.title = field.value;
      else if (field.field === "item") item.body.push(field.value);
      break;
    case "body":
    case "note":
    case "owner":
    case "action":
    case "cta":
      item.body.push(field.value);
      break;
    case "status":
      item.status.push(field.value);
      break;
    case "remaining":
      item.remaining.push(field.value);
      break;
    case "option":
      item.options.push(field.value);
      break;
    case "date":
      item.body.push(field.value);
      break;
    case "plain":
      if (!item.title) item.title = field.value;
      else item.body.push(field.value);
      break;
  }
}

function itemKindForStartingField(
  field: SemanticFieldName
): SemanticVisibleTextItem["kind"] {
  switch (field) {
    case "phase":
      return "phase";
    case "timeline":
      return "timeline";
    case "lane":
      return "lane";
    case "item":
      return "item";
    case "metric":
      return "metric";
    default:
      return "title_card";
  }
}

function shouldStartNewItem(
  field: SemanticFieldLine,
  current: SemanticVisibleTextItem | null
): boolean {
  if (!current) return true;

  if (["title", "phase", "timeline", "lane", "metric", "section"].includes(field.field)) {
    return true;
  }

  if (field.field === "item" && current.kind !== "lane" && current.kind !== "timeline") {
    return true;
  }

  if (field.field === "date" && current.kind !== "timeline") {
    return true;
  }

  return false;
}

function parseStructuredItems(fields: SemanticFieldLine[]): SemanticVisibleTextItem[] {
  const items: SemanticVisibleTextItem[] = [];
  let current: SemanticVisibleTextItem | null = null;

  for (const field of fields) {
    if (shouldStartNewItem(field, current)) {
      current = createItem(itemKindForStartingField(field.field), field, items.length + 1);
      items.push(current);
    } else {
      if (current) applyFieldToItem(current, field);
    }
  }

  return items.map((item, index) => ({
    ...item,
    id: `${item.kind}-${index + 1}`,
  }));
}

function parsePlainGroups(lines: string[]): SemanticVisibleTextItem[] {
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) groups.push(current);
      current = [];
    } else {
      current.push(line.trim());
    }
  }

  if (current.length > 0) groups.push(current);

  return groups.map((group, index) => ({
    id: `plain-group-${index + 1}`,
    kind: "plain_group",
    title: group[0] || "",
    body: group.slice(1),
    status: [],
    remaining: [],
    options: [],
    fields: group.map((line, lineIndex) => ({
      field: "plain",
      label: "Plain",
      value: line,
      original: line,
      lineNumber: lineIndex + 1,
    })),
    rawLines: group,
  }));
}

function includesAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function detectPattern(input: {
  items: SemanticVisibleTextItem[];
  fields: SemanticFieldLine[];
  originalText: string;
}): {
  pattern: SemanticVisibleTextPattern;
  confidence: SemanticVisibleTextAnalysis["patternConfidence"];
} {
  const { items, fields, originalText } = input;

  if (items.length === 0) return { pattern: "empty", confidence: "high" };

  const fieldSet = new Set(fields.map((field) => field.field));
  const titleCount = fields.filter((field) => field.field === "title").length;
  const statusCount = fields.filter((field) => field.field === "status").length;
  const remainingCount = fields.filter((field) => field.field === "remaining").length;
  const laneCount = fields.filter((field) => field.field === "lane").length;
  const dateCount = fields.filter((field) => field.field === "date").length;
  const phaseCount = fields.filter((field) => field.field === "phase").length;
  const optionCount = fields.filter((field) => field.field === "option").length;
  const bodyCount = fields.filter((field) => field.field === "body").length;

  if (laneCount > 0 || dateCount >= 3 || fieldSet.has("timeline")) {
    return { pattern: "roadmap_lanes", confidence: "high" };
  }

  if (phaseCount >= 2) {
    return { pattern: "timeline_status", confidence: "high" };
  }

  if (includesAny(originalText, ["agenda", "kpi update", "operational update"]) && titleCount >= 3 && statusCount === 0) {
    return { pattern: "agenda", confidence: "high" };
  }

  if (optionCount > 0 || includesAny(originalText, ["failover", "penetration test", "dormant wallets", "operational items"])) {
    return { pattern: "operational_action_tracker", confidence: "high" };
  }

  if (includesAny(originalText, ["invoicing", "contract", "proposal", "leads generation", "business plan"])) {
    return { pattern: "partnership_action_tracker", confidence: "high" };
  }

  if (remainingCount > 0 || includesAny(originalText, ["readiness", "completed", "remaining"])) {
    return { pattern: "readiness_board", confidence: "high" };
  }

  if (statusCount >= 2 && titleCount >= 2) {
    return { pattern: "status_board", confidence: "high" };
  }

  if (includesAny(originalText, ["executive summary", "summary"]) && titleCount >= 3 && bodyCount >= 3) {
    return { pattern: "executive_summary_cards", confidence: "medium" };
  }

  if (fieldSet.has("metric") || includesAny(originalText, ["revenue", "ebitda", "forecast", "metric"])) {
    return { pattern: "financial_or_metric_cards", confidence: "medium" };
  }

  if (titleCount >= 2) {
    return { pattern: "mixed_cards", confidence: "medium" };
  }

  return { pattern: "plain_text", confidence: "low" };
}

export function parseSemanticVisibleText(visibleText?: string): SemanticVisibleTextAnalysis {
  const originalText = visibleText || "";
  const rawLines = originalText.split("\n");
  const exactLines = rawLines.map((line) => line.trim()).filter(Boolean);
  const fields = rawLines
    .map((line, index) => parseFieldLine(line.trim(), index + 1))
    .filter((field): field is SemanticFieldLine => Boolean(field));

  const hasStructuredFields = fields.length > 0;
  const items = hasStructuredFields
    ? parseStructuredItems(fields)
    : parsePlainGroups(rawLines);

  const primaryTitle =
    items.find((item) => item.title)?.title || exactLines[0] || "Untitled";

  const fieldNames = Array.from(new Set(fields.map((field) => field.field)));
  const patternResult = detectPattern({ items, fields, originalText });
  const warnings: string[] = [];

  if (!originalText.trim()) {
    warnings.push("Visible Text is empty.");
  }

  if (!hasStructuredFields && exactLines.length > 6) {
    warnings.push(
      "Visible Text has many plain lines. Use simple fields like Title:, Body: and Status: to improve dynamic layout interpretation."
    );
  }

  if (items.length > 8 && patternResult.pattern !== "roadmap_lanes") {
    warnings.push(
      `Detected ${items.length} content items. Use a dense card grid, action tracker or split the visual if readability suffers.`
    );
  }

  return {
    originalText,
    hasStructuredFields,
    fields,
    fieldNames,
    items,
    primaryTitle,
    itemCount: items.length,
    statusCount: fields.filter((field) => field.field === "status").length,
    laneCount: fields.filter((field) => field.field === "lane").length,
    dateCount: fields.filter((field) => field.field === "date").length,
    optionCount: fields.filter((field) => field.field === "option").length,
    pattern: patternResult.pattern,
    patternConfidence: patternResult.confidence,
    exactLines,
    warnings,
  };
}

export function semanticItemsToPromptSummary(
  analysis: SemanticVisibleTextAnalysis
): string {
  if (analysis.items.length === 0) return "No visible text items detected.";

  const itemLines = analysis.items.map((item, index) => {
    const parts = [`${index + 1}. ${item.title || "Untitled"}`];
    if (item.status.length > 0) parts.push(`Status: ${item.status.join(" | ")}`);
    if (item.remaining.length > 0) parts.push(`Remaining: ${item.remaining.join(" | ")}`);
    if (item.body.length > 0) parts.push(`Body: ${item.body.join(" | ")}`);
    if (item.options.length > 0) parts.push(`Options: ${item.options.join(" | ")}`);
    return parts.join("; ");
  });

  return [
    `Pattern: ${analysis.pattern}`,
    `Items detected: ${analysis.itemCount}`,
    `Fields detected: ${analysis.fieldNames.join(", ") || "none"}`,
    ...itemLines,
  ].join("\n");
}
