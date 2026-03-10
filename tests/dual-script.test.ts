import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { ESLint } from "eslint";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.js";
import { ProgramProvider } from "../src/services/program-provider.js";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import ts from "typescript";

const fixturesDir = path.resolve(__dirname, "fixtures/dual-script");

describe("dual script: VueVirtualFiles", () => {
  it("should generate virtual code containing both script and script setup content", () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    });

    const content = fs.readFileSync(path.join(fixturesDir, "safe-dual.vue"), "utf-8");
    const result = vueFiles.getVirtualFile(path.join(fixturesDir, "safe-dual.vue"), content);

    expect(result).toBeDefined();
    // Should contain content from both script blocks
    expect(result!.code).toContain("Item");
    expect(result!.code).toContain("ref");
  });
});

describe("dual script: ProgramProvider", () => {
  it("should resolve types exported from the normal script block", () => {
    const provider = new ProgramProvider(ts);
    const program = provider.getProgram(fixturesDir);

    const dualFile = program.getSourceFiles().find((sf) => sf.fileName.includes("safe-dual.vue"));
    expect(dualFile).toBeDefined();

    const text = dualFile!.getText();
    expect(text).toContain("Item");
    expect(text).toContain("ref");
  });
});

describe("dual script: E2E ESLint", () => {
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
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: enhancedParser,
            parserOptions: { tsconfigRootDir: fixturesDir },
          },
          plugins: { "@typescript-eslint": tsPlugin },
          rules: { "@typescript-eslint/no-unsafe-assignment": "error" },
        },
      ],
    });
  }

  it("should detect no-unsafe-assignment in dual script .vue", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-dual.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors.length).toBeGreaterThan(0);
  });

  it("should NOT report errors on safe dual script .vue", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "safe-dual.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });

  it("should NOT report errors when importing types from dual script .vue", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "import-dual.ts")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });
});
