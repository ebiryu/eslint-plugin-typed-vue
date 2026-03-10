import type { Linter } from "eslint";
import * as vueParser from "vue-eslint-parser";
import * as enhancedParser from "../parser/enhanced-parser.js";

export function createRecommendedConfig(): Linter.Config[] {
  return [
    {
      name: "typed-vue/recommended-vue",
      files: ["**/*.vue"],
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
