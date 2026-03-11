import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { ESLint } from "eslint";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import { processor } from "../src/processor.js";

const fixturesDir = path.resolve(__dirname, "fixtures/vue-features");

function createESLint(rules: Record<string, unknown> = {}) {
  const vueParser = require("vue-eslint-parser");
  const tsPlugin = require("@typescript-eslint/eslint-plugin");

  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.vue"],
        processor,
        languageOptions: {
          parser: vueParser,
          parserOptions: {
            parser: enhancedParser,
            tsconfigRootDir: fixturesDir,
            extraFileExtensions: [".vue"],
          },
        },
        plugins: { "@typescript-eslint": tsPlugin },
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "error",
          "@typescript-eslint/no-unsafe-member-access": "error",
          ...rules,
        },
      },
      {
        files: ["**/*.ts"],
        languageOptions: {
          parser: enhancedParser,
          parserOptions: { tsconfigRootDir: fixturesDir },
        },
        plugins: { "@typescript-eslint": tsPlugin },
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "error",
          "@typescript-eslint/no-unsafe-member-access": "error",
          ...rules,
        },
      },
    ],
  });
}

async function lintFile(name: string, rules?: Record<string, unknown>) {
  const eslint = createESLint(rules);
  const results = await eslint.lintFiles([path.join(fixturesDir, name)]);
  return results[0];
}

describe("vue features: defineEmits", () => {
  it("should not report errors on correctly typed defineEmits", { timeout: 15000 }, async () => {
    const result = await lintFile("define-emits.vue");
    const errors = result.messages.filter(
      (m) => m.severity === 2 && m.ruleId?.startsWith("@typescript-eslint/"),
    );
    expect(errors).toHaveLength(0);
  });
});

describe("vue features: defineProps with interface", () => {
  it("should not report errors on typed defineProps", { timeout: 15000 }, async () => {
    const result = await lintFile("define-props-generic.vue");
    const errors = result.messages.filter(
      (m) => m.severity === 2 && m.ruleId?.startsWith("@typescript-eslint/"),
    );
    expect(errors).toHaveLength(0);
  });
});

describe("vue features: generic component", () => {
  it("should not report errors on generic <script setup>", { timeout: 15000 }, async () => {
    const result = await lintFile("generic-component.vue");
    const errors = result.messages.filter(
      (m) => m.severity === 2 && m.ruleId?.startsWith("@typescript-eslint/"),
    );
    expect(errors).toHaveLength(0);
  });
});

describe("vue features: computed and ref", () => {
  it("should not report errors on typed computed/ref/watch", { timeout: 15000 }, async () => {
    const result = await lintFile("computed-ref.vue");
    const errors = result.messages.filter(
      (m) => m.severity === 2 && m.ruleId?.startsWith("@typescript-eslint/"),
    );
    expect(errors).toHaveLength(0);
  });
});

describe("vue features: unsafe any prop", () => {
  it("should detect unsafe member access on any-typed prop", { timeout: 15000 }, async () => {
    const result = await lintFile("unsafe-any-prop.vue");

    // Script-level: props.data.nested.deep should trigger unsafe errors
    const scriptErrors = result.messages.filter(
      (m) =>
        m.ruleId === "@typescript-eslint/no-unsafe-member-access" ||
        m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(scriptErrors.length).toBeGreaterThan(0);
  });
});

describe("vue features: cross-component type import", () => {
  it("should resolve imported types correctly", { timeout: 15000 }, async () => {
    const result = await lintFile("cross-component.vue");
    const errors = result.messages.filter(
      (m) => m.severity === 2 && m.ruleId?.startsWith("@typescript-eslint/"),
    );
    expect(errors).toHaveLength(0);
  });
});
