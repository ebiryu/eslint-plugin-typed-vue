import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { ESLint } from "eslint";
import * as enhancedParser from "../src/parser/enhanced-parser.js";

const fixturesDir = path.resolve(__dirname, "fixtures/basic");

function createESLint() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vueParser = require("vue-eslint-parser");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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
        plugins: {
          "@typescript-eslint": tsPlugin,
        },
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "error",
        },
      },
      {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
          parser: enhancedParser,
          parserOptions: {
            tsconfigRootDir: fixturesDir,
          },
        },
        plugins: {
          "@typescript-eslint": tsPlugin,
        },
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "error",
        },
      },
    ],
  });
}

describe("E2E: ESLint with typed Vue rules", () => {
  it("should detect no-unsafe-assignment in .vue files", async () => {
    const eslint = createESLint();
    const unsafeVuePath = path.join(fixturesDir, "unsafe.vue");
    const results = await eslint.lintFiles([unsafeVuePath]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors.length).toBeGreaterThan(0);
  });

  it("should NOT report errors on safe .vue files", async () => {
    const eslint = createESLint();
    const componentPath = path.join(fixturesDir, "Component.vue");
    const results = await eslint.lintFiles([componentPath]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });

  it("should detect no-unsafe-assignment in .ts files", async () => {
    const eslint = createESLint();
    const tsPath = path.join(fixturesDir, "unsafe-import-from-ts.ts");
    const results = await eslint.lintFiles([tsPath]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors.length).toBeGreaterThan(0);
  });

  it("should NOT report errors on .ts files importing .vue with proper types", async () => {
    const eslint = createESLint();
    const tsPath = path.join(fixturesDir, "import-from-ts.ts");
    const results = await eslint.lintFiles([tsPath]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });
});

describe("E2E: --fix does not corrupt .ts files", () => {
  it("should correctly apply prefer-const fix without corrupting code", async () => {
    const tsPlugin = require("@typescript-eslint/eslint-plugin");

    const eslint = new ESLint({
      overrideConfigFile: true,
      fix: true,
      overrideConfig: [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: enhancedParser,
            parserOptions: {
              tsconfigRootDir: fixturesDir,
            },
          },
          plugins: {
            "@typescript-eslint": tsPlugin,
          },
          rules: {
            "prefer-const": "error",
          },
        },
      ],
    });

    const tsPath = path.join(fixturesDir, "prefer-const.ts");
    const results = await eslint.lintFiles([tsPath]);

    expect(results).toHaveLength(1);

    // The fix output should contain "const" not "constststst..."
    const output = results[0].output;
    expect(output).toBeDefined();
    expect(output).toContain("const message");
    expect(output).toContain("const count");
    expect(output).not.toMatch(/const{2,}|constst/);
  });
});
