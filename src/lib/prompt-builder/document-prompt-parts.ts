export type DocumentPromptChunk = {
  index: number;
  total: number;
  label: string;
  content: string;
};

export type DocumentPromptParts = {
  /** Main workflow for the app: a single run-ready prompt with the source MD pasted inline. */
  runPrompt: string;
  /** Current full Markdown source file, useful for Download document MD and Copy document MD. */
  sourceMarkdown: string;
  /** Backwards-compatible prompt for users who still want to attach the MD file. */
  attachmentPrompt: string;
  /** Legacy alias used by older UI buttons. */
  instructionsPrompt: string;
  /** Backup workflow when the user wants Body Content pasted separately. */
  inlinePrompt: string;
  /** Alias for inlinePrompt, retained for older code paths. */
  inlineFullPrompt: string;
  /** The parsed Body Content block only. Useful for inspection or backup chunking. */
  bodyContent: string;
  /** Backup chunks of Body Content for extreme cases. Not rendered in the simplified UI. */
  bodyChunks: DocumentPromptChunk[];
  /** The production prompt shown in the app. For documents, this equals runPrompt. */
  fullPrompt: string;
};

export function emptyDocumentPromptParts(): DocumentPromptParts {
  return {
    runPrompt: "",
    sourceMarkdown: "",
    attachmentPrompt: "",
    instructionsPrompt: "",
    inlinePrompt: "",
    inlineFullPrompt: "",
    bodyContent: "",
    bodyChunks: [],
    fullPrompt: "",
  };
}

export function splitDocumentBodyIntoChunks(bodyContent: string, maxCharacters = 12000): DocumentPromptChunk[] {
  const source = bodyContent.trim();
  if (!source) return [];

  const blocks = source.split(/\n(?=#{1,3}\s)/g);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n${block}` : block;
    if (candidate.length <= maxCharacters) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current.trim());

    if (block.length <= maxCharacters) {
      current = block;
      continue;
    }

    const paragraphs = block.split(/\n\n+/g);
    current = "";
    for (const paragraph of paragraphs) {
      const paragraphCandidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (paragraphCandidate.length <= maxCharacters) {
        current = paragraphCandidate;
      } else {
        if (current) chunks.push(current.trim());
        current = paragraph;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.map((content, idx) => ({
    index: idx + 1,
    total: chunks.length,
    label: `Body content backup part ${idx + 1} of ${chunks.length}`,
    content: `BODY CONTENT BACKUP PART ${idx + 1} OF ${chunks.length}\n\n${content}`,
  }));
}

export function buildAttachedDocumentPrompt(input: {
  taskAndRules: string;
  sourceFilename?: string;
  expectedBodySection?: string;
}): string {
  const filename = input.sourceFilename?.trim() || "the attached Markdown source file";
  const expectedBodySection = input.expectedBodySection?.trim() || "## Body Content";

  return [
    input.taskAndRules.trim(),
    "Attached source file workflow:",
    `- I have attached the source Markdown file: ${filename}`,
    "- Read the attached Markdown file completely, including all sections and all tables.",
    `- Use the ${expectedBodySection} section in the attached file as the exact document body source of truth.`,
    "- If the attached file contains frontmatter or prompt-builder metadata, use it only as generation guidance and do not print it as document body content.",
    "- Render all Markdown pipe tables from the attached file as properly formatted Word/PDF tables.",
    "- Preserve every heading, paragraph, row, column, blank cell, checkbox, option and scoring value exactly as supplied in the attached source file.",
    "- Create the requested document now. Do not wait for a separate CREATE DOCUMENT instruction. Do not ask me to paste the body again unless the attachment is unreadable.",
    "- Return the completed Word/PDF document output requested by the prompt.",
  ].filter(Boolean).join("\n\n").trim();
}

export function buildPastedDocumentRunPrompt(input: {
  taskAndRules: string;
  sourceMarkdown: string;
  sourceFilename?: string;
  logoAsset?: string;
  logoSourceText?: string;
}): string {
  const source = input.sourceMarkdown.trim();
  const filename = input.sourceFilename?.trim() || "current-document-source.md";
  const logoBlock = input.logoSourceText?.trim()
    ? [
        "Official logo source is pasted below for renderer reference. Use it where the environment supports SVG logos. If not supported, use the header text and brand styling.",
        "BEGIN LOGO SVG",
        input.logoSourceText.trim(),
        "END LOGO SVG",
      ].join("\n")
    : input.logoAsset
      ? `Official logo asset reference: ${input.logoAsset}. Use the attached logo where available; otherwise use the brand header text.`
      : "No logo source was provided. Use the brand header text.";

  return [
    input.taskAndRules.trim(),
    "Single-message document creation workflow:",
    "- The full Markdown source file is pasted below, so do not wait for a separate CREATE DOCUMENT instruction.",
    "- Read the entire pasted Markdown source from BEGIN SOURCE MARKDOWN to END SOURCE MARKDOWN.",
    "- Use ## Body Content as the exact document body source of truth.",
    "- Use any prompt-builder metadata, Document Output Rules, brand typography, table rules, header rules and footer rules only as rendering instructions.",
    "- Create the requested Word/PDF-style document immediately after reading the source.",
    "- Render Markdown pipe tables as real formatted Word/PDF tables.",
    "- Preserve all headings, paragraphs, table rows, table columns, blank cells, checkboxes, options and scoring values exactly.",
    "- Do not summarise, shorten, reorder, rename, remove or add document body content.",
    logoBlock,
    `Source filename: ${filename}`,
    "BEGIN SOURCE MARKDOWN",
    source,
    "END SOURCE MARKDOWN",
  ].filter(Boolean).join("\n\n").trim();
}

export function buildInlineDocumentPrompt(input: {
  taskAndRules: string;
  bodyContent: string;
}): string {
  const body = input.bodyContent.trim();

  return [
    input.taskAndRules.trim(),
    "Inline Body Content backup workflow:",
    "- The full Body Content is pasted below between BEGIN BODY CONTENT and END BODY CONTENT.",
    "- Use that Body Content as the exact document body source of truth.",
    "- Create the requested document now. Do not wait for a separate CREATE DOCUMENT instruction.",
    "",
    "BEGIN BODY CONTENT",
    body,
    "END BODY CONTENT",
  ].join("\n").trim();
}

export function buildManualChunkPrompt(input: {
  taskAndRules: string;
  totalChunks: number;
}): string {
  const chunkLine = input.totalChunks > 1
    ? `I may paste Body Content in ${input.totalChunks} backup chunks. Use this workflow only if no Markdown file is attached.`
    : "I may paste Body Content manually only if no Markdown file is attached.";

  return [
    input.taskAndRules.trim(),
    "Manual backup workflow:",
    `- ${chunkLine}`,
    "- Prefer the attached Markdown source file when it is available.",
    "- Do not create the document until all backup chunks have been provided.",
  ].join("\n\n").trim();
}

/**
 * Backwards-compatible helper retained for older imports.
 * It now creates immediately when an attached Markdown file is provided.
 */
export function buildDocumentInstructionsPrompt(input: {
  taskAndRules: string;
  totalChunks: number;
}): string {
  return buildAttachedDocumentPrompt({ taskAndRules: input.taskAndRules });
}
