import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { ESLint } from "eslint";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import plugin from "../src/index.js";

const fixturesDir = path.resolve(__dirname, "fixtures/template-types");

function createESLint(rules: Record<string, string>) {
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
        rules,
      },
    ],
  });
}

describe("typed-vue/no-unsafe-template-expression", () => {
  it("should report `any` in interpolation and v-bind", async () => {
    const eslint = createESLint({
      "typed-vue/no-unsafe-template-expression": "error",
    });
    const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-template.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/no-unsafe-template-expression",
    );

    // {{ unsafeValue }} on line 10, :value="unsafeValue" on line 12
    expect(errors.length).toBe(2);

    const interpolation = errors.find((e) => e.message.includes("interpolation"));
    const binding = errors.find((e) => e.message.includes("v-bind"));
    expect(interpolation).toBeDefined();
    expect(binding).toBeDefined();
  });

  it("should not report safe typed expressions", async () => {
    const eslint = createESLint({
      "typed-vue/no-unsafe-template-expression": "error",
    });
    const results = await eslint.lintFiles([path.join(fixturesDir, "boolean-vif.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/no-unsafe-template-expression",
    );
    expect(errors.length).toBe(0);
  });

  it("should not report template literals with safe typed expressions", async () => {
    const eslint = createESLint({
      "typed-vue/no-unsafe-template-expression": "error",
    });
    const results = await eslint.lintFiles([path.join(fixturesDir, "template-literal.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/no-unsafe-template-expression",
    );

    // Only `:href="unsafeVal"` on line 18 should be reported (any type)
    // Template literals on lines 13-17 should NOT be reported (type is string)
    expect(errors.length).toBe(1);
    expect(errors[0].line).toBe(17);
  });
});

describe("typed-vue/no-unsafe-event-handler", () => {
  it("should report `any` typed event handler", async () => {
    const eslint = createESLint({
      "typed-vue/no-unsafe-event-handler": "error",
    });
    const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-template.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/no-unsafe-event-handler",
    );

    // @click="unsafeHandler" on line 14
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("any");
  });

  it("should not report safe typed event handler", async () => {
    const eslint = createESLint({
      "typed-vue/no-unsafe-event-handler": "error",
    });
    const results = await eslint.lintFiles([path.join(fixturesDir, "boolean-vif.vue")]);

    const errors = results[0].messages.filter(
      (m) => m.ruleId === "typed-vue/no-unsafe-event-handler",
    );
    expect(errors.length).toBe(0);
  });
});
