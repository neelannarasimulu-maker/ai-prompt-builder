import { describe, it } from "vitest";
import { compilePrompt } from "../src/lib/prompt-builder";

describe("sample compiled prompts", () => {
  it("prints representative compact production prompt snippets", () => {
    const samples = [
      compilePrompt({ brandId: "supplysync360", projectId: "executive-overview", contentId: "ss360-slide-01", outputProfileId: "landscape_image_16_9" }),
      compilePrompt({ brandId: "supplysync360", projectId: "executive-overview", contentId: "ss360-doc-02", outputProfileId: "a4_pdf_portrait" }),
      compilePrompt({ brandId: "supplysync360", projectId: "executive-overview", contentId: "ss360-linkedin-01", outputProfileId: "linkedin_post_text" }),
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
