import type { ESLint, Linter } from "eslint";
import * as vueParser from "vue-eslint-parser";
import * as enhancedParser from "../parser/enhanced-parser.ts";
import { processor } from "../processor.ts";

export function createRecommendedConfig(plugin: ESLint.Plugin): Linter.Config[] {
  return [
    {
      name: "typed-vue/plugin",
      plugins: { "typed-vue": plugin },
    },
    {
      name: "typed-vue/recommended-vue",
      files: ["**/*.vue"],
      processor,
      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser: enhancedParser,
          extraFileExtensions: [".vue"],
        },
      },
    },
    {
      name: "typed-vue/recommended-ts",
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      languageOptions: {
        parser: enhancedParser,
      },
    },
  ];
}
