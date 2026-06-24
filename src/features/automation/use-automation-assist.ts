import { useState } from "react";
import type { ChatGptAssistImportResponse } from "../../lib/prompt-builder/chatgpt-assist";
import { useLocalStorageState } from "../../ui/hooks/use-local-storage-state";

export function useAutomationAssist() {
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false);
  const [assistTargetVersion, setAssistTargetVersion] = useLocalStorageState("promptBuilder.assistTargetVersion", "");
  const [assistRunStartedAt, setAssistRunStartedAt] = useState("");
  const [assistSavedFile, setAssistSavedFile] = useState<ChatGptAssistImportResponse | null>(null);
  const [assistError, setAssistError] = useState("");
  const [isImportingAssistDownload, setIsImportingAssistDownload] = useState(false);
  const [assistCopiedPrompt, setAssistCopiedPrompt] = useState(false);
  const [assistCopiedFilename, setAssistCopiedFilename] = useState(false);
  const [assistChatGptOpened, setAssistChatGptOpened] = useState(false);
  const [assistUploadFile, setAssistUploadFile] = useState<File | null>(null);

  return {
    isAssistModalOpen, setIsAssistModalOpen, assistTargetVersion, setAssistTargetVersion,
    assistRunStartedAt, setAssistRunStartedAt, assistSavedFile, setAssistSavedFile,
    assistError, setAssistError, isImportingAssistDownload, setIsImportingAssistDownload,
    assistCopiedPrompt, setAssistCopiedPrompt, assistCopiedFilename, setAssistCopiedFilename,
    assistChatGptOpened, setAssistChatGptOpened, assistUploadFile, setAssistUploadFile,
  };
}
