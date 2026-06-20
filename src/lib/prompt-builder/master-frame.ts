export type PixelRect = { x: number; y: number; width: number; height: number };

export type MasterFrameSpec = {
  profileId: string;
  width: number;
  height: number;
  body: PixelRect;
  header?: PixelRect;
  footer?: PixelRect;
  logo?: PixelRect;
  headerText?: PixelRect;
  footerText?: PixelRect;
  applyFrame: boolean;
};

const FRAME_SPECS: Record<string, MasterFrameSpec> = {
  landscape_image_16_9: {
    profileId: "landscape_image_16_9",
    width: 3840,
    height: 2160,
    body: { x: 267, y: 180, width: 3306, height: 1860 },
    header: { x: 0, y: 0, width: 3840, height: 180 },
    footer: { x: 0, y: 2040, width: 3840, height: 120 },
    logo: { x: 72, y: 30, width: 390, height: 120 },
    headerText: { x: 510, y: 42, width: 3210, height: 96 },
    footerText: { x: 72, y: 2064, width: 3696, height: 72 },
    applyFrame: true,
  },
  portrait_image_4_5: {
    profileId: "portrait_image_4_5",
    width: 2160,
    height: 2700,
    body: { x: 116, y: 170, width: 1928, height: 2410 },
    header: { x: 0, y: 0, width: 2160, height: 170 },
    footer: { x: 0, y: 2580, width: 2160, height: 120 },
    logo: { x: 54, y: 25, width: 320, height: 120 },
    headerText: { x: 410, y: 38, width: 1690, height: 94 },
    footerText: { x: 54, y: 2604, width: 2052, height: 72 },
    applyFrame: true,
  },
  linkedin_asset_4_5: {
    profileId: "linkedin_asset_4_5",
    width: 2160,
    height: 2700,
    body: { x: 0, y: 0, width: 2160, height: 2700 },
    applyFrame: false,
  },
  a4_document_portrait: {
    profileId: "a4_document_portrait",
    width: 2480,
    height: 3508,
    body: { x: 170, y: 260, width: 2140, height: 2968 },
    header: { x: 0, y: 0, width: 2480, height: 190 },
    footer: { x: 0, y: 3318, width: 2480, height: 190 },
    logo: { x: 120, y: 35, width: 300, height: 120 },
    headerText: { x: 470, y: 48, width: 1850, height: 90 },
    footerText: { x: 120, y: 3362, width: 2240, height: 72 },
    applyFrame: true,
  },
  a4_pdf_portrait: {
    profileId: "a4_pdf_portrait",
    width: 2480,
    height: 3508,
    body: { x: 170, y: 260, width: 2140, height: 2968 },
    header: { x: 0, y: 0, width: 2480, height: 190 },
    footer: { x: 0, y: 3318, width: 2480, height: 190 },
    logo: { x: 120, y: 35, width: 300, height: 120 },
    headerText: { x: 470, y: 48, width: 1850, height: 90 },
    footerText: { x: 120, y: 3362, width: 2240, height: 72 },
    applyFrame: true,
  },
};

export function getMasterFrameSpec(profileId: string): MasterFrameSpec | undefined {
  return FRAME_SPECS[profileId];
}

export function usesLockedMasterFrame(profileId: string): boolean {
  return Boolean(getMasterFrameSpec(profileId)?.applyFrame);
}

export function buildBodyArtworkInstruction(profileId: string): string {
  const spec = getMasterFrameSpec(profileId);
  if (!spec) return "Create the requested output at the profile dimensions.";
  if (!spec.applyFrame) {
    return `Create a full-bleed ${spec.width}x${spec.height}px body artwork. Do not add a header bar, footer bar or document chrome.`;
  }
  return [
    `Create BODY ARTWORK ONLY at ${spec.body.width}x${spec.body.height}px.`,
    "Do not draw a header, footer, logo, logo placeholder or master-frame decoration.",
    "Keep essential body content inside the artwork bounds; the app will place it into the locked master frame after generation.",
  ].join(" ");
}

export function listMasterFrameSpecs(): MasterFrameSpec[] {
  return Object.values(FRAME_SPECS);
}
