
/// <reference types="vitest/config" />

import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const { PORT } = loadEnv(mode, process.cwd(), "");
  const previewPort = PORT ? Number(PORT) : 3000;

  if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65535) {
    throw new Error(`Invalid PORT value: ${PORT}`);
  }

  return {
    plugins: [react(), svgr()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
    },
    preview: {
      port: previewPort,
      strictPort: true,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/setupTests.js"],
      exclude: [
        ...configDefaults.exclude,
        // These specs cover the removed carousel and CRA backend-host resolver.
        "src/shared/ui/__tests__/CommunityReportsCarousel.test.jsx",
        "src/shared/utils/__tests__/backendHost.test.js",
      ],
    },
  };
});
