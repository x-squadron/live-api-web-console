import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
// import { loadEnv } from "vite";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // env: loadEnv("development", process.cwd(), ""),
    globals: true,
    setupFiles: "src/setupTests.ts",
    environment: "jsdom",
    deps: {
      inline: ["vitest-canvas-mock"],
    },
    environmentOptions: {
      jsdom: {
        resources: "usable",
      },
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTransformMode: {
      web: [".tsx"],
    },
    coverage: {
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "node_modules",
        "./src/reportWebVitals.ts",
        "./src/react-app-env.d.ts",
        "**/__tests__/**",
      ],
      provider: "istanbul",
      reporter: ["text", "json", "html", "json-summary", "lcov"],
      // If you want a coverage reports even if your tests are failing, include the reportOnFailure option
      reportOnFailure: true,
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 92.5,
        branches: 87.15,
        functions: 95.65,
        lines: 92.45,
      },
    },
    exclude: ["node_modules"],
  },
});
