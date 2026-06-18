export type OutputProfile = {
  id: string;
  label: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  format: string;
  useCase: string;
  instruction: string;
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
    instruction: "Create a finished 16:9 executive visual. Use only the Visible Text as on-image text. Recommend the best layout automatically. Generate as a high-resolution 16:9 PNG, ideally 3840x2160 px, with crisp text and no compression artifacts.",
  }),
  profile({
    id: "portrait_image_4_5",
    label: "Portrait Image 4:5",
    outputType: "image",
    format: "4:5 portrait image",
    useCase: "Portrait visual, mobile-first executive visual or one-page visual canvas",
    instruction: "Create a finished 4:5 portrait executive visual. Use only the Visible Text as on-image text. Preserve semantic grouping and use the available portrait space effectively.",
  }),
  profile({
    id: "a4_document_portrait",
    label: "A4 Word Document Portrait",
    outputType: "document",
    format: "A4 portrait Word document",
    useCase: "Word-style client document, template or proposal pack",
    instruction: "Create a polished A4 portrait Word document. Use Body Content as the exact source of truth. Render Markdown pipe tables as real formatted Word tables.",
  }),
  profile({
    id: "a4_pdf_portrait",
    label: "A4 PDF Portrait",
    outputType: "pdf",
    format: "A4 portrait PDF document",
    useCase: "Client-facing PDF document or printable pack",
    instruction: "Create a premium A4 portrait PDF document. Use Body Content as the exact source of truth. Render Markdown pipe tables as real formatted PDF tables.",
  }),
  profile({
    id: "linkedin_post_text",
    label: "LinkedIn Text Post",
    outputType: "text",
    format: "LinkedIn written post",
    useCase: "Professional LinkedIn post",
    instruction: "Write a professional LinkedIn post. Do not create an image. Use the source content to produce concise, executive wording.",
  }),
  profile({
    id: "linkedin_image_4_5",
    label: "LinkedIn Image 4:5",
    outputType: "image",
    format: "LinkedIn 4:5 image",
    useCase: "LinkedIn visual or carousel panel",
    instruction: "Create a LinkedIn portrait image. Keep visible text large, sparse and mobile-readable. Use brand header/footer rules. Prefer PNG for crisp text; use SVG only for reliable vector-style diagrams, and avoid JPEG unless smaller file size matters more than sharpness.",
  }),
  profile({
    id: "email_brief",
    label: "Email Brief",
    outputType: "email",
    format: "client-facing email",
    useCase: "Short email introducing the attached visual or document",
    instruction: "Draft a concise client-facing email using the selected content as context. Do not create an image.",
  }),
];

export function listAvailableOutputs() {
  return outputProfiles;
}
