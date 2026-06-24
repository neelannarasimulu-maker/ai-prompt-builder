import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localFilePlugin } from "./server/routes/local-app-routes";

export default defineConfig({
  plugins: [react(), localFilePlugin()],
  server: {
    host: "0.0.0.0",
    port: 5177,
    strictPort: true,
    watch: {
      ignored: [
        "**/.local/**",
        "**/.local/chatgpt-rpa-profile/**",
        "**/automation/*.local.json",
      ],
    },
  },
});
