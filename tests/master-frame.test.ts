import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { renderLockedMasterFrame } from "../server/master-frame-renderer";
import { parseDocumentMarkdown, renderLockedDocument } from "../server/document-renderer";
import { buildBodyArtworkInstruction, getMasterFrameSpec, usesLockedMasterFrame } from "../src/lib/prompt-builder/master-frame";

const logoPath = fileURLToPath(new URL("../content/brands/supplysync360/assets/supplysync360-logo-white.png", import.meta.url));

describe("locked master frame", () => {
  it("defines fixed pixel canvases and excludes LinkedIn chrome", () => {
    expect(getMasterFrameSpec("landscape_image_16_9")).toMatchObject({
      width: 3840,
      height: 2160,
      body: { x: 267, y: 180, width: 3306, height: 1860 },
      applyFrame: true,
    });
    expect(getMasterFrameSpec("linkedin_asset_4_5")).toMatchObject({ width: 2160, height: 2700, applyFrame: false });
    expect(usesLockedMasterFrame("linkedin_asset_4_5")).toBe(false);
    expect(buildBodyArtworkInstruction("landscape_image_16_9")).toContain("BODY ARTWORK ONLY");
  });

  it("composites body artwork, real logo and chrome into the final fixed canvas", async () => {
    const artwork = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#cc3344" } }).png().toBuffer();
    const rendered = await renderLockedMasterFrame({
      artwork,
      profileId: "landscape_image_16_9",
      headerText: "SupplySync360 | Test",
      footerText: "Confidential",
      logoPath,
    });
    const metadata = await sharp(rendered).metadata();
    expect(metadata).toMatchObject({ width: 3840, height: 2160, format: "png" });
  });
});

describe("locked document renderer", () => {
  const markdown = "## Overview\n\nExact body wording.\n\n| Item | Status |\n|---|---|\n| Header | Locked |";

  it("parses Markdown tables as structured document nodes", () => {
    expect(parseDocumentMarkdown(markdown).some((node) => node.kind === "table")).toBe(true);
  });

  it("renders Word and PDF files with programmatic repeated chrome", async () => {
    const common = { markdown, title: "Test Document", headerText: "SupplySync360 | Test", footerText: "Confidential", logoPath };
    const docx = await renderLockedDocument({ ...common, format: "docx" });
    const pdf = await renderLockedDocument({ ...common, format: "pdf" });
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBeGreaterThan(0);
  });
});
