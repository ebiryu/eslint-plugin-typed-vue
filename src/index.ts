import type { ESLint } from "eslint";
import ts from "typescript";
import { createRecommendedConfig } from "./configs/recommended.ts";
import { rules } from "./rules/index.ts";
import { processor } from "./processor.ts";
import { getProgramProvider } from "./services/program-provider.ts";

const plugin: ESLint.Plugin = {
  meta: {
    name: "eslint-plugin-typed-vue",
    version: "0.1.0",
  },
  rules,
  processors: {
    vue: processor,
  },
  configs: {},
};

// Lazily define configs to avoid circular references
Object.defineProperty(plugin, "configs", {
  get() {
    return {
      recommended: createRecommendedConfig(),
    };
  },
});

/**
 * Reset all internal caches (Program, VueVirtualFiles, tsconfig).
 * Call this when the file system has changed between lint runs.
 */
export function resetCache(): void {
  getProgramProvider(ts).reset();
}

export default plugin;
