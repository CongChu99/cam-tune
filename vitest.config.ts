import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/captureone-service.ts",
        "lib/integration-service.ts",
        "app/api/integrations/captureone/**/*.ts",
      ],
      exclude: ["node_modules/**", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75, // Redis singleton branches require integration tests
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
