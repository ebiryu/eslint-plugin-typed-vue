import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import ts from "typescript";
import { ESLint } from "eslint";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.js";
import { processor } from "../src/processor.js";
import * as enhancedParser from "../src/parser/enhanced-parser.js";

const fixturesDir = path.resolve(__dirname, "fixtures/processor");

describe("processor: preprocess", () => {
  it("should return two blocks for .vue files", () => {
    const content = fs.readFileSync(path.join(fixturesDir, "safe-template.vue"), "utf-8");
    const blocks = processor.preprocess!(content, path.join(fixturesDir, "safe-template.vue"));

    expect(blocks.length).toBe(2);

    const block0 = blocks[0] as { text: string; filename: string };
    expect(block0.filename).toBe("0.vue");
    expect(block0.text).toBe(content);

    const block1 = blocks[1] as { text: string; filename: string };
    expect(block1.filename).toBe("1.ts");
    expect(block1.text.length).toBeGreaterThan(0);
    // Should contain Volar-generated code with __VLS_ctx
    expect(block1.text).toContain("__VLS_ctx");
  });

  it("should return single block for non-.vue files", () => {
    const blocks = processor.preprocess!("const x = 1;", "file.ts");
    expect(blocks.length).toBe(1);
  });
});

describe("processor: postprocess remapping", () => {
  it("should remap generated positions back to .vue source positions", () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    });

    const filePath = path.join(fixturesDir, "safe-template.vue");
    const content = fs.readFileSync(filePath, "utf-8");

    // Trigger preprocess to store file data
    processor.preprocess!(content, filePath);

    // Simulate a message from the TS block at a template position
    const vFileInfo = vueFiles.getVirtualFile(filePath, content);
    expect(vFileInfo).toBeDefined();

    // Find __VLS_ctx.name in the generated code
    const nameIdx = vFileInfo!.code.indexOf("__VLS_ctx.name");
    expect(nameIdx).toBeGreaterThan(0);

    // The "name" part starts after "__VLS_ctx."
    const namePartIdx = nameIdx + "__VLS_ctx.".length;

    // Convert to line/column for the fake message
    let line = 1;
    let col = 0;
    for (let i = 0; i < namePartIdx; i++) {
      if (vFileInfo!.code[i] === "\n") {
        line++;
        col = 0;
      } else {
        col++;
      }
    }

    const fakeMessages = [
      [], // block 0 (vue)
      [
        {
          ruleId: "test-rule",
          severity: 2 as const,
          message: "Test error",
          line,
          column: col + 1, // ESLint 1-based
        },
      ],
    ];

    const result = processor.postprocess!(fakeMessages, filePath);

    // Should contain the remapped message
    const templateMessages = result.filter((m) => m.ruleId === "test-rule");
    expect(templateMessages.length).toBe(1);

    // The remapped position should be in the template section
    const msg = templateMessages[0];
    expect(msg.line).toBeGreaterThanOrEqual(7); // template starts after script
  });
});

describe("processor: E2E with ESLint", () => {
  function createESLint(rules: Record<string, unknown>) {
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
          rules,
        },
        {
          // Config for the processor's virtual .ts block (file.vue/1.ts)
          files: ["**/*.ts"],
          languageOptions: {
            parser: enhancedParser,
            parserOptions: {
              tsconfigRootDir: fixturesDir,
            },
          },
          plugins: { "@typescript-eslint": tsPlugin },
          rules,
        },
      ],
    });
  }

  it(
    "should detect no-unsafe-member-access in template via processor",
    { timeout: 15000 },
    async () => {
      const eslint = createESLint({
        "@typescript-eslint/no-unsafe-member-access": "error",
      });

      const results = await eslint.lintFiles([path.join(fixturesDir, "unsafe-template.vue")]);

      expect(results).toHaveLength(1);
      const errors = results[0].messages.filter(
        (m) => m.ruleId === "@typescript-eslint/no-unsafe-member-access",
      );

      // Should detect unsafe member access on `data.name` in template
      expect(errors.length).toBeGreaterThan(0);

      // Error should be in the template section (line 7+)
      for (const err of errors) {
        expect(err.line).toBeGreaterThanOrEqual(7);
      }
    },
  );

  it(
    "should suppress no-unsafe-assignment from event handler boilerplate",
    { timeout: 15000 },
    async () => {
      const eslint = createESLint({
        "@typescript-eslint/no-unsafe-assignment": "error",
      });

      const results = await eslint.lintFiles([path.join(fixturesDir, "event-handler.vue")]);

      expect(results).toHaveLength(1);
      const errors = results[0].messages.filter(
        (m) => m.ruleId === "@typescript-eslint/no-unsafe-assignment",
      );

      // event-handler.vue has @click and @change event handlers.
      // @vue/language-core generates `{ eventName: {} as any }` boilerplate
      // which should be suppressed by isEventBoilerplateLine.
      // All types in this fixture are safe, so there should be zero errors.
      expect(errors).toHaveLength(0);
    },
  );

  it("should NOT report errors on safe template expressions", { timeout: 15000 }, async () => {
    const eslint = createESLint({
      "@typescript-eslint/no-unsafe-member-access": "error",
    });

    const results = await eslint.lintFiles([path.join(fixturesDir, "safe-template.vue")]);

    expect(results).toHaveLength(1);
    const errors = results[0].messages.filter(
      (m) => m.ruleId === "@typescript-eslint/no-unsafe-member-access",
    );
    expect(errors).toHaveLength(0);
  });
});
