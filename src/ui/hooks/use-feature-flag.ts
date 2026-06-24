import { useCallback, useSyncExternalStore } from "react";
import {
  featureFlagDefaults,
  readFeatureFlag,
  setFeatureFlag,
  subscribeToFeatureFlags,
  type FeatureFlagId,
} from "../../core/feature-flags";

export function useFeatureFlag(id: FeatureFlagId): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribeToFeatureFlags,
    () => readFeatureFlag(id),
    () => featureFlagDefaults[id]
  );
  const update = useCallback((nextEnabled: boolean) => {
    setFeatureFlag(id, nextEnabled);
  }, [id]);

  return [enabled, update];
}
