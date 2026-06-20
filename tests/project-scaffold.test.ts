import { describe, expect, it } from "vitest";
import {
  buildProjectScaffold,
  selectedScaffoldFiles,
  type CreateProjectInput,
} from "../src/lib/prompt-builder/project-scaffold";

function input(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    brandId: "supplysync360",
    brandName: "SupplySync360",
    projectName: "Pharmacy Group Proposal",
    projectSlug: "pharmacy-group-proposal",
    workflow: "mixed",
    audience: "Pharmacy executives",
    purpose: "Present the operating model.",
    tone: "Executive and clear.",
    headerText: "SupplySync360 | Pharmacy Group Proposal",
    footerText: "SupplySync360 | Confidential",
    logoAsset: "content/brands/supplysync360/assets/supplysync360-logo-white.png",
    enabledOptionalFiles: [],
    ...overrides,
  };
}

describe("project scaffold", () => {
  it("creates three content sets with flat _generated roots and no sample sources", () => {
    const preview = buildProjectScaffold(input());
    const files = selectedScaffoldFiles(input()).map((file) => file.path);

    expect(files).toContain("documents/default-document-pack/pack.md");
    expect(files).toContain("visuals/default-visual-set/set.md");
    expect(files).toContain("linkedin/default-campaign/campaign.md");
    expect(files.some((file) => /\/(?:01|02)-/.test(file))).toBe(false);
    expect(preview.generatedFolders).toEqual([
      "documents/default-document-pack/_generated",
      "visuals/default-visual-set/_generated",
      "linkedin/default-campaign/_generated",
    ]);
    expect(preview.generatedFolders.every((folder) => !/generated-content|images|pdfs|docx|prompts|text/.test(folder))).toBe(true);
  });

  it("keeps project metadata while content-set descriptors remain source-neutral", () => {
    const files = selectedScaffoldFiles(input());
    expect(files.find((file) => file.path === "project.md")?.content).toContain("Project: Pharmacy Group Proposal");
    expect(files.find((file) => file.path === "visuals/default-visual-set/set.md")?.content).not.toContain("## Visible Text");
  });
});
