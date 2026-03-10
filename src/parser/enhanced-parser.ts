import ts from "typescript";
import * as tsParser from "@typescript-eslint/parser";
import { getProgramProvider } from "../services/program-provider.js";

/**
 * Detect template expression fragments from vue-eslint-parser.
 * vue-eslint-parser wraps template expressions (e.g. `{{ count }}`) as `0( count )`
 * before passing them to the inner parser. These should NOT receive a Program
 * because they are not part of any source file in the Program.
 */
function isTemplateExpression(code: string): boolean {
  return /^\d+\(/.test(code.trimStart());
}

export const parseForESLint = (code: string, options: Record<string, unknown>): unknown => {
  const tsconfigRootDir = (options.tsconfigRootDir as string) || process.cwd();
  const filePath = options.filePath as string | undefined;

  const enhancedOptions = { ...options };

  const isVueFile = filePath?.endsWith(".vue");
  const isTsFile = filePath != null && /\.[cm]?tsx?$/.test(filePath);
  const shouldInjectProgram = (isVueFile && !isTemplateExpression(code)) || isTsFile;

  if (shouldInjectProgram) {
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
