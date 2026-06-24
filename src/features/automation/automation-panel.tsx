import type { ReactNode } from "react";

export function AutomationPanel({ children }: { children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="assist-modal-title">
      <div className="automation-modal">{children}</div>
    </div>
  );
}
