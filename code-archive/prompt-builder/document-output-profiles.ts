import type { OutputProfileLike } from "./prompt-compiler";

export const DOCUMENT_OUTPUT_PROFILES: OutputProfileLike[] = [
  {
    id: "word_docx_a4",
    label: "Word Document - A4 Portrait",
    outputType: "document",
    format: "DOCX, A4 portrait",
    instruction:
      "Generate a brand-formatted Word document using Body Content exactly, with repeated header/footer and page numbers.",
    typography: "Use document typography only with a 20-24 pt title, 14-16 pt major headings, 10-11 pt body text and compact 8-9 pt header/footer text.",
  },
  {
    id: "pdf_a4_document",
    label: "PDF Document - A4 Portrait",
    outputType: "pdf",
    format: "PDF, A4 portrait",
    instruction:
      "Generate a PDF-ready A4 document using Body Content exactly, with repeated header/footer and page numbers.",
    typography: "Use document typography only with a 20-24 pt title, 14-16 pt major headings, 10-11 pt body text and compact 8-9 pt header/footer text.",
  },
];
