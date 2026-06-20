export type DocumentBackgroundPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const documentBackgroundPresets: DocumentBackgroundPreset[] = [
  {
    id: "auto_brand_document",
    label: "Auto brand document style",
    prompt:
      "Use an A4 portrait document layout determined by the selected brand and project document rules, including page style, header, footer, logo treatment, typography, section colours and table formatting. Do not borrow another brand's style. Keep the document print-ready, readable and faithful to the source.",
  },
  {
    id: "clean_white_form",
    label: "Clean White Form",
    prompt:
      "Use a clean A4 portrait document canvas with white page background, generous margins, readable typography, repeated header, repeated footer, dynamic page numbers, and formatted tables with subtle shading. Prioritise print readability over decorative effects.",
  },
  {
    id: "clean_a4_word",
    label: "Clean A4 Word",
    prompt:
      "Use a professional A4 Word document layout with clean margins, structured headings, readable Word-style tables, repeated header, repeated footer and dynamic page numbers.",
  },
  {
    id: "formal_pdf_document",
    label: "Formal PDF Document",
    prompt:
      "Use a formal PDF-ready document layout with clear hierarchy, page-safe spacing, repeated header/footer, dynamic page numbers and print-friendly table formatting.",
  },
];

// Backwards-compatible export used by some previous replacement files.
export const DOCUMENT_BACKGROUND_PRESETS = documentBackgroundPresets;

export function getDocumentBackgroundPreset(id?: string): DocumentBackgroundPreset {
  return (
    documentBackgroundPresets.find((preset) => preset.id === id) ||
    documentBackgroundPresets[0]
  );
}
