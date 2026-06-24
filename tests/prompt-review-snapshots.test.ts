import { describe, expect, it } from "vitest";
import {
  appendPromptReviewSnapshot,
  clearPromptReviewSnapshots,
  comparePromptReviews,
  createPromptReviewSnapshot,
  latestPromptReviewSnapshot,
  readPromptReviewSnapshots,
  writePromptReviewSnapshots,
} from "../src/review/prompt-review-snapshots";
import type { PromptReviewResult } from "../src/review/prompt-review-types";
import { formatReviewComparison } from "../src/features/prompt-builder/prompt-review-copy";

const result = {
  overallScore: 88,
  findings: [{}, {}, {}],
  remediationSuggestions: [{}, {}],
} as PromptReviewResult;

describe("prompt review snapshots", () => {
  it("saves and reads snapshots through local storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    const snapshot = createPromptReviewSnapshot("context", result, "2026-01-01T00:00:00.000Z");
    const snapshots = appendPromptReviewSnapshot([], snapshot);

    writePromptReviewSnapshots(storage, snapshots);

    expect(readPromptReviewSnapshots(storage)).toEqual(snapshots);
    expect(latestPromptReviewSnapshot(snapshots, "context")).toEqual(snapshot);
  });

  it("builds the expected comparison deltas", () => {
    const previous = createPromptReviewSnapshot("context", {
      ...result,
      overallScore: 80,
      findings: [{}, {}, {}, {}],
      remediationSuggestions: [{}, {}, {}],
    } as PromptReviewResult, "2026-01-01T00:00:00.000Z");

    expect(comparePromptReviews(result, previous)).toEqual({
      currentScore: 88,
      previousScore: 80,
      scoreDelta: 8,
      currentFindingCount: 3,
      previousFindingCount: 4,
      findingCountDelta: -1,
      currentSuggestedFixCount: 2,
      previousSuggestedFixCount: 3,
      suggestedFixCountDelta: -1,
    });
  });

  it("clears snapshots for only the active prompt context", () => {
    const current = createPromptReviewSnapshot("current", result, "2026-01-01T00:00:00.000Z");
    const other = createPromptReviewSnapshot("other", result, "2026-01-02T00:00:00.000Z");

    expect(clearPromptReviewSnapshots([current, other], "current")).toEqual([other]);
  });

  it("formats the comparison copy summary", () => {
    const comparison = comparePromptReviews(result, createPromptReviewSnapshot("context", {
      ...result,
      overallScore: 80,
    }, "2026-01-01T00:00:00.000Z"));

    expect(formatReviewComparison(comparison)).toContain("Score delta: +8");
    expect(formatReviewComparison(comparison)).toContain("Finding count delta: 0");
    expect(formatReviewComparison(comparison)).toContain("Suggested fix count delta: 0");
  });
});
