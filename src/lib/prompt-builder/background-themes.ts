export type BackgroundTheme = "light" | "dark" | "balanced";

export type BackgroundThemeDefinition = {
  id: BackgroundTheme;
  label: string;
  visualPrompt: string;
  documentPrompt: string;
};

export const backgroundThemes: BackgroundThemeDefinition[] = [
  {
    id: "balanced",
    label: "Balanced In-Between",
    visualPrompt:
      "Balanced in-between brand background: create a vibrant light-to-medium executive canvas with saturated brand-colour gradient bands, luminous accent lines, layered radial/linear gradients, subtle signal texture and shaped header/footer depth. It must carry obvious brand colour and energy while keeping the main reading zones bright through translucent mist panels or clean content cards. Use colour-rich edges, corner geometry, flowing connectors and accent glows; avoid beige/grey blandness, flat white emptiness, muddy graphite and dark-dominant treatment.",
    documentPrompt:
      "Balanced in-between page background: use a bright brand-tinted page canvas with vibrant but controlled gradient bands, coloured section headers, subtle signal texture and clean content panels. It should feel branded and energetic while staying print-readable.",
  },
  {
    id: "light",
    label: "Light",
    visualPrompt:
      "Light brand background: use a bright, colour-washed canvas with clear brand tints, soft multi-stop gradients, luminous accent strokes and subtle texture. Light must not mean plain white, beige, grey or empty canvas; it should still show brand colour, gradient movement and premium energy while keeping text zones very readable.",
    documentPrompt:
      "Light page background: use a bright brand-tinted A4 canvas with soft gradient headers, subtle coloured table bands and clean margins. Avoid pure white emptiness unless print constraints require it.",
  },
  {
    id: "dark",
    label: "Dark",
    visualPrompt:
      "Dark brand background: use deep saturated brand tones with multi-stop gradients, shaded transitions, luminous brand glows, subtle texture, signal lines and lighter protected content panels. It should read dark and premium with colour and depth, never as a single flat dark colour, black block, cave-like canvas, cluttered control room or neon overload. Dark is an explicit mode, not the default balanced look.",
    documentPrompt:
      "Dark page background: use gradient dark brand treatment for covers, headers, dividers or section bands, with lighter protected body areas for readability. Use rich colour transitions and avoid single-colour dark pages.",
  },
];

export function normalizeBackgroundTheme(input?: string): BackgroundTheme {
  if (input === "light" || input === "dark" || input === "balanced") return input;
  return "balanced";
}

export function getBackgroundTheme(input?: string): BackgroundThemeDefinition {
  const theme = normalizeBackgroundTheme(input);
  return backgroundThemes.find((item) => item.id === theme) || backgroundThemes[0];
}

export function inferBackgroundThemeFromPreset(input?: {
  backgroundPresetId?: string;
  documentBackgroundPresetId?: string;
}): BackgroundTheme {
  const value = `${input?.backgroundPresetId || ""} ${input?.documentBackgroundPresetId || ""}`.toLowerCase();

  if (/\b(soft_brand_depth|soft_dark_edge_light_content|light|white|mist|clean|document_canvas|clean_white|clean_a4)\b/.test(value)) return "light";
  if (/\b(dark|midnight|graphite|deep)\b/.test(value)) return "dark";
  return "balanced";
}
