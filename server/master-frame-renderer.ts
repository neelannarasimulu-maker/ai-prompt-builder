import fs from "node:fs";
import sharp, { type OverlayOptions } from "sharp";
import { getMasterFrameSpec } from "../src/lib/prompt-builder/master-frame";

export type LockedFrameRenderInput = {
  artwork: Buffer;
  profileId: string;
  headerText?: string;
  footerText?: string;
  logoPath?: string;
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[character] || character);
}

function textSvg(input: { width: number; height: number; text: string; fontSize: number; color?: string; align?: "start" | "middle" }): Buffer {
  const anchor = input.align || "start";
  const x = anchor === "middle" ? input.width / 2 : 0;
  return Buffer.from(`<svg width="${input.width}" height="${input.height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${Math.round(input.height * 0.68)}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="${input.fontSize}" font-weight="700" fill="${input.color || "#123240"}">${escapeXml(input.text)}</text>
  </svg>`);
}

async function visibleLogoLuminance(logoPath: string): Promise<number> {
  const { data, info } = await sharp(logoPath).ensureAlpha().resize({ width: 600, height: 220, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let weightedLuminance = 0;
  let alphaTotal = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.05) continue;
    weightedLuminance += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) * alpha;
    alphaTotal += alpha;
  }
  return alphaTotal ? weightedLuminance / alphaTotal : 0;
}

export async function renderLockedMasterFrame(input: LockedFrameRenderInput): Promise<Buffer> {
  const spec = getMasterFrameSpec(input.profileId);
  if (!spec) throw new Error(`No fixed-pixel master frame is configured for ${input.profileId}.`);

  const body = await sharp(input.artwork)
    .rotate()
    .resize(spec.body.width, spec.body.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  if (!spec.applyFrame) {
    return sharp(body).resize(spec.width, spec.height, { fit: "cover" }).png().toBuffer();
  }

  if (!input.logoPath || !fs.existsSync(input.logoPath)) {
    throw new Error("A valid logo asset is required for the locked master frame.");
  }

  const logoLuminance = await visibleLogoLuminance(input.logoPath);
  const headerBackground = logoLuminance > 165 ? "#123240" : "#ffffff";
  const headerTextColor = logoLuminance > 165 ? "#ffffff" : "#123240";
  const composites: OverlayOptions[] = [{ input: body, left: spec.body.x, top: spec.body.y }];
  const chromeSvg = Buffer.from(`<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${spec.width}" height="${spec.header?.height || 0}" fill="${headerBackground}"/>
    <rect x="0" y="${spec.footer?.y || spec.height}" width="${spec.width}" height="${spec.footer?.height || 0}" fill="#ffffff"/>
    <rect x="0" y="${(spec.header?.height || 0) - 8}" width="${spec.width}" height="8" fill="#00878c"/>
    <rect x="0" y="${spec.footer?.y || spec.height}" width="${spec.width}" height="6" fill="#d8a928"/>
  </svg>`);
  composites.push({ input: chromeSvg, left: 0, top: 0 });

  if (spec.logo) {
    const logo = await sharp(input.logoPath)
      .resize(spec.logo.width, spec.logo.height, { fit: "contain", position: "centre", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    composites.push({ input: logo, left: spec.logo.x, top: spec.logo.y });
  }

  if (spec.headerText && input.headerText?.trim()) {
    composites.push({
      input: textSvg({ width: spec.headerText.width, height: spec.headerText.height, text: input.headerText.trim(), fontSize: Math.round(spec.headerText.height * 0.42), color: headerTextColor }),
      left: spec.headerText.x,
      top: spec.headerText.y,
    });
  }
  if (spec.footerText && input.footerText?.trim()) {
    composites.push({
      input: textSvg({ width: spec.footerText.width, height: spec.footerText.height, text: input.footerText.trim(), fontSize: Math.round(spec.footerText.height * 0.34), align: "middle" }),
      left: spec.footerText.x,
      top: spec.footerText.y,
    });
  }

  return sharp({ create: { width: spec.width, height: spec.height, channels: 4, background: "#ffffff" } })
    .composite(composites)
    .png()
    .toBuffer();
}
