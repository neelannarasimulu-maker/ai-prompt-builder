export type BackgroundPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const backgroundPresets: BackgroundPreset[] = [
  {
    id: "auto",
    label: "Auto / Balanced In-Between Depth",
    prompt:
      "Use the selected brand palette to create a vibrant balanced executive background: light-to-medium overall, but colour-rich. Build saturated brand gradient bands, luminous accent lines, subtle signal texture, shaped header/footer depth and bright protected reading zones. Keep the central content readable through mist panels/cards while allowing strong brand colour in edges, corners, connectors and accent geometry. Avoid plain white emptiness, beige/grey blandness, muddy graphite, single-colour dark fills and neon overload.",
  },
  {
    id: "balanced_in_between_depth",
    label: "Balanced In-Between Depth",
    prompt:
      "Use a vibrant light-to-medium brand-depth background with layered multi-stop gradients, saturated colour bands, luminous signal accents, subtle texture and bright content panels. The slide should feel clearly branded, energetic and premium without becoming dark-dominant. Keep the centre and text zones open and readable, but let the header/footer, edges, corner geometry and connector paths carry rich brand colour.",
  },
  {
    id: "soft_brand_depth",
    label: "Soft Brand Depth",
    prompt:
      "Use a light-classified but colourful brand-aware background with bright tints, visible gradients, light readable content zones and crisp accent depth. Keep it premium and branded, never blank white, beige, grey or a heavy dark canvas.",
  },
  {
    id: "balanced_brand_gradient",
    label: "Balanced Brand Gradient",
    prompt:
      "Use a balanced in-between gradient from the selected brand colours, blending vivid mid-tone brand bands into a bright readable centre. Add subtle texture, luminous accent lines and shaped colour transitions so the result feels vibrant, not flat or bland.",
  },
  {
    id: "light_mist_gradient",
    label: "Light Mist Gradient",
    prompt:
      "Use a bright mist or pearl canvas with visible brand-colour gradients, light colour washes, subtle texture and crisp accent strokes. Keep the result premium, bright and readable; do not use plain white emptiness, beige blandness or washed-out flatness.",
  },
  {
    id: "brand_control_room_soft",
    label: "Soft Brand Control Room",
    prompt:
      "Use a vibrant but balanced executive control-room feel with bright brand gradient depth, clean signal pathways, glowing route lines, light readable panels and restrained operational cues. Avoid fake dashboards, neon overload, graphite-heavy styling and dark-heavy treatment.",
  },
  {
    id: "dark_edge_light_content",
    label: "Dark Edge / Light Content",
    prompt:
      "Use colour-rich dark branded edge zones with gradient transitions, luminous accents, subtle shade variation and a light, highly readable central content canvas. Keep the composition premium and avoid heavy black framing or single-colour dark borders.",
  },
  {
    id: "soft_dark_edge_light_content",
    label: "Soft Edge / Light Content",
    prompt:
      "Use a light-classified soft-edge treatment: bright brand-tinted centre, mist content panels, colourful shaded branded edges and small luminous accents. This should still count as light while retaining colour and depth; avoid plain white emptiness, heavy black framing and full dark treatment.",
  },
  {
    id: "midnight_brand_mesh",
    label: "Midnight Brand Mesh",
    prompt:
      "Use a medium-to-dark midnight brand mesh with saturated multi-stop gradients, shaded connected pathways, subtle texture, soft glows, coloured signal points and light content panels. It must feel dark, colourful and premium without becoming one flat navy/black colour.",
  },
  {
    id: "midnight_flow",
    label: "Midnight Flow",
    prompt:
      "Use a dark but vibrant midnight flow background in the selected brand colours, with visible gradients, shaded transitions, colour glows, quiet motion and lighter protected reading zones behind text. Avoid cave-dark flatness, black blocks and neon clutter.",
  },
  {
    id: "deep_teal_gradient",
    label: "Deep Teal Gradient",
    prompt:
      "Use a controlled deep-teal or brand-primary gradient with multiple shade transitions, saturated teal bands, luminous highlights, softened depth and a lighter readable content area. The slide should feel rich and executive, not a single dark teal fill.",
  },
  {
    id: "graphite_panel_canvas",
    label: "Graphite Panel Canvas",
    prompt:
      "Use graphite only as a supporting neutral under saturated brand gradients, shaded texture, luminous accents and clear light content panels. Keep the background professional, colourful enough to feel branded, readable and not black-heavy or flat.",
  },
  {
    id: "balanced_light_dark",
    label: "Balanced Light / Dark",
    prompt:
      "Use a balanced composition with vivid light-to-mid brand gradients, bright readable central zones, colour-rich edge depth and luminous accent geometry. This is an in-between style, not a dark slide, but it must still feel vibrant and branded. Avoid pale white emptiness, beige/grey blandness, heavy graphite or near-black.",
  },
  {
    id: "executive_depth_panels",
    label: "Executive Depth Panels",
    prompt:
      "Use premium executive depth with light-to-medium brand-colour gradients, saturated accent bands, moderate shadow, bright content panels, fine rules and controlled highlights. Keep the canvas lighter than dark while avoiding flat pale emptiness.",
  },
  {
    id: "rich_gradient_frame",
    label: "Rich Gradient Frame",
    prompt:
      "Use a rich brand gradient frame around the slide with saturated colour transitions, shaped corners, luminous accent strokes and a bright inner canvas for text-heavy content. Keep the frame energetic and premium, not a dark dominant background.",
  },
  {
    id: "clean_document_canvas",
    label: "Clean Document Canvas",
    prompt:
      "Use a professional document-style canvas with visible brand-colour bands, soft gradient fills, restrained signal texture and strong readability.",
  },
  {
    id: "deep_brand_gradient",
    label: "Deep Brand Gradient",
    prompt:
      "Use a rich brand-colour gradient with saturated multi-stop depth, lighter centre clarity, softened edge colour and luminous accents. Keep the overall slide visually rich, balanced, readable and not dark-heavy.",
  },
  {
    id: "digital_spine_premium",
    label: "Digital Spine Premium",
    prompt:
      "Use a premium Thenga-style digital-spine background with deep ubuntu navy, trust teal, prosperity gold, earth green and soft sand blended into a vibrant balanced executive canvas. Keep the centre and reading zones bright and open, while using richer brand tones as saturated edge depth, atmospheric gradients, connector trails and strategic accents. Avoid dark full-slide treatment.",
  },
];

export function getBackgroundPreset(id?: string): BackgroundPreset {
  return (
    backgroundPresets.find((preset) => preset.id === id) ??
    backgroundPresets[0]
  );
}
