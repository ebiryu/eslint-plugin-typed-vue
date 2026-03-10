import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { VueVirtualFiles } from "../src/services/vue-virtual-files.js";
import { ProgramProvider } from "../src/services/program-provider.js";
import ts from "typescript";

const fixturesDir = path.resolve(__dirname, "fixtures/basic");

describe("VueVirtualFiles", () => {
  it("should generate virtual TypeScript code from a .vue file", () => {
    const vueFiles = new VueVirtualFiles(ts, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    });

    const content = fs.readFileSync(path.join(fixturesDir, "Component.vue"), "utf-8");

    const result = vueFiles.getVirtualFile(path.join(fixturesDir, "Component.vue"), content);

    expect(result).toBeDefined();
    expect(result!.code).toContain("ref");
    expect(result!.code).toContain("count");
    expect(result!.code).toContain("message");
    expect(result!.scriptKind).toBe(ts.ScriptKind.TS);
  });

  it("should cache virtual files", () => {
    const vueFiles = new VueVirtualFiles(ts, {});
    const content = '<script lang="ts">\nconst x = 1;\n</script>';

    const result1 = vueFiles.getVirtualFile("/test.vue", content);
    const result2 = vueFiles.getVirtualFile("/test.vue", content);

    expect(result1).toBe(result2);
  });

  it("should invalidate cache when content changes", () => {
    const vueFiles = new VueVirtualFiles(ts, {});

    const result1 = vueFiles.getVirtualFile(
      "/test.vue",
      '<script lang="ts">\nconst x = 1;\n</script>',
    );
    const result2 = vueFiles.getVirtualFile(
      "/test.vue",
      '<script lang="ts">\nconst y = 2;\n</script>',
    );

    expect(result1).not.toBe(result2);
    expect(result2!.code).toContain("y");
  });
});

describe("ProgramProvider", () => {
  it("should create a Program that includes .vue files", () => {
    const provider = new ProgramProvider(ts);
    const program = provider.getProgram(fixturesDir);

    expect(program).toBeDefined();

    // The program should have source files
    const sourceFiles = program.getSourceFiles();
    expect(sourceFiles.length).toBeGreaterThan(0);

    // Check that .vue files are included
    const vueSourceFiles = sourceFiles.filter((sf) => sf.fileName.endsWith(".vue"));
    expect(vueSourceFiles.length).toBeGreaterThan(0);
  });

  it("should resolve .vue imports with proper types", () => {
    const provider = new ProgramProvider(ts);
    const program = provider.getProgram(fixturesDir);
    const checker = program.getTypeChecker();

    // Find the Component.vue source file
    const componentFile = program
      .getSourceFiles()
      .find((sf) => sf.fileName.endsWith("Component.vue"));

    expect(componentFile).toBeDefined();

    // The file should have valid TypeScript AST (not just "export default {} as any")
    const text = componentFile!.getText();
    expect(text).toContain("ref");
    expect(text).not.toBe("export default {} as any;");
  });

  it("should cache the program across calls", () => {
    const provider = new ProgramProvider(ts);
    const program1 = provider.getProgram(fixturesDir);
    const program2 = provider.getProgram(fixturesDir);

    expect(program1).toBe(program2);
  });
});
