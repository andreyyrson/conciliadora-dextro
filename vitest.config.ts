import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ["lib/**/*.test.ts", "app/api/**/*.test.ts"],
    sequence: { concurrent: false },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
