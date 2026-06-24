import { useMemo } from "react";
import type { PromptReviewResult } from "../../../review/prompt-review-types";
import {
  appendPromptReviewSnapshot,
  clearPromptReviewSnapshots,
  comparePromptReviews,
  createPromptReviewSnapshot,
  latestPromptReviewSnapshot,
  promptReviewSnapshotsStorageKey,
  type PromptReviewSnapshot,
} from "../../../review/prompt-review-snapshots";
import { useLocalStorageState } from "../../../ui/hooks/use-local-storage-state";

export function usePromptReviewSnapshots(
  contextKey: string,
  result: PromptReviewResult | null
) {
  const [snapshots, setSnapshots] = useLocalStorageState<PromptReviewSnapshot[]>(
    promptReviewSnapshotsStorageKey,
    []
  );
  const previousSnapshot = useMemo(
    () => latestPromptReviewSnapshot(snapshots, contextKey),
    [snapshots, contextKey]
  );
  const comparison = useMemo(
    () => result ? comparePromptReviews(result, previousSnapshot) : null,
    [result, previousSnapshot]
  );

  function saveSnapshot(): void {
    if (!result || !contextKey) return;
    setSnapshots((current) =>
      appendPromptReviewSnapshot(current, createPromptReviewSnapshot(contextKey, result))
    );
  }

  function clearSnapshots(): void {
    if (!contextKey) return;
    setSnapshots((current) => clearPromptReviewSnapshots(current, contextKey));
  }

  return {
    previousSnapshot,
    comparison,
    saveSnapshot,
    clearSnapshots,
  };
}
