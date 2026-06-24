import type { ReactNode } from "react";

export function ProjectWizard({ children }: { children: ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="project-wizard-title">
      <div className="automation-modal project-wizard-modal">{children}</div>
    </div>
  );
}
