import { useState } from "react";
import type { BackgroundTheme } from "../../lib/prompt-builder/background-themes";
import type { WorkflowMode } from "../../lib/prompt-builder/workflow-features";
import { useLocalStorageState } from "../../ui/hooks/use-local-storage-state";

export function usePromptBuilderSession() {
  const [selectedContentType, setSelectedContentType] = useLocalStorageState("promptBuilder.selectedContentType", "");
  const [selectedContentSet, setSelectedContentSet] = useLocalStorageState("promptBuilder.selectedContentSet", "");
  const [selectedContentPath, setSelectedContentPath] = useLocalStorageState("promptBuilder.selectedContentPath", "");
  const [editableMarkdown, setEditableMarkdown] = useState("");
  const [savedMarkdownByPath, setSavedMarkdownByPath] = useState<Record<string, string>>({});
  const [selectedOutputProfileId, setSelectedOutputProfileId] = useLocalStorageState("promptBuilder.selectedOutputProfileId", "landscape_image_16_9");
  const [selectedLayoutPresetId, setSelectedLayoutPresetId] = useLocalStorageState("promptBuilder.selectedLayoutPresetId", "auto");
  const [selectedBackgroundPresetId, setSelectedBackgroundPresetId] = useLocalStorageState("promptBuilder.selectedBackgroundPresetId", "auto");
  const [selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId] = useLocalStorageState("promptBuilder.selectedDocumentBackgroundPresetId", "auto_brand_document");
  const [selectedBackgroundTheme, setSelectedBackgroundTheme] = useLocalStorageState<BackgroundTheme>("promptBuilder.selectedBackgroundTheme", "balanced");
  const [promptView, setPromptView] = useLocalStorageState<"production" | "debug" | "actions" | "contract">("promptBuilder.promptView", "production");
  const [selectedDocumentChunkIndex, setSelectedDocumentChunkIndex] = useLocalStorageState("promptBuilder.selectedDocumentChunkIndex", 0);
  const [customOutputFilename, setCustomOutputFilename] = useLocalStorageState("promptBuilder.customOutputFilename", "");
  const [workflowMode, setWorkflowMode] = useLocalStorageState<WorkflowMode>("promptBuilder.workflowMode", "run");
  const [selectedRecipeId, setSelectedRecipeId] = useLocalStorageState("promptBuilder.selectedRecipeId", "investor_deck");
  const [selectedVariantId, setSelectedVariantId] = useLocalStorageState("promptBuilder.selectedVariantId", "executive_minimal");
  const [selectedBatchContentPaths, setSelectedBatchContentPaths] = useLocalStorageState<string[]>("promptBuilder.selectedBatchContentPaths", []);
  const [approvedGeneratedFileIds, setApprovedGeneratedFileIds] = useLocalStorageState<string[]>("promptBuilder.approvedGeneratedFileIds", []);
  const [selectedSourceVersionPath, setSelectedSourceVersionPath] = useLocalStorageState("promptBuilder.selectedSourceVersionPath", "");

  return {
    selectedContentType, setSelectedContentType, selectedContentSet, setSelectedContentSet,
    selectedContentPath, setSelectedContentPath, editableMarkdown, setEditableMarkdown,
    savedMarkdownByPath, setSavedMarkdownByPath, selectedOutputProfileId, setSelectedOutputProfileId,
    selectedLayoutPresetId, setSelectedLayoutPresetId, selectedBackgroundPresetId, setSelectedBackgroundPresetId,
    selectedDocumentBackgroundPresetId, setSelectedDocumentBackgroundPresetId, selectedBackgroundTheme, setSelectedBackgroundTheme,
    promptView, setPromptView, selectedDocumentChunkIndex, setSelectedDocumentChunkIndex,
    customOutputFilename, setCustomOutputFilename, workflowMode, setWorkflowMode,
    selectedRecipeId, setSelectedRecipeId, selectedVariantId, setSelectedVariantId,
    selectedBatchContentPaths, setSelectedBatchContentPaths, approvedGeneratedFileIds, setApprovedGeneratedFileIds,
    selectedSourceVersionPath, setSelectedSourceVersionPath,
  };
}
