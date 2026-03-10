import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { ESLint } from "eslint";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.js";
import { ProgramProvider } from "../src/services/program-provider.js";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import ts from "typescript";

const fixturesDir = path.resolve(__dirname, "fixtures/tsx");

describe("tsx: VueVirtualFiles", () => {
  it('should generate virtual code with TSX script kind for <script lang="tsx">', () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
      jsx: ts.JsxEmit.Preserve,
    });

    const content = fs.readFileSync(path.join(fixturesDir, "safe-tsx.vue"), "utf-8");
    const result = vueFiles.getVirtualFile(path.join(fixturesDir, "safe-tsx.vue"), content);

    expect(result).toBeDefined();
    expect(result!.scriptKind).toBe(ts.ScriptKind.TSX);
  });
});

describe("tsx: ProgramProvider", () => {
  it("should include tsx .vue files with correct ScriptKind", () => {
    const provider = new ProgramProvider(ts);
    const program = provider.getProgram(fixturesDir);

    const tsxFile = program.getSourceFiles().find((sf) => sf.fileName.includes("safe-tsx.vue"));
    expect(tsxFile).toBeDefined();
    expect(tsxFile!.getText()).toContain("defineComponent");
  });
});

describe("tsx: E2E ESLint", () => {
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

  it("should detect no-unsafe-assignment in <script lang=\"tsx\">", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-tsx.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors.length).toBeGreaterThan(0);
  });

  it("should NOT report errors on safe <script lang=\"tsx\">", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "safe-tsx.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });

  it("should NOT report errors when importing a tsx component from .ts", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "import-tsx-component.ts")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });
});
