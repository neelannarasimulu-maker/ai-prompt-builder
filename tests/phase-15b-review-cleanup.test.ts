import { describe, it, expect } from "vitest";
import { buildPromptReviewDashboard } from "../src/review/prompt-review-dashboard";
import { classifyFinding } from "../src/review/prompt-finding-specificity";
import { formatFixChecklist } from "../src/features/prompt-builder/prompt-review-copy";
import { detectSourceVersions, formatVersionLabel } from "../src/lib/prompt-builder/source-version-detection";
import type { PromptReviewResult } from "../src/review/prompt-review-types";

describe("Phase 15B: Review Tab Cleanup and Recommendation Specificity", () => {
  describe("Finding Specificity Classification", () => {
    it("classifies Image Brief findings as Content / Image Brief", () => {
      const result = classifyFinding("missing-image-brief", "Image Brief missing composition details", "image-agent");
      expect(result).toMatchObject({
        changeType: "Content",
        target: "Image Brief",
      });
    });

    it("classifies Visible Text findings as Content / Visible Text", () => {
      const result = classifyFinding("text-density-high", "Visible Text has excessive lines", "text-agent");
      expect(result).toMatchObject({
        changeType: "Content",
        target: "Visible Text",
      });
    });

    it("classifies brand asset findings as Asset / Brand asset", () => {
      const result = classifyFinding("missing-brand-logo", "Brand asset missing", "brand-agent");
      expect(result).toMatchObject({
        changeType: "Asset",
        target: "Brand asset",
      });
    });

    it("classifies output settings findings as Config / Output settings", () => {
      const result = classifyFinding("output-format-invalid", "Output dimension exceeds constraints", "output-agent");
      expect(result).toMatchObject({
        changeType: "Config",
        target: "Output settings",
      });
    });

    it("classifies review UI findings as Code / Review UI placement", () => {
      const result = classifyFinding("review-ui-placement", "Prompt Quality Review appears on Export tab", "ui-agent");
      expect(result).toMatchObject({
        changeType: "Code",
        target: "Review UI placement",
      });
    });
  });

  describe("Recommendation Specificity in Dashboard Issues", () => {
    it("includes changeType and target in dashboard issues", () => {
      const mockResult: PromptReviewResult = {
        overallScore: 75,
        dimensionScores: {},
        findings: [
          {
            code: "missing-image-brief",
            message: "Image Brief missing composition details",
            severity: "warning",
            source: "image-agent",
            category: "warning",
          },
        ],
        skillResults: [],
        evaluatorResults: [],
        scorecard: { score: 75, evaluatorCount: 1, blockingCount: 0, advisoryCount: 1, evaluations: [], findings: [] },
        recommendedNextActions: [],
        remediationSuggestions: [],
        agentRuns: [],
      };

      const dashboard = buildPromptReviewDashboard(mockResult);
      expect(dashboard.issues.length).toBeGreaterThan(0);
      const firstIssue = dashboard.issues[0];
      expect(firstIssue.changeType).toBeDefined();
      expect(firstIssue.target).toBeDefined();
    });
  });

  describe("Fix Checklist Includes Change Type and Target", () => {
    it("formats fix checklist with change type and target", () => {
      const mockResult: PromptReviewResult = {
        overallScore: 75,
        dimensionScores: {},
        findings: [
          {
            code: "missing-visible-text",
            message: "Visible Text section incomplete",
            severity: "warning",
            source: "text-agent",
            category: "warning",
          },
        ],
        skillResults: [],
        evaluatorResults: [],
        scorecard: { score: 75, evaluatorCount: 1, blockingCount: 0, advisoryCount: 1, evaluations: [], findings: [] },
        recommendedNextActions: [],
        remediationSuggestions: [],
        agentRuns: [],
      };

      const checklist = formatFixChecklist(mockResult);
      expect(checklist).toContain("Content");
      expect(checklist).toContain("Visible Text");
    });
  });

  describe("Source Version Detection and Selection", () => {
    it("detects multiple source versions in same content set", () => {
      const contentFiles = [
        { path: "content/projects/rainfin/campaign/visuals/V001/source.md", label: "Source", filename: "source.md", contentSet: "campaign" },
        { path: "content/projects/rainfin/campaign/visuals/V002/source.md", label: "Source", filename: "source.md", contentSet: "campaign" },
        { path: "content/projects/rainfin/docs/doc1/source.md", label: "Source", filename: "source.md", contentSet: "doc1" },
      ];

      const versionMap = detectSourceVersions(contentFiles);
      expect(versionMap.has("campaign")).toBe(true);
      expect(versionMap.get("campaign")).toHaveLength(2);
      expect(versionMap.has("doc1")).toBe(false); // Only one source, not multi-version
    });

    it("marks the latest version as newest", () => {
      const contentFiles = [
        { path: "path/V001/source.md", label: "Source", filename: "source.md", contentSet: "set1" },
        { path: "path/V002/source.md", label: "Source", filename: "source.md", contentSet: "set1" },
        { path: "path/V003/source.md", label: "Source", filename: "source.md", contentSet: "set1" },
      ];

      const versionMap = detectSourceVersions(contentFiles);
      const versions = versionMap.get("set1");
      expect(versions?.length).toBe(3);
      expect(versions?.[0].isNewest).toBe(true);
      expect(versions?.[0].folderName).toBe("V003");
    });

    it("formats version labels for UI display", () => {
      const info = { path: "p", label: "Source", filename: "source.md", version: "2", folderName: "V002", isNewest: false };
      const label = formatVersionLabel(info);
      expect(label).toBe("V002");
    });

    it("marks non-versioned single files as not multi-version", () => {
      const contentFiles = [
        { path: "path/source.md", label: "Source", filename: "source.md", contentSet: "set1" },
      ];

      const versionMap = detectSourceVersions(contentFiles);
      expect(versionMap.size).toBe(0);
    });
  });
});
