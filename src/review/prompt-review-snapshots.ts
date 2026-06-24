import type { PromptReviewResult } from "./prompt-review-types";

export const promptReviewSnapshotsStorageKey = "promptReview.snapshots";

export type PromptReviewSnapshot = {
  id: string;
  contextKey: string;
  savedAt: string;
  overallScore: number;
  findingCount: number;
  suggestedFixCount: number;
};

export type PromptReviewComparison = {
  currentScore: number;
  previousScore: number | null;
  scoreDelta: number | null;
  currentFindingCount: number;
  previousFindingCount: number | null;
  findingCountDelta: number | null;
  currentSuggestedFixCount: number;
  previousSuggestedFixCount: number | null;
  suggestedFixCountDelta: number | null;
};

type SnapshotStorage = Pick<Storage, "getItem" | "setItem">;

export function createPromptReviewSnapshot(
  contextKey: string,
  result: PromptReviewResult,
  savedAt = new Date().toISOString()
): PromptReviewSnapshot {
  return {
    id: `${contextKey}:${savedAt}`,
    contextKey,
    savedAt,
    overallScore: result.overallScore,
    findingCount: result.findings.length,
    suggestedFixCount: result.remediationSuggestions.length,
  };
}

export function appendPromptReviewSnapshot(
  snapshots: PromptReviewSnapshot[],
  snapshot: PromptReviewSnapshot,
  maximum = 100
): PromptReviewSnapshot[] {
  return [...snapshots, snapshot].slice(-maximum);
}

export function clearPromptReviewSnapshots(
  snapshots: PromptReviewSnapshot[],
  contextKey: string
): PromptReviewSnapshot[] {
  return snapshots.filter((snapshot) => snapshot.contextKey !== contextKey);
}

export function latestPromptReviewSnapshot(
  snapshots: PromptReviewSnapshot[],
  contextKey: string
): PromptReviewSnapshot | null {
  return snapshots.filter((snapshot) => snapshot.contextKey === contextKey).at(-1) ?? null;
}

export function comparePromptReviews(
  result: PromptReviewResult,
  previous: PromptReviewSnapshot | null
): PromptReviewComparison {
  const currentFindingCount = result.findings.length;
  const currentSuggestedFixCount = result.remediationSuggestions.length;

  return {
    currentScore: result.overallScore,
    previousScore: previous?.overallScore ?? null,
    scoreDelta: previous ? result.overallScore - previous.overallScore : null,
    currentFindingCount,
    previousFindingCount: previous?.findingCount ?? null,
    findingCountDelta: previous ? currentFindingCount - previous.findingCount : null,
    currentSuggestedFixCount,
    previousSuggestedFixCount: previous?.suggestedFixCount ?? null,
    suggestedFixCountDelta: previous ? currentSuggestedFixCount - previous.suggestedFixCount : null,
  };
}

export function readPromptReviewSnapshots(storage: Pick<Storage, "getItem">): PromptReviewSnapshot[] {
  try {
    const value = storage.getItem(promptReviewSnapshotsStorageKey);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writePromptReviewSnapshots(
  storage: Pick<Storage, "setItem">,
  snapshots: PromptReviewSnapshot[]
): void {
  storage.setItem(promptReviewSnapshotsStorageKey, JSON.stringify(snapshots));
}
