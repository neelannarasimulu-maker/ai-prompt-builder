import { describe, expect, it } from "vitest";
import { createSourceFixGuidance } from "../src/review/prompt-source-guidance";

function guidance(code: string, message = code) {
  return createSourceFixGuidance({
    id: `issue:${code}`,
    code,
    message,
    sources: ["test-evaluator"],
  });
}

describe("prompt source fix guidance", () => {
  it("maps image brief issues to Image Brief deterministically", () => {
    const first = guidance("missing-image-brief");
    const second = guidance("missing-image-brief");

    expect(first).toEqual(second);
    expect(first.likelySourceSection).toBe("Image Brief");
    expect(first.confidence).toBe("high");
  });

  it("maps visible text issues to Visible Text", () => {
    expect(guidance("missing-visible-text").likelySourceSection).toBe("Visible Text");
  });

  it("maps brand and asset issues to Brand rules", () => {
    expect(guidance("missing-logo-asset").likelySourceSection).toBe("Brand rules");
    expect(guidance("brand-colour-mismatch").likelySourceSection).toBe("Brand rules");
  });
});
