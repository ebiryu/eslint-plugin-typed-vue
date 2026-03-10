import type { ESLint } from "eslint";
import { createRecommendedConfig } from "./configs/recommended.js";
import { rules } from "./rules/index.js";

const plugin: ESLint.Plugin = {
  meta: {
    name: "eslint-plugin-typed-vue",
    version: "0.1.0",
  },
  rules,
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

export default plugin;
