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

  it("should treat comparison and binary expressions as boolean", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "comparison-expr.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    // Should report: v-else-if="count" (line 13), v-show="count" (line 17)
    // Should NOT report: stats.length === 0, stats.length > 5, count !== 0, !flag, stats.length >= 1
    expect(errors.length).toBe(2);

    const lines = errors.map((e) => e.line).sort((a, b) => a - b);
    expect(lines).toEqual([13, 17]);
  });

  it("should correctly type-check property access expressions like state.isLoading", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "prop-boolean.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    // state.isLoading is boolean → should NOT be reported
    // state.count is number → should be reported (line 12)
    // state.name is string → should be reported (line 13)
    expect(errors.length).toBe(2);
    expect(errors.every((e) => e.line !== 11)).toBe(true); // line 11 is state.isLoading
  });

  it("should unwrap Vue Ref/ComputedRef types in template expressions", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "ref-unwrap.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    // ref(true) → boolean, computed(() => bool) → boolean, shallowRef(false) → boolean → OK
    // ref(0) → number → NOT OK (line 15)
    // ref("hello") → string → NOT OK (line 16)
    expect(errors.length).toBe(2);

    const lines = errors.map((e) => e.line).sort((a, b) => a - b);
    expect(lines).toEqual([15, 16]);

    // Verify the reported types are unwrapped (number/string, not Ref<number>/Ref<string>)
    expect(errors.every((e) => !e.message.includes("Ref"))).toBe(true);
  });

  it("should resolve correct types for logical AND/OR expressions", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "logical-expr.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/strict-boolean-expressions",
    );

    // Line 16: `item.meta && showActions` → boolean | undefined → NOT OK
    // Line 17: `isReady && count > 0` → boolean → OK
    // Line 18: `isReady || count > 0` → boolean → OK
    // Line 19: `item.meta && count > 0` → false | boolean → NOT OK
    expect(errors.length).toBe(2);

    const lines = errors.map((e) => e.line).sort((a, b) => a - b);
    expect(lines).toEqual([16, 19]);

    // Verify the reported types are NOT 'any' — they should be the actual resolved type
    for (const e of errors) {
      expect(e.message).not.toContain("'any'");
    }
  });
});
