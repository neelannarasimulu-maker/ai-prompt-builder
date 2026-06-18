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
    label: "Soft Premium Gradient",
    visualPrompt:
      "Soft premium gradient background: blend the brand palette into a calm, light-leaning executive canvas with a bright readable centre. Use richer colour only as soft edge depth, header treatment, corner shaping or restrained accents. Do not merge dark and light areas into a heavy split background, and avoid black-heavy or cave-dark treatment.",
    documentPrompt:
      "Soft premium page background: use a clean white or pale brand-tinted page canvas with restrained gradient accents, light header/footer bands and strong print readability.",
  },
  {
    id: "light",
    label: "Light",
    visualPrompt:
      "Light brand background: use white, mist, soft sand or pale brand tints with restrained brand accents, clean panels and maximum readability.",
    documentPrompt:
      "Light page background: use a bright white or pale brand-tinted A4 canvas, clean margins, light table shading and minimal decorative depth.",
  },
  {
    id: "dark",
    label: "Dark",
    visualPrompt:
      "Dark brand background: use premium brand-depth treatment with navy/charcoal or deep primary tones, strong contrast panels and restrained highlights, never cluttered or neon.",
    documentPrompt:
      "Dark page background: use dark brand treatment only for headers, cover bands or section dividers; keep body pages readable with light content areas and high contrast.",
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

  if (/\b(light|white|mist|clean|document_canvas|clean_white|clean_a4)\b/.test(value)) return "light";
  if (/\b(dark|midnight|graphite|deep)\b/.test(value)) return "dark";
  return "balanced";
}
