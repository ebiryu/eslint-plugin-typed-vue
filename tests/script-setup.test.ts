import { describe, it, expect, beforeEach } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { ESLint } from "eslint";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.js";
import { ProgramProvider } from "../src/services/program-provider.js";
import * as enhancedParser from "../src/parser/enhanced-parser.js";
import ts from "typescript";

const fixturesDir = path.resolve(__dirname, "fixtures/script-setup");

describe("script setup: VueVirtualFiles", () => {
  it('should generate virtual code from <script setup lang="ts">', () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    });

    const content = fs.readFileSync(path.join(fixturesDir, "safe-setup.vue"), "utf-8");
    const result = vueFiles.getVirtualFile(path.join(fixturesDir, "safe-setup.vue"), content);

    expect(result).toBeDefined();
    expect(result!.code).toContain("ref");
    expect(result!.code).toContain("count");
    expect(result!.code).toContain("computed");
  });

  it("should generate virtual code for defineProps", () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    });

    const content = fs.readFileSync(path.join(fixturesDir, "with-define-props.vue"), "utf-8");
    const result = vueFiles.getVirtualFile(
      path.join(fixturesDir, "with-define-props.vue"),
      content,
    );

    expect(result).toBeDefined();
    expect(result!.code).toContain("defineProps");
    expect(result!.code).toContain("Props");
  });
});

describe("script setup: ProgramProvider", () => {
  it("should include script setup .vue files in Program", () => {
    const provider = new ProgramProvider(ts);
    const program = provider.getProgram(fixturesDir);

    const vueFiles = program.getSourceFiles().filter((sf) => sf.fileName.endsWith(".vue"));
    expect(vueFiles.length).toBeGreaterThan(0);

    const setupFile = vueFiles.find((sf) => sf.fileName.includes("safe-setup.vue"));
    expect(setupFile).toBeDefined();
    expect(setupFile!.getText()).toContain("ref");
  });
});

describe("script setup: E2E ESLint", () => {
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
            "@typescript-eslint/no-unsafe-assignment": "error",
          },
        },
      ],
    });
  }

  it("should detect no-unsafe-assignment in <script setup>", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-setup.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors.length).toBeGreaterThan(0);
  });

  it("should NOT report errors on safe <script setup>", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "safe-setup.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });

  it("should NOT report errors on <script setup> with defineProps", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "with-define-props.vue")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });

  it("should NOT report errors when importing a script-setup component from .ts", async () => {
    const eslint = createESLint();
    const results = await eslint.lintFiles([path.join(fixturesDir, "import-setup-component.ts")]);

    expect(results).toHaveLength(1);
    const unsafeErrors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
    );
    expect(unsafeErrors).toHaveLength(0);
  });
});
