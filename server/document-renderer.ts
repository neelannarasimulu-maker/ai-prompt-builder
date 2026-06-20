import fs from "node:fs";
import sharp from "sharp";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type LockedDocumentRenderInput = {
  format: "docx" | "pdf";
  markdown: string;
  title: string;
  headerText: string;
  footerText: string;
  logoPath: string;
};

type DocumentNode =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "table"; rows: string[][] };

function plainMarkdown(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^[-*]\s+/, "• ").trim();
}

export function parseDocumentMarkdown(markdown: string): DocumentNode[] {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const nodes: DocumentNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      nodes.push({ kind: "heading", level: heading[1].length, text: plainMarkdown(heading[2]) });
      index += 1;
      continue;
    }
    if (line.startsWith("|") && lines[index + 1]?.trim().match(/^\|?\s*:?-{3,}/)) {
      const rows: string[][] = [];
      rows.push(line.split("|").slice(1, -1).map(plainMarkdown));
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(lines[index].trim().split("|").slice(1, -1).map(plainMarkdown));
        index += 1;
      }
      nodes.push({ kind: "table", rows });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^#{1,4}\s+/.test(lines[index].trim()) && !lines[index].trim().startsWith("|")) {
      paragraph.push(plainMarkdown(lines[index]));
      index += 1;
    }
    if (paragraph.length) nodes.push({ kind: "paragraph", text: paragraph.join(" ") });
    else index += 1;
  }
  return nodes;
}

async function normalizedLogo(logoPath: string): Promise<Buffer> {
  if (!logoPath || !fs.existsSync(logoPath)) throw new Error("A valid logo asset is required for document rendering.");
  const { data, info } = await sharp(logoPath).ensureAlpha().resize({ width: 600, height: 220, fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let weightedLuminance = 0;
  let alphaTotal = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.05) continue;
    weightedLuminance += (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) * alpha;
    alphaTotal += alpha;
  }
  const background = alphaTotal && weightedLuminance / alphaTotal > 165 ? "#123240" : "#ffffff";
  return sharp(logoPath).resize(520, 180, { fit: "contain", background }).flatten({ background }).png().toBuffer();
}

async function renderDocx(input: LockedDocumentRenderInput): Promise<Buffer> {
  const logo = await normalizedLogo(input.logoPath);
  const children: Array<Paragraph | Table> = [];
  if (input.title.trim()) children.push(new Paragraph({ text: input.title.trim(), heading: HeadingLevel.TITLE, spacing: { after: 320 } }));
  for (const node of parseDocumentMarkdown(input.markdown)) {
    if (node.kind === "heading") {
      const heading = node.level <= 1 ? HeadingLevel.HEADING_1 : node.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      children.push(new Paragraph({ text: node.text, heading, spacing: { before: 220, after: 100 } }));
    } else if (node.kind === "paragraph") {
      children.push(new Paragraph({ children: [new TextRun({ text: node.text, size: 21 })], spacing: { after: 140, line: 300 } }));
    } else {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: node.rows.map((row, rowIndex) => new TableRow({
          children: row.map((cell) => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: cell, bold: rowIndex === 0, size: 19 })] })],
            shading: rowIndex === 0 ? { fill: "EAF5F3" } : undefined,
          })),
        })),
      }));
      children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
    }
  }

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1200, right: 900, bottom: 1050, left: 900, header: 260, footer: 260 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new ImageRun({ data: logo, transformation: { width: 130, height: 45 }, type: "png" }),
          new TextRun({ text: `    ${input.headerText}`, bold: true, size: 18, color: "123240" }),
        ],
        border: { bottom: { color: "00878C", size: 8, style: "single", space: 6 } },
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${input.footerText}  |  `, size: 16, color: "526A73" }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })],
        border: { top: { color: "D8A928", size: 6, style: "single", space: 6 } },
      })] }),
    },
    children,
  };
  const document = new Document({ creator: "AI Prompt Builder", title: input.title, sections: [section] });
  return Packer.toBuffer(document);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderPdf(input: LockedDocumentRenderInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(await normalizedLogo(input.logoPath));
  const width = 595.28;
  const height = 841.89;
  const left = 46;
  const right = 46;
  const bodyTop = 742;
  const bodyBottom = 66;
  let page: PDFPage;
  let y = 0;
  let pageNumber = 0;

  const addPage = () => {
    page = pdf.addPage([width, height]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: height - 68, width, height: 68, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: 0, y: height - 68 }, end: { x: width, y: height - 68 }, thickness: 2, color: rgb(0, 0.53, 0.55) });
    page.drawImage(logo, { x: left, y: height - 55, width: 92, height: 32 });
    page.drawText(input.headerText, { x: 152, y: height - 44, size: 9, font: bold, color: rgb(0.07, 0.2, 0.25) });
    page.drawLine({ start: { x: 0, y: 48 }, end: { x: width, y: 48 }, thickness: 1.5, color: rgb(0.85, 0.66, 0.16) });
    const footer = `${input.footerText}  |  ${pageNumber}`;
    page.drawText(footer, { x: (width - regular.widthOfTextAtSize(footer, 8)) / 2, y: 28, size: 8, font: regular, color: rgb(0.32, 0.42, 0.45) });
    y = bodyTop;
  };
  const ensureSpace = (needed: number) => { if (y - needed < bodyBottom) addPage(); };
  const drawLines = (lines: string[], size: number, lineHeight: number, font: PDFFont, color = rgb(0.12, 0.2, 0.24)) => {
    ensureSpace(lines.length * lineHeight + 8);
    for (const line of lines) { page.drawText(line, { x: left, y, size, font, color }); y -= lineHeight; }
    y -= 6;
  };

  addPage();
  if (input.title.trim()) drawLines(wrapText(input.title.trim(), bold, 20, width - left - right), 20, 25, bold);
  for (const node of parseDocumentMarkdown(input.markdown)) {
    if (node.kind === "heading") {
      const size = node.level <= 1 ? 16 : node.level === 2 ? 13 : 11;
      drawLines(wrapText(node.text, bold, size, width - left - right), size, size + 5, bold, rgb(0, 0.4, 0.44));
    } else if (node.kind === "paragraph") {
      drawLines(wrapText(node.text, regular, 10, width - left - right), 10, 14, regular);
    } else {
      for (const [rowIndex, row] of node.rows.entries()) {
        const text = row.join("  |  ");
        drawLines(wrapText(text, rowIndex === 0 ? bold : regular, 8.5, width - left - right), 8.5, 12, rowIndex === 0 ? bold : regular);
      }
      y -= 5;
    }
  }
  return Buffer.from(await pdf.save());
}

export async function renderLockedDocument(input: LockedDocumentRenderInput): Promise<Buffer> {
  return input.format === "docx" ? renderDocx(input) : renderPdf(input);
}
