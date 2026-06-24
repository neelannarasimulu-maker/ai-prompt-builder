import { describe, expect, it } from "vitest";
import { compilePrompt, contentItems } from "../src/lib/prompt-builder";

const headings = [
  "TASK",
  "SOURCE OF TRUTH",
  "BRAND + PROJECT",
  "OUTPUT PROFILE",
  "DOCUMENT RENDERING RULES",
  "FINAL OUTPUT REQUIREMENT",
];

function transactionTemplate() {
  const content = contentItems.find((item) =>
    item.path.endsWith("content/projects/rainfin/client-contracting/documents/template-document-pack/rainfin-transaction-document-template.md")
  );
  if (!content) throw new Error("Missing RainFin transaction template test fixture.");
  return content;
}

describe("document production prompt", () => {
  it("uses only the six-section contract for the RainFin transaction template", () => {
    const content = transactionTemplate();

    const result = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
    });
    const prompt = result.productionPrompt;
    const positions = headings.map((heading) => prompt.indexOf(`${heading}\n`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const heading of headings) expect(prompt.split(`${heading}\n`)).toHaveLength(2);
    expect(prompt).toContain("Brand: RainFin");
    expect(prompt).toContain("Project: Client Contracting");
    expect(prompt).toContain("Workflow: document_pack");
    expect(prompt).toContain("Audience: Business Clients that make use of services from Rainfin");
    expect(prompt).toContain("Purpose: A set of templates");
    expect(prompt).toContain("Use the official logo asset: content/brands/rainfin/assets/rainfin-logo.png.");
    expect(prompt).toContain("Header:\nRainFin | Document Template");
    expect(prompt).toContain("Footer:\nRainFin | Legal Document | For review and signature");
    expect(prompt).toContain("Use the supplied Markdown source as the exact document source of truth.");
    expect(prompt).toContain("Render Markdown pipe tables as properly formatted Word tables.");
    expect(prompt).toContain("Signature sections must begin on a new page.");
    expect(prompt).not.toMatch(/EXCLUSIONS|DIRECT CHATGPT FALLBACK ONLY|The production app owns|Attached source file workflow|Header: Footer:|Image brief|On-image text|16:9|LinkedIn Post Text/i);

    const lines = prompt.split("\n").map((line) => line.trim()).filter(Boolean);
    expect(new Set(lines).size).toBe(lines.length);
  });

  it("keeps Word and PDF output requirements mutually exclusive", () => {
    const content = transactionTemplate();
    const word = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_document_portrait",
    }).productionPrompt;
    const pdf = compilePrompt({
      brandId: content.brandId,
      projectId: content.projectId,
      contentId: content.id,
      outputProfileId: "a4_pdf_portrait",
    }).productionPrompt;

    expect(word).toContain("Output format: Word document");
    expect(word).toContain("Return only: .docx");
    expect(word).not.toMatch(/\.pdf\b|PDF document/i);
    expect(pdf).toContain("Output format: PDF document");
    expect(pdf).toContain("Return only: .pdf");
    expect(pdf).not.toMatch(/\.docx\b|Word document/i);
  });

  it("keeps every registered document source free of prompt contamination and duplicate lines", () => {
    const documents = contentItems.filter((item) => item.kind === "documents");
    expect(documents.length).toBeGreaterThan(0);

    for (const content of documents) {
      const prompt = compilePrompt({
        brandId: content.brandId,
        projectId: content.projectId,
        contentId: content.id,
        outputProfileId: "a4_document_portrait",
      }).productionPrompt;
      expect(prompt).not.toMatch(/EXCLUSIONS|DIRECT CHATGPT FALLBACK ONLY|The production app owns|Attached source file workflow|Image brief|On-image text|16:9|LinkedIn Post Text|\.pdf\b|PDF document/i);
      const lines = prompt.split("\n").map((line) => line.trim()).filter(Boolean);
      expect(new Set(lines).size).toBe(lines.length);
    }
  });
});
