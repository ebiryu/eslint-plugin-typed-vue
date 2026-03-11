import type { Linter } from "eslint";
import * as vueParser from "vue-eslint-parser";
import * as enhancedParser from "../parser/enhanced-parser.ts";
import { processor } from "../processor.ts";

export function createRecommendedConfig(): Linter.Config[] {
  return [
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
