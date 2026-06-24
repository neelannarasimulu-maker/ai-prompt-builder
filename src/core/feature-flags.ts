export type FeatureFlagId = "promptReview.enabled";

export const featureFlagDefaults: Record<FeatureFlagId, boolean> = {
  "promptReview.enabled": false,
};

type FeatureFlagStorage = Pick<Storage, "getItem" | "setItem">;
type FeatureFlagListener = () => void;

const listeners = new Set<FeatureFlagListener>();

export function readFeatureFlag(
  id: FeatureFlagId,
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): boolean {
  const stored = storage?.getItem(id);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return featureFlagDefaults[id];
}

export function setFeatureFlag(
  id: FeatureFlagId,
  enabled: boolean,
  storage: FeatureFlagStorage | undefined =
    typeof window === "undefined" ? undefined : window.localStorage
): void {
  storage?.setItem(id, String(enabled));
  for (const listener of listeners) listener();
}

export function subscribeToFeatureFlags(listener: FeatureFlagListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
