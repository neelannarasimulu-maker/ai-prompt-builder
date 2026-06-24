import { describe, it } from "vitest";
import { compilePrompt, contentItems } from "../src/lib/prompt-builder";

describe("sample compiled prompts", () => {
  it("prints representative compact production prompt snippets", () => {
    const document = contentItems.find((item) => item.path.endsWith("content/projects/rainfin/client-contracting/documents/template-document-pack/rainfin-transaction-document-template.md"));
    if (!document) throw new Error("Missing document sample fixture.");
    const samples = [
      compilePrompt({ brandId: "supplysync360", projectId: "brand-positioning", contentId: "ss360-slide-01", outputProfileId: "landscape_image_16_9" }),
      compilePrompt({ brandId: document.brandId, projectId: document.projectId, contentId: document.id, outputProfileId: "a4_pdf_portrait" }),
      compilePrompt({ brandId: "supplysync360", projectId: "brand-positioning", contentId: "ss360-linkedin-01", outputProfileId: "linkedin_asset_4_5" }),
    ];

    for (const sample of samples) {
      console.log("\n--- PRODUCTION PROMPT SAMPLE ---\n");
      console.log(sample.productionPrompt.slice(0, 1200));
      console.log("\nProduction characters:", sample.productionPrompt.length);
      console.log("Debug characters:", sample.debugPrompt.length);
      console.log("Warnings:", sample.warnings);
    }
  });
});
