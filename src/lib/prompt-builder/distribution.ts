export type DistributionChannel = "email" | "whatsapp" | "linkedin";
export type DistributionStatus = "planned" | "sent";

export type DistributionRecord = {
  id: string;
  projectFolder: string;
  projectLabel: string;
  contentLabel: string;
  contentSourcePath?: string;
  generatedContentIds: string[];
  recipient: string;
  channel: DistributionChannel;
  status: DistributionStatus;
  plannedDate?: string;
  sentDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type DistributionDraft = Omit<DistributionRecord, "id" | "recipient" | "createdAt" | "updatedAt"> & {
  recipients: string[];
  dateUnknown?: boolean;
};

export type DistributionFilters = {
  projectFolder?: string;
  channel?: DistributionChannel | "all";
  status?: DistributionStatus | "all";
  recipient?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  folder?: string;
};

export const distributionChannels: Array<{ id: DistributionChannel; label: string }> = [
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "linkedin", label: "LinkedIn" },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDistributionDate(value?: string): boolean {
  if (!value) return true;
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateDistributionDraft(input: DistributionDraft): string[] {
  const errors: string[] = [];
  if (!input.projectFolder?.trim()) errors.push("Project is required.");
  if (!input.projectLabel?.trim()) errors.push("Project label is required.");
  if (!input.contentLabel?.trim()) errors.push("Content label is required.");
  if (!input.contentSourcePath?.trim() && (!Array.isArray(input.generatedContentIds) || input.generatedContentIds.length === 0)) {
    errors.push("Choose source content or at least one generated file.");
  }
  if (!Array.isArray(input.recipients) || !input.recipients.some((recipient) => recipient?.trim())) errors.push("At least one recipient is required.");
  if (!distributionChannels.some((channel) => channel.id === input.channel)) errors.push("Choose a valid channel.");
  if (input.status !== "planned" && input.status !== "sent") errors.push("Choose a valid status.");
  if (input.status === "planned" && !input.plannedDate) errors.push("Planned date is required for planned distributions.");
  if (!isValidDistributionDate(input.plannedDate)) errors.push("Planned date must use YYYY-MM-DD.");
  if (!isValidDistributionDate(input.sentDate)) errors.push("Sent date must use YYYY-MM-DD.");
  return errors;
}

export function validateDistributionRecord(input: DistributionRecord): string[] {
  return validateDistributionDraft({
    ...input,
    recipients: [input.recipient],
  });
}

export function withDefaultDistributionDate(draft: DistributionDraft, today: string): DistributionDraft {
  if (draft.status === "planned" && !draft.plannedDate) return { ...draft, plannedDate: today };
  if (draft.status === "sent" && !draft.sentDate && !draft.dateUnknown) return { ...draft, sentDate: today };
  return draft;
}

export function createDistributionRecordsFromDraft(
  draft: DistributionDraft,
  createId: () => string,
  now: string
): DistributionRecord[] {
  const recipients = Array.from(new Set(draft.recipients.map((recipient) => recipient.trim()).filter(Boolean)));
  const recordFields = Object.fromEntries(
    Object.entries(draft).filter(([key]) => key !== "recipients" && key !== "dateUnknown")
  ) as Omit<DistributionDraft, "recipients" | "dateUnknown">;
  return recipients.map((recipient) => ({
    ...recordFields,
    id: createId(),
    recipient,
    generatedContentIds: Array.from(new Set(draft.generatedContentIds)),
    createdAt: now,
    updatedAt: now,
  }));
}

export function filterDistributionRecords(
  records: DistributionRecord[],
  filters: DistributionFilters
): DistributionRecord[] {
  const search = filters.search?.trim().toLowerCase() || "";
  return records.filter((record) => {
    const effectiveDate = record.status === "sent" ? record.sentDate : record.plannedDate;
    if (filters.projectFolder && record.projectFolder !== filters.projectFolder) return false;
    if (filters.channel && filters.channel !== "all" && record.channel !== filters.channel) return false;
    if (filters.status && filters.status !== "all" && record.status !== filters.status) return false;
    if (filters.recipient && record.recipient !== filters.recipient) return false;
    if (filters.dateFrom && (!effectiveDate || effectiveDate < filters.dateFrom)) return false;
    if (filters.dateTo && (!effectiveDate || effectiveDate > filters.dateTo)) return false;
    if (filters.folder && ![record.contentSourcePath, ...record.generatedContentIds].filter(Boolean).some((ref) => ref?.replace(/\\/g, "/").includes(`/${filters.folder}/`) || ref?.replace(/\\/g, "/").includes(filters.folder!))) return false;
    if (search && ![record.contentLabel, record.projectLabel, record.recipient, record.channel]
      .join(" ").toLowerCase().includes(search)) return false;
    return true;
  });
}

export function isDistributionOverdue(record: DistributionRecord, today: string): boolean {
  return record.status === "planned" && Boolean(record.plannedDate && record.plannedDate < today);
}

export function sortUpcomingDistribution(records: DistributionRecord[]): DistributionRecord[] {
  return records
    .filter((record) => record.status === "planned")
    .sort((a, b) => (a.plannedDate || "9999-12-31").localeCompare(b.plannedDate || "9999-12-31"));
}

export function sortSentDistribution(records: DistributionRecord[]): DistributionRecord[] {
  return records
    .filter((record) => record.status === "sent")
    .sort((a, b) => (b.sentDate || "").localeCompare(a.sentDate || "") || b.updatedAt.localeCompare(a.updatedAt));
}
