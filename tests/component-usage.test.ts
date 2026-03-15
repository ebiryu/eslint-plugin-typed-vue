import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import ts from "typescript";
import { ESLint } from "eslint";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.ts";
import { processor } from "../src/processor.ts";
import * as enhancedParser from "../src/parser/enhanced-parser.ts";

const fixturesDir = path.resolve(__dirname, "fixtures/processor");

describe("no-unused-expressions in template", () => {
  it("should show generated code for auto-imported components", () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      jsx: ts.JsxEmit.Preserve,
    });

    const filePath = path.join(fixturesDir, "auto-import.vue");
    const content = fs.readFileSync(filePath, "utf-8");
    const vFileInfo = vueFiles.getVirtualFile(filePath, content);
    expect(vFileInfo).toBeDefined();
    console.log("=== Generated code (auto-import) ===");
    console.log(vFileInfo!.code);
  });

  it(
    "should suppress no-unused-expressions for auto-imported component tags but NOT for props/emits",
    { timeout: 15000 },
    async () => {
      const vueParser = require("vue-eslint-parser");
      const tsPlugin = require("@typescript-eslint/eslint-plugin");
      const eslint = new ESLint({
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
              "@typescript-eslint/no-unused-expressions": "error",
              "@typescript-eslint/no-unsafe-assignment": "error",
            },
          },
          {
            files: ["**/*.ts"],
            languageOptions: {
              parser: enhancedParser,
              parserOptions: {
                tsconfigRootDir: fixturesDir,
                extraFileExtensions: [".vue"],
              },
            },
            plugins: { "@typescript-eslint": tsPlugin },
            rules: {
              "@typescript-eslint/no-unused-expressions": "error",
              "@typescript-eslint/no-unsafe-assignment": "error",
            },
          },
        ],
      });

      const results = await eslint.lintFiles([path.join(fixturesDir, "auto-import.vue")]);
      expect(results).toHaveLength(1);

      const allErrors = results[0].messages;
      console.log("=== All messages ===");
      for (const e of allErrors) {
        console.log(`  line ${e.line}:${e.column} [${e.ruleId}] ${e.message}`);
      }

      // no-unused-expressions from auto-imported component tags should be suppressed
      const unusedExprErrors = allErrors.filter(
        (m) =>
          m.ruleId === "@typescript-eslint/no-unused-expressions" ||
          m.ruleId === "no-unused-expressions",
      );
      expect(unusedExprErrors).toHaveLength(0);

      // Props/emit type errors should still be reported.
      // state is typed as `any`, so no-unsafe-assignment should fire on prop bindings.
      const unsafeAssignErrors = allErrors.filter(
        (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
      );
      expect(unsafeAssignErrors.length).toBeGreaterThan(0);
    },
  );
});
