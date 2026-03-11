import ts from "typescript";
import * as tsParser from "@typescript-eslint/parser";
import { getProgramProvider } from "../services/program-provider.ts";
import {
  TemplateTypeResolver,
  setTemplateTypeResolver,
} from "../services/template-type-resolver.ts";

/**
 * Detect template expression fragments from vue-eslint-parser.
 * vue-eslint-parser wraps template expressions (e.g. `{{ count }}`) as `0( count )`
 * before passing them to the inner parser. These should NOT receive a Program
 * because they are not part of any source file in the Program.
 */
function isTemplateExpression(code: string): boolean {
  return /^\d+\(/.test(code.trimStart());
}

/**
 * Detect processor virtual file paths like `/path/to/file.vue/1_1.ts` or `/path/to/file.vue/0_0.vue`.
 * ESLint constructs these as `{physical_path}/{index}_{returned_filename}`.
 * Returns the real .vue file path and the block type, or undefined if not a processor virtual file.
 */
function parseProcessorPath(filePath: string): { vuePath: string; isTs: boolean } | undefined {
  const match = filePath.match(/^(.+\.vue)\/\d+_?\d*\.(ts|vue)$/);
  if (!match) return undefined;
  return { vuePath: match[1], isTs: match[2] === "ts" };
}

export const parseForESLint = (code: string, options: Record<string, unknown>): unknown => {
  const tsconfigRootDir = (options.tsconfigRootDir as string) || process.cwd();
  const filePath = options.filePath as string | undefined;

  const enhancedOptions = { ...options };

  // Handle processor virtual files (e.g., file.vue/1_1.ts or file.vue/0_0.vue)
  const processorInfo = filePath ? parseProcessorPath(filePath) : undefined;
  if (processorInfo) {
    try {
      const provider = getProgramProvider(ts);

      if (processorInfo.isTs) {
        // Block 1 (.ts): @vue/language-core generated code. Use base program with filePath override.
        const program = provider.getProgram(tsconfigRootDir);
        enhancedOptions.programs = [program];
        enhancedOptions.filePath = processorInfo.vuePath;
        delete enhancedOptions.project;
        delete enhancedOptions.projectService;
      } else {
        // Block 0 (.vue): Original .vue code. Use per-call program with real path.
        if (!isTemplateExpression(code)) {
          const program = provider.getProgramForVueCode(
            tsconfigRootDir,
            processorInfo.vuePath,
            code,
          );
          const resolver = new TemplateTypeResolver(ts, provider, tsconfigRootDir);
          setTemplateTypeResolver(processorInfo.vuePath, resolver);

          enhancedOptions.programs = [program];
          enhancedOptions.filePath = processorInfo.vuePath;
          delete enhancedOptions.project;
          delete enhancedOptions.projectService;
        }
      }
    } catch (e) {
      console.warn("[eslint-plugin-typed-vue] Failed to create typed program for processor:", e);
    }

    try {
      return tsParser.parseForESLint(code, enhancedOptions);
    } catch {
      delete enhancedOptions.programs;
      enhancedOptions.filePath = filePath;
      return tsParser.parseForESLint(code, enhancedOptions);
    }
  }

  const isVueFile = filePath?.endsWith(".vue");
  const isTsFile = filePath != null && /\.[cm]?tsx?$/.test(filePath);

  if (isVueFile && !isTemplateExpression(code)) {
    // For .vue files, @typescript-eslint/parser's `programs` option uses the
    // Program's source file AST directly (@vue/language-core's virtual code), not the provided code.
    // This causes AST mismatches with vue-eslint-parser. To fix this, we create a
    // per-call program where the .vue source file matches the code that
    // vue-eslint-parser provides, using oldProgram for incremental compilation.
    try {
      const provider = getProgramProvider(ts);
      const program = provider.getProgramForVueCode(tsconfigRootDir, filePath!, code);

      // Initialize TemplateTypeResolver for this file so custom rules
      // can access type info for template expressions via @vue/language-core mappings.
      const resolver = new TemplateTypeResolver(ts, provider, tsconfigRootDir);
      setTemplateTypeResolver(filePath!, resolver);

      enhancedOptions.programs = [program];
      delete enhancedOptions.project;
      delete enhancedOptions.projectService;
    } catch (e) {
      console.warn("[eslint-plugin-typed-vue] Failed to create typed program:", e);
    }
  } else if (isTsFile) {
    try {
      const provider = getProgramProvider(ts);
      const program = provider.getProgram(tsconfigRootDir);

      enhancedOptions.programs = [program];
      delete enhancedOptions.project;
      delete enhancedOptions.projectService;
    } catch (e) {
      console.warn("[eslint-plugin-typed-vue] Failed to create typed program:", e);
    }
  }

  try {
    return tsParser.parseForESLint(code, enhancedOptions);
  } catch (e) {
    // If parsing with Program fails, retry without it
    if (enhancedOptions.programs) {
      delete enhancedOptions.programs;
      return tsParser.parseForESLint(code, enhancedOptions);
    }
    throw e;
  }
};

export const meta = {
  name: "eslint-plugin-typed-vue/parser",
  version: "0.1.0",
};
