import type { Plugin } from "vite";
import { createLocalAppRouteContext } from "../http/local-app-context";
import { registerAutomationRoutes } from "./automation-routes";
import { registerContentRoutes } from "./content-routes";
import { registerDistributionRoutes } from "./distribution-routes";
import { registerGeneratedContentRoutes } from "./generated-content-routes";
import { registerProjectRoutes } from "./project-routes";
import { registerStorageRoutes } from "./storage-routes";

export function localFilePlugin(): Plugin {
  const context = createLocalAppRouteContext();

  return {
    name: "prompt-builder-persist-output-name-api",
    configureServer(server) {
      registerStorageRoutes(server, context);
      registerProjectRoutes(server, context);
      registerContentRoutes(server, context);
      registerAutomationRoutes(server, context);
      registerDistributionRoutes(server, context);
      registerGeneratedContentRoutes(server, context);
    },
  };
}

