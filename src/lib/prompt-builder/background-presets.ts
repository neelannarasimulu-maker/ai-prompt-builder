export type BackgroundPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const backgroundPresets: BackgroundPreset[] = [
  {
    id: "auto",
    label: "Auto / Balanced Brand Depth",
    prompt:
      "Use the selected brand palette to create a lighter, balanced executive background with visible brand gradients, a softly deepened perimeter and a clearer, brighter central reading zone. The result should feel premium and branded, but not dark. Use mist, soft sand, pale tone or light neutral blending in the main content area, with richer brand colour reserved for edge depth, corner shaping, header treatment or accent bands. Avoid washed-out white emptiness, but also avoid black-heavy, cave-dark or neon-styled backgrounds.",
  },
  {
    id: "soft_brand_depth",
    label: "Soft Brand Depth",
    prompt:
      "Use a balanced brand-aware background with mid-tone gradients, lighter readable content zones and restrained darker edge depth. Keep the slide premium, branded and easy to read, with no heavy dark canvas.",
  },
  {
    id: "balanced_brand_gradient",
    label: "Balanced Brand Gradient",
    prompt:
      "Use a balanced gradient from the selected brand colours, blending richer tones at the edges into a lighter centre. Keep brand colour visible and elegant, with strong readability across the main content area.",
  },
  {
    id: "light_mist_gradient",
    label: "Light Mist Gradient",
    prompt:
      "Use a light mist, white, soft grey and restrained brand-colour gradient with clear reading zones and subtle edge depth. Keep the result premium, bright and executive without becoming washed out.",
  },
  {
    id: "brand_control_room_soft",
    label: "Soft Brand Control Room",
    prompt:
      "Use a soft executive control-room feel with brand-colour depth, clean signal pathways, light readable panels and restrained operational cues. Avoid fake dashboards, neon effects and dark-heavy treatment.",
  },
  {
    id: "soft_dark_edge_light_content",
    label: "Soft Dark Edge / Light Content",
    prompt:
      "Use gently darker branded edge zones or a restrained frame, with a lighter centre canvas or mist content panels. Avoid heavy black framing and avoid flat white emptiness.",
  },
  {
    id: "midnight_flow",
    label: "Midnight Flow",
    prompt:
      "Use a softened midnight flow background in the selected brand colours. Keep it medium-depth rather than dark, with visible gradients, quiet motion and lighter reading zones behind text. Avoid cave-dark backgrounds and neon clutter.",
  },
  {
    id: "deep_teal_gradient",
    label: "Deep Teal Gradient",
    prompt:
      "Use a controlled deep-teal or brand-primary gradient with softened depth and a lighter readable content area. The slide should feel rich and executive, not dark overall.",
  },
  {
    id: "graphite_panel_canvas",
    label: "Graphite Panel Canvas",
    prompt:
      "Use a graphite or dark-neutral brand canvas with moderate depth, soft gradients and clear light content panels. Keep the background professional and readable, not black-heavy.",
  },
  {
    id: "balanced_light_dark",
    label: "Balanced Light / Dark",
    prompt:
      "Use a balanced light/dark composition with a mid-tone brand gradient, lighter readable central zones and subtle darker edge depth. Avoid extremes of pale white or near-black.",
  },
  {
    id: "executive_depth_panels",
    label: "Executive Depth Panels",
    prompt:
      "Use premium executive depth with soft brand-colour gradients, moderate shadow, light content panels, fine rules and controlled highlights. Avoid overly dark backgrounds and avoid flat pale canvases.",
  },
  {
    id: "rich_gradient_frame",
    label: "Rich Gradient Frame",
    prompt:
      "Use a richer brand gradient frame around the slide, softened so it remains executive and readable. The inner canvas should be light enough for text-heavy content.",
  },
  {
    id: "clean_document_canvas",
    label: "Clean Document Canvas",
    prompt:
      "Use a professional document-style canvas with subtle brand-colour bands, soft neutral fills, restrained depth and strong readability.",
  },
  {
    id: "deep_brand_gradient",
    label: "Deep Brand Gradient",
    prompt:
      "Use a rich brand-colour gradient with medium depth, lighter centre clarity and softer edge darkening. Keep the overall slide visually rich but still balanced and readable, not dark-heavy.",
  },
  {
    id: "digital_spine_premium",
    label: "Digital Spine Premium",
    prompt:
      "Use a premium Thenga-style digital-spine background with deep ubuntu navy, trust teal, prosperity gold, earth green and soft sand blended into a lighter, balanced executive canvas. Keep the centre and reading zones brighter and more open, while using the richer brand tones as edge depth, atmospheric gradients and strategic accents. Avoid dark full-slide treatment.",
  },
];

export function getBackgroundPreset(id?: string): BackgroundPreset {
  return (
    backgroundPresets.find((preset) => preset.id === id) ??
    backgroundPresets[0]
  );
}
