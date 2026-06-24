import { PromptBuilderView } from "./controllers/prompt-builder-view";
import { usePromptBuilderController } from "./hooks/use-prompt-builder-controller";

export function PromptBuilderApp() {
  const controller = usePromptBuilderController();
  return <PromptBuilderView controller={controller} />;
}

