import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { ESLint } from "eslint";
import * as enhancedParser from "../src/parser/enhanced-parser.js";

const fixturesDir = path.resolve(__dirname, "fixtures/source-map");

function createESLint() {
  const vueParser = require("vue-eslint-parser");
  const tsPlugin = require("@typescript-eslint/eslint-plugin");

  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.vue"],
        languageOptions: {
          parser: vueParser,
          parserOptions: {
            parser: enhancedParser,
            tsconfigRootDir: fixturesDir,
            extraFileExtensions: [".vue"],
          },
        },
        plugins: { "@typescript-eslint": tsPlugin },
        rules: { "@typescript-eslint/no-unsafe-assignment": "error" },
      },
    ],
  });
}

describe("template type checking", () => {
  it("should detect no-unsafe-assignment in script even when template uses unsafe vars", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "template-unsafe.vue")]);

    expect(results).toHaveLength(1);
    // The unsafe assignment in <script setup> should still be detected
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(errors.length).toBeGreaterThan(0);
    // Error should be on line 3 (const unsafe: string = {} as any)
    expect(errors[0].line).toBe(3);
  });
});

describe("source map: error positions", () => {
  it("should report correct line numbers for <script lang=\"ts\">", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "multiline-unsafe.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );

    // unsafe1 is on line 6, unsafe2 is on line 8 in the .vue file
    expect(errors).toHaveLength(2);
    expect(errors[0].line).toBe(6);
    expect(errors[1].line).toBe(8);
  });

  it("should report correct line numbers for <script setup lang=\"ts\">", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "setup-multiline.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );

    // unsafe1 is on line 6, unsafe2 is on line 8 in the .vue file
    expect(errors).toHaveLength(2);
    expect(errors[0].line).toBe(6);
    expect(errors[1].line).toBe(8);
  });
});
