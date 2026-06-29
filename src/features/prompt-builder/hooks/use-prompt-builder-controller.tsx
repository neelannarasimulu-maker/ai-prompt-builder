import { backgroundPresets } from "../../../lib/prompt-builder/background-presets";
import { backgroundThemes } from "../../../lib/prompt-builder/background-themes";
import { documentBackgroundPresets } from "../../../lib/prompt-builder/document-background-presets";
import {
  basenameWithoutExtension,
  formatFileSize,
  generatedContentCategories,
  type GeneratedContentFile,
} from "../../../lib/prompt-builder/project-generated-content-api";
import { layoutPresets } from "../../../lib/prompt-builder/layout-presets";
import {
  normalizeAssistImageFilename,
  normalizeAssistVersionLabel,
  validateAssistImportInput,
} from "../../../lib/prompt-builder/chatgpt-assist";
import {
  firstLogoAssetPath,
  logoNotesFromMarkdown,
} from "../../../core/content/static-content-repository";
import { AutomationPanel } from "../../automation/automation-panel";
import { DistributionPanel } from "../../distribution/distribution-panel";
import { ProjectWizard } from "../../projects/project-wizard";
import { AppShell } from "../../../ui/layouts/app-shell";
import { ToastStack } from "../../../ui/components/toast-stack";

import { usePromptSelections } from "./use-prompt-selections";
import { useSourceEditing } from "./use-source-editing";
import { usePromptCompilation } from "./use-prompt-compilation";
import { useGeneratedContentCoordination } from "./use-generated-content-coordination";
import { useAutomationCoordination } from "./use-automation-coordination";
import { useReviewCoordination } from "./use-review-coordination";
import { useContentSave } from "./use-content-save";
import { usePromptActions } from "./use-prompt-actions";
import {
  promptRecipes,
  variantDirections,
  workflowModes,
} from "../../../lib/prompt-builder/workflow-features";
import { slugifyProjectName, type ProjectWorkflow } from "../../../lib/prompt-builder";
type OutputProfileItem = {
  id: string;
  label: string;
  outputType: "image" | "document" | "pdf" | "text" | "email";
  format?: string;
  useCase?: string;
  instruction?: string;
  typography?: string;
};

const projectWorkflowOptions: Array<{ id: ProjectWorkflow; label: string; description: string }> = [
  { id: "presentation", label: "Presentation", description: "Visual rules and a structured opening visual, with optional supporting slides." },
  { id: "document_pack", label: "Document pack", description: "Project document rules and an attachment-first main document source." },
  { id: "linkedin_campaign", label: "LinkedIn campaign", description: "A written post with an optional mobile visual source." },
  { id: "mixed", label: "Mixed project", description: "Visual, document and LinkedIn starter sources in one project." },
];

function outputPromptModeLabel(outputType?: OutputProfileItem["outputType"]): string {
  if (outputType === "image") return "Exact Image";
  if (outputType === "document") return "Exact Document";
  if (outputType === "pdf") return "Exact PDF";
  return "Exact Text/Email";
}

function contentTypeLabel(type: string): string {
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function categoryLabel(category: string): string {
  return generatedContentCategories.find((item) => item.id === category)?.label ?? category;
}

function filePreviewTitle(file: GeneratedContentFile | null): string {
  if (!file) return "No generated content selected";
  return `${file.displayName || basenameWithoutExtension(file.filename)} | ${formatFileSize(file.sizeBytes)}`;
}


export function usePromptBuilderController() {
  const selections = usePromptSelections();
  const sourceEditing = useSourceEditing(selections);
  const compilation = usePromptCompilation(sourceEditing);
  const generatedContent = useGeneratedContentCoordination(compilation);
  const automation = useAutomationCoordination(generatedContent);
  const review = useReviewCoordination(automation);
  const contentSave = useContentSave(review);
  const actions = usePromptActions(contentSave);

  return {
    ...actions,
    AppShell,
    AutomationPanel,
    DistributionPanel,
    ProjectWizard,
    ToastStack,
    backgroundPresets,
    backgroundThemes,
    basenameWithoutExtension,
    categoryLabel,
    contentTypeLabel,
    documentBackgroundPresets,
    filePreviewTitle,
    firstLogoAssetPath,
    formatFileSize,
    generatedContentCategories,
    layoutPresets,
    logoNotesFromMarkdown,
    normalizeAssistImageFilename,
    normalizeAssistVersionLabel,
    outputPromptModeLabel,
    projectWorkflowOptions,
    promptRecipes,
    slugifyProjectName,
    validateAssistImportInput,
    variantDirections,
    workflowModes,
  };
}
