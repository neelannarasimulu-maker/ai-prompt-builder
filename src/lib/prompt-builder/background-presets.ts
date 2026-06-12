export type BackgroundPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const backgroundPresets: BackgroundPreset[] = [
  {
    id: "auto",
    label: "Auto / Brand Depth",
    prompt:
      "Use the selected brand palette to create a medium-depth branded background with gradients, darker edge zones, subtle texture and lighter readable content zones. Avoid washed-out white backgrounds, full black slides and generic styling.",
  },
  {
    id: "deep_teal_gradient",
    label: "Deep Teal Gradient",
    prompt:
      "Use a premium deep teal/navy gradient background with medium-to-dark edge depth, soft glow and light readable panels.",
  },
  {
    id: "midnight_flow",
    label: "Midnight Flow",
    prompt:
      "Use a dark midnight navy/teal flow background with subtle motion lines, elegant gradients and lighter content cards for readability. Avoid full black and neon overload.",
  },
  {
    id: "graphite_panel_canvas",
    label: "Graphite Panel Canvas",
    prompt:
      "Use a graphite and deep teal panel canvas with rich executive depth, light cards, fine rules and restrained accent colours.",
  },
  {
    id: "balanced_light_dark",
    label: "Balanced Light / Dark",
    prompt:
      "Use a balanced composition with darker branded frame areas and lighter content lanes or panels. Keep strong readability with visible brand depth.",
  },
  {
    id: "executive_depth_panels",
    label: "Executive Depth Panels",
    prompt:
      "Use deep branded background depth with lighter mist or white content panels, fine rules and controlled shadows.",
  },
  {
    id: "dark_edge_light_content",
    label: "Dark Edge / Light Content",
    prompt:
      "Use darker branded gradients around the edges or header/footer frame, with a lighter central content zone for readability.",
  },
  {
    id: "deep_brand_gradient",
    label: "Deep Brand Gradient",
    prompt:
      "Use a deeper brand-colour gradient background with rich mid/dark tones, subtle glow, soft shadow depth and lighter content zones.",
  },
  {
    id: "midnight_brand_mesh",
    label: "Midnight Brand Mesh",
    prompt:
      "Use a midnight-to-mid-tone brand mesh background with subtle flowing patterns and clear content panels. Avoid full black and neon overload.",
  },
  {
    id: "rich_gradient_frame",
    label: "Rich Gradient Frame",
    prompt:
      "Use a rich branded gradient frame with darker colour depth and a readable inner canvas.",
  },
  {
    id: "brand_control_room_soft",
    label: "Soft Control Room",
    prompt:
      "Use a refined operational control-room feel with deep brand gradients, subtle data-flow cues and quiet technology texture.",
  },
  {
    id: "clean_document_canvas",
    label: "Clean Document Canvas",
    prompt:
      "Use a professional document-style canvas with deeper brand header/footer bands, pale content sections and strong readability.",
  },
];

export function getBackgroundPreset(id?: string): BackgroundPreset {
  return (
    backgroundPresets.find((preset) => preset.id === id) ??
    backgroundPresets[0]
  );
}
