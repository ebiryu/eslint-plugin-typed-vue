import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { ESLint } from "eslint";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import plugin from "../src/index.js";

const fixturesDir = path.resolve(__dirname, "fixtures/template-types");

function createESLint() {
  const vueParser = require("vue-eslint-parser");

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
        plugins: {
          "typed-vue": plugin,
        },
        rules: {
          "typed-vue/strict-boolean-expressions": "error",
        },
      },
    ],
  });
}

describe("typed-vue/strict-boolean-expressions", () => {
  it("should report non-boolean expressions in v-if and v-show", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "boolean-vif.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    // Should report: count (42), name ("hello"), v-show count (42)
    // Should NOT report: isVisible (boolean), items.length > 0 (boolean), v-show isVisible (boolean)
    expect(errors.length).toBe(3);

    // Check that non-boolean types are reported (const literals are inferred as literal types)
    const errorMessages = errors.map((e) => e.message);
    expect(errorMessages.some((m) => m.includes("42"))).toBe(true);
    expect(errorMessages.some((m) => m.includes('"hello"'))).toBe(true);
  });

  it("should report correct line numbers for template errors", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "boolean-vif.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    const lines = errors.map((e) => e.line).sort((a, b) => a - b);
    // v-if="count" is line 10, v-if="name" is line 11, v-show="count" is line 14
    expect(lines).toEqual([10, 11, 14]);
  });
});
