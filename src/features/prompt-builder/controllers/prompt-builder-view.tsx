import type { usePromptBuilderController } from "../hooks/use-prompt-builder-controller";
import { AutomationSection } from "../sections/automation-section";
import { ProjectSelectionSection } from "../sections/project-selection-section";
import { ProjectWizardSection } from "../sections/project-wizard-section";
import { PromptHeaderSection } from "../sections/prompt-header-section";
import { PromptPreviewSection } from "../sections/prompt-preview-section";
import { ReviewSection } from "../sections/review-section";
import { SourceEditorSection } from "../sections/source-editor-section";

export type PromptBuilderController = ReturnType<typeof usePromptBuilderController>;

export function PromptBuilderView({ controller }: { controller: PromptBuilderController }) {
  const { AppShell, ToastStack, toasts, workflowMode } = controller;

  return (
    <AppShell>
      <ToastStack toasts={toasts} />
      <ProjectWizardSection controller={controller} />
      <AutomationSection controller={controller} />
      <PromptHeaderSection controller={controller} />
      {workflowMode !== "distribution" && (
        <main className={`workspace-grid workspace-grid-${workflowMode}`}>
          <ProjectSelectionSection controller={controller} />
          <SourceEditorSection controller={controller} />
          <PromptPreviewSection controller={controller} />
          <ReviewSection controller={controller} />
        </main>
      )}
    </AppShell>
  );
}

