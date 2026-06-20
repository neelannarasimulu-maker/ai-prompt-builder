export type DocumentPromptChunk = {
  index: number;
  total: number;
  label: string;
  content: string;
};

export type DocumentPromptParts = {
  /** Optional fallback with the complete Markdown source pasted inline. */
  runPrompt: string;
  /** Current full Markdown source file, useful for Download document MD and Copy document MD. */
  sourceMarkdown: string;
  /** Backwards-compatible alias for the attachment-first production prompt. */
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
  /** The production prompt shown in the app. For documents, this equals the attachment prompt. */
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
  outputType?: "document" | "pdf";
}): string {
  return input.taskAndRules.trim();
}

export function buildPastedDocumentRunPrompt(input: {
  taskAndRules: string;
  sourceMarkdown: string;
  sourceFilename?: string;
  logoAsset?: string;
  logoSourceText?: string;
  outputType?: "document" | "pdf";
}): string {
  return input.taskAndRules.trim();
}

export function buildInlineDocumentPrompt(input: {
  taskAndRules: string;
  bodyContent: string;
}): string {
  return input.taskAndRules.trim();
}

export function buildManualChunkPrompt(input: {
  taskAndRules: string;
  totalChunks: number;
}): string {
  return input.taskAndRules.trim();
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
