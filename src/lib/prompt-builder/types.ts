export type OutputKind = "image" | "document" | "pdf" | "text" | "email";

export type ContentKind = "slides" | "documents" | "linkedin";

export interface BrandProfile {
  id: string;
  label: string;
  folder: string;
  logoPath?: string;
  logoAsset?: string;
}

export interface ProjectProfile {
  id: string;
  label: string;
  brandId: string;
  folder: string;
  contentGroups: ContentGroup[];
}

export interface ContentGroup {
  kind: ContentKind;
  label: string;
  folder: string;
}

export interface ContentItem {
  id: string;
  label: string;
  brandId: string;
  projectId: string;
  kind: ContentKind;
  file: string;
}

export interface OutputProfile {
  id: string;
  label: string;
  outputType: OutputKind;
  format: string;
  useCase: string;
  promptInstruction: string;
}

export interface CompilePromptInput {
  brandId: string;
  projectId: string;
  contentId: string;
  outputProfileId: string;
  markdownOverride?: string;
}

export interface CompileMetadata {
  brandId: string;
  brandLabel?: string;
  projectId: string;
  projectLabel?: string;
  outputProfileId: string;
  outputProfileLabel?: string;
  outputType?: OutputKind;
  contentId: string;
  contentLabel?: string;
  contentKind?: ContentKind;
  logoPath?: string;
  logoAsset?: string;
}

export interface CompiledPromptResult {
  /** Backwards-compatible alias for productionPrompt. */
  prompt: string;
  /** Compact prompt intended to send to ChatGPT or an image/document model. */
  productionPrompt: string;
  /** Expanded diagnostic view showing source selections and raw reusable components. */
  debugPrompt: string;
  warnings: string[];
  metadata: CompileMetadata;
}

export interface ParsedMarkdown {
  raw: string;
  sections: Record<string, string>;
}
