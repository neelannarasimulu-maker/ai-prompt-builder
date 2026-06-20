import { useEffect, useMemo, useState } from "react";
import {
  createDistributionRecords,
  deleteDistributionRecord,
  distributionChannels,
  filterDistributionRecords,
  isDistributionOverdue,
  listDistributionRecords,
  listProjectGeneratedContent,
  loadRuntimeProject,
  sortSentDistribution,
  sortUpcomingDistribution,
  updateDistributionRecord,
  validateDistributionDraft,
  type DistributionChannel,
  type DistributionDraft,
  type DistributionRecord,
  type DistributionStatus,
  type GeneratedContentFile,
  type RuntimeContentFile,
} from "../../lib/prompt-builder";

export type DistributionProjectOption = { id: string; brandId: string; label: string; folder: string };
export type DistributionPrefill = { projectFolder: string; contentLabel: string; generatedContentIds: string[] };

type DistributionPanelProps = {
  project: DistributionProjectOption | null;
  writable: boolean;
  prefill?: DistributionPrefill | null;
  onPrefillConsumed?: () => void;
  onNotice: (message: string, type?: "success" | "warning" | "info") => void;
};

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function emptyDraft(project: DistributionProjectOption | null, today: string): DistributionDraft {
  return {
    projectFolder: project?.folder || "", projectLabel: project?.label || "", contentLabel: "",
    contentSourcePath: "", generatedContentIds: [], recipients: [""], channel: "email", status: "planned",
    plannedDate: today, sentDate: today,
  };
}

function folderOfGenerated(file: GeneratedContentFile): string {
  const parts = file.generatedRelativePath.replace(/\\/g, "/").split("/");
  return parts.slice(0, -1).join("/") || "Unfiled";
}

function folderOfSource(file: RuntimeContentFile): string {
  const parts = file.path.replace(/\\/g, "/").split("/");
  return parts.at(-2) || file.type || "content";
}

export function DistributionPanel({ project, writable, prefill, onPrefillConsumed, onNotice }: DistributionPanelProps) {
  const today = localToday();
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [draft, setDraft] = useState<DistributionDraft>(() => emptyDraft(project, today));
  const [editing, setEditing] = useState<DistributionRecord | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedContentFile[]>([]);
  const [sourceFiles, setSourceFiles] = useState<RuntimeContentFile[]>([]);
  const [contentMode, setContentMode] = useState<"generated" | "source">("generated");
  const [contentFolder, setContentFolder] = useState("");
  const [dateUnknown, setDateUnknown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [channelFilter, setChannelFilter] = useState<DistributionChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DistributionStatus | "all">("all");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  async function refreshRecords(projectFolder = project?.folder) {
    if (!projectFolder) return;
    try { setRecords(await listDistributionRecords(projectFolder)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load distribution history."); }
  }

  useEffect(() => {
    if (!project) { setRecords([]); setGeneratedFiles([]); setSourceFiles([]); return; }
    let cancelled = false;
    setDraft(emptyDraft(project, today));
    setEditing(null); setContentMode("generated"); setContentFolder(""); setDateUnknown(false);
    setRecipientFilter("");
    void refreshRecords(project.folder);
    Promise.all([
      listProjectGeneratedContent({ projectFolder: project.folder, category: "all" }),
      loadRuntimeProject(project.brandId, project.id),
    ]).then(([generated, runtime]) => {
      if (!cancelled) { setGeneratedFiles(generated.files); setSourceFiles(runtime.files.filter((file) => file.type !== "project")); }
    }).catch(() => { if (!cancelled) { setGeneratedFiles([]); setSourceFiles([]); } });
    return () => { cancelled = true; };
  }, [project?.brandId, project?.folder, project?.id]);

  useEffect(() => {
    if (!prefill || prefill.projectFolder !== project?.folder) return;
    setDraft({ ...emptyDraft(project, today), contentLabel: prefill.contentLabel, generatedContentIds: prefill.generatedContentIds });
    setContentMode("generated");
    const matched = generatedFiles.find((file) => prefill.generatedContentIds.includes(file.id));
    if (matched) setContentFolder(folderOfGenerated(matched));
    onPrefillConsumed?.();
  }, [prefill, project?.folder, generatedFiles, onPrefillConsumed]);

  const generatedFolders = useMemo(() => Array.from(new Set(generatedFiles.map(folderOfGenerated))).sort(), [generatedFiles]);
  const sourceFolders = useMemo(() => Array.from(new Set(sourceFiles.map(folderOfSource))).sort(), [sourceFiles]);
  const availableFolders = contentMode === "generated" ? generatedFolders : sourceFolders;
  const visibleGenerated = generatedFiles.filter((file) => !contentFolder || folderOfGenerated(file) === contentFolder);
  const visibleSources = sourceFiles.filter((file) => !contentFolder || folderOfSource(file) === contentFolder);
  const historyFolders = useMemo(() => Array.from(new Set([
    ...generatedFolders,
    ...sourceFolders,
  ])).sort(), [generatedFolders, sourceFolders]);
  const recipients = useMemo(() => Array.from(new Set(records.map((record) => record.recipient))).sort((left, right) => left.localeCompare(right)), [records]);
  const filtered = useMemo(() => filterDistributionRecords(records, {
    channel: channelFilter, status: statusFilter, recipient: recipientFilter, folder: folderFilter, dateFrom, dateTo, search,
  }), [records, channelFilter, statusFilter, recipientFilter, folderFilter, dateFrom, dateTo, search]);
  const upcoming = useMemo(() => sortUpcomingDistribution(filtered), [filtered]);
  const sent = useMemo(() => sortSentDistribution(filtered), [filtered]);
  const overdue = records.filter((record) => isDistributionOverdue(record, today)).length;

  function selectMode(mode: "generated" | "source") {
    setContentMode(mode); setContentFolder("");
    setDraft((current) => ({ ...current, contentSourcePath: "", generatedContentIds: [], contentLabel: "" }));
  }

  function toggleGenerated(file: GeneratedContentFile) {
    setDraft((current) => ({
      ...current,
      contentLabel: current.contentLabel || file.displayName || file.filename,
      generatedContentIds: current.generatedContentIds.includes(file.id)
        ? current.generatedContentIds.filter((id) => id !== file.id)
        : [...current.generatedContentIds, file.id],
    }));
  }

  function selectSource(file: RuntimeContentFile) {
    setDraft((current) => ({ ...current, contentSourcePath: file.path, generatedContentIds: [], contentLabel: file.label }));
  }

  function resetForm() {
    setEditing(null); setDraft(emptyDraft(project, today)); setDateUnknown(false); setContentMode("generated"); setContentFolder("");
  }

  async function save() {
    const candidate: DistributionDraft = {
      ...draft,
      recipients: draft.recipients.map((recipient) => recipient.trim()).filter(Boolean),
      contentSourcePath: draft.contentSourcePath || undefined,
      plannedDate: draft.status === "planned" ? (draft.plannedDate || today) : draft.plannedDate || undefined,
      sentDate: draft.status === "sent" && !dateUnknown ? (draft.sentDate || today) : undefined,
      dateUnknown,
    };
    const errors = validateDistributionDraft(candidate);
    if (errors.length) { onNotice(errors.join(" "), "warning"); return; }
    setIsSaving(true);
    try {
      if (editing) {
        const { recipients, ...fields } = candidate;
        await updateDistributionRecord(editing.id, { ...editing, ...fields, recipient: recipients[0] });
        onNotice("Distribution updated.");
      } else {
        const created = await createDistributionRecords(candidate);
        onNotice(`${created.length} distribution record(s) saved.`);
      }
      resetForm(); await refreshRecords();
    } catch (caught) { onNotice(caught instanceof Error ? caught.message : "Could not save distribution.", "warning"); }
    finally { setIsSaving(false); }
  }

  function editRecord(record: DistributionRecord) {
    setEditing(record); setDateUnknown(record.status === "sent" && !record.sentDate);
    setDraft({ ...record, recipients: [record.recipient], contentSourcePath: record.contentSourcePath || "", plannedDate: record.plannedDate || today, sentDate: record.sentDate || today });
    const generated = generatedFiles.find((file) => record.generatedContentIds.includes(file.id));
    const source = sourceFiles.find((file) => file.path === record.contentSourcePath);
    setContentMode(generated ? "generated" : "source"); setContentFolder(generated ? folderOfGenerated(generated) : source ? folderOfSource(source) : "");
  }

  function distributeAgain(record: DistributionRecord) {
    setEditing(null); setDateUnknown(false);
    setDraft({
      ...emptyDraft(project, today), contentLabel: record.contentLabel, contentSourcePath: record.contentSourcePath || "",
      generatedContentIds: record.generatedContentIds, channel: record.channel,
    });
    const generated = generatedFiles.find((file) => record.generatedContentIds.includes(file.id));
    setContentMode(generated ? "generated" : "source");
    if (generated) setContentFolder(folderOfGenerated(generated));
  }

  async function markSent(record: DistributionRecord) {
    try { await updateDistributionRecord(record.id, { ...record, status: "sent", sentDate: today }); await refreshRecords(); onNotice("Marked as sent."); }
    catch (caught) { onNotice(caught instanceof Error ? caught.message : "Could not update distribution.", "warning"); }
  }

  async function remove(record: DistributionRecord) {
    if (!window.confirm(`Delete the distribution record for ${record.contentLabel}?`)) return;
    try { await deleteDistributionRecord(record.projectFolder, record.id); await refreshRecords(); onNotice("Distribution deleted."); }
    catch (caught) { onNotice(caught instanceof Error ? caught.message : "Could not delete distribution.", "warning"); }
  }

  function recordCard(record: DistributionRecord) {
    const isOverdue = isDistributionOverdue(record, today);
    return <article className="distribution-record" key={record.id}>
      <div><span className={`distribution-status ${isOverdue ? "overdue" : record.status}`}>{isOverdue ? "Overdue" : record.status}</span><strong>{record.contentLabel}</strong><p>{record.recipient} via {distributionChannels.find((item) => item.id === record.channel)?.label}</p><small>{record.status === "planned" ? `Planned: ${record.plannedDate}` : `Sent: ${record.sentDate || "Date unknown"}`} · {record.generatedContentIds.length} generated file(s)</small></div>
      <div className="distribution-record-actions">
        {record.status === "planned" && <button className="primary-button compact-button" type="button" onClick={() => markSent(record)}>Mark sent</button>}
        <button className="secondary-button compact-button" type="button" onClick={() => distributeAgain(record)}>Distribute again</button>
        <button className="secondary-button compact-button" type="button" onClick={() => editRecord(record)}>Edit</button>
        <button className="quiet-button compact-button" type="button" onClick={() => remove(record)}>Delete</button>
      </div>
    </article>;
  }

  if (!project) return <div className="distribution-empty">Choose a brand and project.</div>;

  return <div className="distribution-module">
    <div className="distribution-heading"><div><p className="eyebrow">Distribution · {project.label}</p><h2>Plan and record delivery</h2></div><button className="secondary-button" type="button" onClick={() => refreshRecords()}>Refresh</button></div>
    {error && <div className="distribution-error" role="alert">{error}</div>}
    <div className="distribution-metrics"><div><span>{records.filter((record) => record.status === "planned").length}</span><small>planned</small></div><div><span>{overdue}</span><small>overdue</small></div><div><span>{records.filter((record) => record.status === "sent").length}</span><small>sent</small></div></div>

    <section className="distribution-form" aria-label="Distribution entry form">
      <div className="distribution-form-title"><h3>{editing ? "Edit distribution" : "New distribution"}</h3>{editing && <button className="quiet-button" type="button" onClick={resetForm}>Cancel edit</button>}</div>
      <div className="distribution-content-controls">
        <div className="segmented-toggle distribution-source-toggle"><button type="button" className={contentMode === "generated" ? "active" : ""} onClick={() => selectMode("generated")}>Generated content</button><button type="button" className={contentMode === "source" ? "active" : ""} onClick={() => selectMode("source")}>Source content</button></div>
        <label className="field"><span>Folder</span><select value={contentFolder} onChange={(event) => setContentFolder(event.target.value)}><option value="">All folders</option>{availableFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
      </div>
      <fieldset className="distribution-assets"><legend>{contentMode === "generated" ? "Select generated file(s)" : "Select source content"}</legend>
        {contentMode === "generated" ? visibleGenerated.map((file) => <label key={file.id}><input type="checkbox" checked={draft.generatedContentIds.includes(file.id)} onChange={() => toggleGenerated(file)} /><span>{file.filename}</span></label>) : visibleSources.map((file) => <label key={file.path}><input type="radio" name="distribution-source" checked={draft.contentSourcePath === file.path} onChange={() => selectSource(file)} /><span>{file.filename}</span></label>)}
        {(contentMode === "generated" ? visibleGenerated : visibleSources).length === 0 && <p>No content found in this folder.</p>}
      </fieldset>
      <div className="distribution-form-grid">
        <label className="field"><span>Content label</span><input value={draft.contentLabel} onChange={(event) => setDraft((current) => ({ ...current, contentLabel: event.target.value }))} /></label>
        <label className="field"><span>Channel</span><select value={draft.channel} onChange={(event) => { const channel = event.target.value as DistributionChannel; setDraft((current) => ({ ...current, channel, recipients: channel === "linkedin" && !current.recipients.some((item) => item.trim()) ? ["LinkedIn"] : current.recipients })); }}>{distributionChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></label>
        <label className="field distribution-recipient-field"><span>Recipients (one per line)</span><textarea value={draft.recipients.join("\n")} onChange={(event) => setDraft((current) => ({ ...current, recipients: event.target.value.split("\n") }))} /></label>
        <label className="field"><span>Status</span><select value={draft.status} onChange={(event) => { setDateUnknown(false); setDraft((current) => ({ ...current, status: event.target.value as DistributionStatus })); }}><option value="planned">Planned</option><option value="sent">Sent</option></select></label>
        {draft.status === "planned" ? <label className="field"><span>Planned date</span><input type="date" value={draft.plannedDate || today} onChange={(event) => setDraft((current) => ({ ...current, plannedDate: event.target.value }))} /></label> : <><label className="field"><span>Sent date</span><input type="date" disabled={dateUnknown} value={dateUnknown ? "" : draft.sentDate || today} onChange={(event) => setDraft((current) => ({ ...current, sentDate: event.target.value }))} /></label><label className="distribution-unknown-date"><input type="checkbox" checked={dateUnknown} onChange={(event) => setDateUnknown(event.target.checked)} /> Date unknown</label></>}
      </div>
      <button className="primary-button" type="button" disabled={!writable || isSaving} onClick={save}>{isSaving ? "Saving…" : editing ? "Update distribution" : "Save new distribution"}</button>
    </section>

    <section className="distribution-filters" aria-label="Distribution history filters">
      <label className="field"><span>Recipient</span><select value={recipientFilter} onChange={(event) => setRecipientFilter(event.target.value)}><option value="">All recipients</option>{recipients.map((recipient) => <option key={recipient} value={recipient}>{recipient}</option>)}</select></label>
      <label className="field"><span>Channel</span><select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as DistributionChannel | "all")}><option value="all">All channels</option>{distributionChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.label}</option>)}</select></label>
      <label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DistributionStatus | "all")}><option value="all">All statuses</option><option value="planned">Planned</option><option value="sent">Sent</option></select></label>
      <label className="field"><span>Folder</span><select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}><option value="">All folders</option>{historyFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}</select></label>
      <label className="field"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="field"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label><label className="field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Content or recipient" /></label>
    </section>
    {recipientFilter ? (
      <div className="distribution-lists recipient-history"><section><h3>Sent to {recipientFilter}</h3>{sent.length ? sent.map(recordCard) : <p className="distribution-empty">No sent distributions for this recipient.</p>}</section></div>
    ) : (
      <div className="distribution-lists"><section><h3>Upcoming</h3>{upcoming.length ? upcoming.map(recordCard) : <p className="distribution-empty">No planned distributions.</p>}</section><section><h3>Sent history</h3>{sent.length ? sent.map(recordCard) : <p className="distribution-empty">No sent distributions.</p>}</section></div>
    )}
  </div>;
}
