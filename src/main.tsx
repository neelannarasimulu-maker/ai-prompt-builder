import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { PromptBuilderApp } from "./features/prompt-builder/prompt-builder-app";
import { ErrorBoundary } from "./ui/components/error-boundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PromptBuilderApp />
    </ErrorBoundary>
  </React.StrictMode>
);
