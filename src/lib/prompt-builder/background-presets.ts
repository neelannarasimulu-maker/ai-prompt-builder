export type BackgroundPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const backgroundPresets: BackgroundPreset[] = [
  {
    id: "auto",
    label: "Auto / Balanced In-Between Depth",
    prompt: "Use a balanced brand-colour canvas with gentle depth, restrained texture and protected reading zones.",
  },
  {
    id: "balanced_in_between_depth",
    label: "Balanced In-Between Depth",
    prompt: "Use a light-to-medium brand gradient with subtle depth, restrained signal accents and bright readable content areas.",
  },
  {
    id: "soft_brand_depth",
    label: "Soft Brand Depth",
    prompt: "Use soft brand tints, gentle gradients and crisp accent depth around light, highly readable content zones.",
  },
  {
    id: "balanced_brand_gradient",
    label: "Balanced Brand Gradient",
    prompt: "Blend selected brand colours through a balanced gradient with a bright centre and restrained accent lines.",
  },
  {
    id: "light_mist_gradient",
    label: "Light Mist Gradient",
    prompt: "Use a bright mist canvas with soft brand-colour washes, subtle texture and crisp accent strokes.",
  },
  {
    id: "brand_control_room_soft",
    label: "Soft Brand Control Room",
    prompt: "Use a soft operational canvas with brand-gradient depth, clean signal paths and light readable panels, without dashboard clutter.",
  },
  {
    id: "dark_edge_light_content",
    label: "Dark Edge / Light Content",
    prompt: "Use deeper brand-colour edges that transition into a light central reading area with restrained luminous accents.",
  },
  {
    id: "soft_dark_edge_light_content",
    label: "Soft Edge / Light Content",
    prompt: "Use a bright brand-tinted centre, mist content panels and softly shaded edges with small accent highlights.",
  },
  {
    id: "midnight_brand_mesh",
    label: "Midnight Brand Mesh",
    prompt: "Use a deep brand mesh with connected pathways, soft glows and light protected content panels.",
  },
  {
    id: "midnight_flow",
    label: "Midnight Flow",
    prompt: "Use a deep flowing brand gradient with quiet motion, soft colour glows and protected high-contrast reading zones.",
  },
  {
    id: "deep_teal_gradient",
    label: "Deep Teal Gradient",
    prompt: "Use a deep primary-brand gradient with softened shade transitions, restrained highlights and a lighter readable content area.",
  },
  {
    id: "graphite_panel_canvas",
    label: "Graphite Panel Canvas",
    prompt: "Use graphite as a supporting neutral beneath brand-colour gradients, subtle texture and clear light content panels.",
  },
  {
    id: "balanced_light_dark",
    label: "Balanced Light / Dark",
    prompt: "Balance bright central reading zones with mid-tone brand gradients, colour-rich edges and restrained accent geometry.",
  },
  {
    id: "executive_depth_panels",
    label: "Executive Depth Panels",
    prompt: "Use light-to-medium brand gradients, moderate shadow, fine rules and bright executive content panels.",
  },
  {
    id: "rich_gradient_frame",
    label: "Rich Gradient Frame",
    prompt: "Frame a bright inner canvas with rich brand-gradient edges, shaped corners and restrained accent strokes.",
  },
  {
    id: "clean_document_canvas",
    label: "Clean Document Canvas",
    prompt: "Use a clean visual canvas with subtle brand bands, soft fills and strong readability.",
  },
  {
    id: "deep_brand_gradient",
    label: "Deep Brand Gradient",
    prompt: "Use a rich multi-stop brand gradient with softened edges, controlled highlights and clear high-contrast content zones.",
  },
  {
    id: "digital_spine_premium",
    label: "Digital Spine Premium",
    prompt: "Use a premium digital-spine canvas with brand-colour depth, atmospheric gradients, connector trails and bright open reading zones.",
  },
  {
    id: "light_executive_canvas",
    label: "Light Executive Canvas",
    prompt: "Use a bright executive canvas with subtle brand tinting, fine structure and generous high-contrast reading space.",
  },
];

export function getBackgroundPreset(id?: string): BackgroundPreset {
  return (
    backgroundPresets.find((preset) => preset.id === id) ??
    backgroundPresets[0]
  );
}
