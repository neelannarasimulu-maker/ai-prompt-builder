export type OutputProfile = {
  id: string;
  label: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  format: string;
  useCase: string;
  instruction: string;
  typography: string;
  safeMargins?: string;
  // Backwards compatibility with earlier app files.
  promptInstruction?: string;
};

function profile(input: OutputProfile): OutputProfile {
  return {
    ...input,
    promptInstruction: input.promptInstruction || input.instruction,
  };
}

export const outputProfiles: OutputProfile[] = [
  profile({
    id: "landscape_image_16_9",
    label: "Landscape Image 16:9",
    outputType: "image",
    format: "16:9 landscape image",
    useCase: "PowerPoint slide, screen presentation or web hero",
    instruction: "Design the body artwork for an executive visual. Use only the Visible Text as on-image text. Recommend the best body layout automatically. Return crisp PNG artwork with no header, footer or logo; the app renders the final 3840x2160 master canvas.",
    typography: "Use the selected brand's visual typography. Keep titles at roughly 28-36 pt, supporting text at 16-22 pt, and small labels at no less than 12-14 pt, with strong executive hierarchy and screen-readable contrast.",
    safeMargins: "approximately 4% from every edge",
  }),
  profile({
    id: "portrait_image_4_5",
    label: "Portrait Image 4:5",
    outputType: "image",
    format: "4:5 portrait image",
    useCase: "Portrait visual, mobile-first executive visual or one-page visual canvas",
    instruction: "Design the body artwork for a portrait executive visual. Use only the Visible Text as on-image text. Preserve semantic grouping. Return artwork without header, footer or logo; the app renders the final 2160x2700 master canvas.",
    typography: "Use the selected brand's visual typography. Keep portrait titles at roughly 30-40 pt, supporting text at 18-24 pt, and small labels at no less than 14 pt, with clear mobile-readable hierarchy.",
    safeMargins: "approximately 5% from every edge",
  }),
  profile({
    id: "a4_document_portrait",
    label: "A4 Word Document Portrait",
    outputType: "document",
    format: "A4 portrait Word document",
    useCase: "Word-style client document, template or proposal pack",
    instruction: "Create a polished A4 portrait Word document from the supplied Markdown source and return .docx only.",
    typography: "Use document typography only: approximately 20-24 pt for the document title, 14-16 pt for major headings, 11-12 pt for subheadings, 10-11 pt for body text, and 8-9 pt for compact headers, footers and table notes.",
  }),
  profile({
    id: "a4_pdf_portrait",
    label: "A4 PDF Portrait",
    outputType: "pdf",
    format: "A4 portrait PDF document",
    useCase: "Client-facing PDF document or printable pack",
    instruction: "Create a polished A4 portrait PDF document from the supplied Markdown source and return .pdf only.",
    typography: "Use document typography only: approximately 20-24 pt for the document title, 14-16 pt for major headings, 11-12 pt for subheadings, 10-11 pt for body text, and 8-9 pt for compact headers, footers and table notes.",
  }),
  profile({
    id: "linkedin_asset_4_5",
    label: "LinkedIn Asset 4:5",
    outputType: "image",
    format: "LinkedIn 4:5 asset",
    useCase: "LinkedIn single image or carousel image set, as specified by Image Brief",
    instruction: "Use Image Brief as the sole source of truth for whether to create one image or a set of separate carousel images. Do not infer asset count from the output profile. Create full-bleed 2160x2700 PNG artwork with no header, footer or logo. Keep visible text mobile-readable and do not render workflow labels, asset-format lines, document chrome or the LinkedIn caption.",
    typography: "Use LinkedIn asset typography only: a bold 44-64 px headline, 28-36 px supporting copy, and no essential text below 24 px. Use consistent hierarchy, short lines, generous spacing and high contrast across every requested image.",
    safeMargins: "approximately 6% from every edge for mobile readability",
  }),
  profile({
    id: "email_brief",
    label: "Email Brief",
    outputType: "email",
    format: "client-facing email",
    useCase: "Short email introducing the attached visual or document",
    instruction: "Draft a concise client-facing email using the selected content as context. Do not create an image.",
    typography: "Use plain email-safe text hierarchy with concise paragraphs and scannable spacing.",
  }),
];

export function listAvailableOutputs() {
  return outputProfiles;
}
