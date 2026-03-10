import * as path from "node:path";
import * as fs from "node:fs";
import ts from "typescript";
import type { Linter } from "eslint";
import { getProgramProvider } from "./services/program-provider.js";
import { generatedToSource, type SourceMapping } from "./services/vue-virtual-files.js";

interface ProcessorFileData {
  sourceText: string;
  generatedText: string;
  mappings: SourceMapping[];
  templateRange: [number, number] | null;
}

const fileDataStore = new Map<string, ProcessorFileData>();

function findTsconfigDir(filePath: string): string {
  let dir = path.dirname(filePath);
  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "tsconfig.json")) ||
      fs.existsSync(path.join(dir, "tsconfig.app.json"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function getTemplateRange(text: string): [number, number] | null {
  const startMatch = text.match(/<template[^>]*>/);
  if (!startMatch || startMatch.index === undefined) return null;
  const start = startMatch.index + startMatch[0].length;
  const endIdx = text.lastIndexOf("</template>");
  if (endIdx === -1) return null;
  return [start, endIdx];
}

function lineColToOffset(text: string, line: number, column: number): number {
  let currentLine = 1;
  let offset = 0;
  while (offset < text.length && currentLine < line) {
    if (text[offset] === "\n") currentLine++;
    offset++;
  }
  return offset + column;
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, column: col };
}

export const processor: Linter.Processor = {
  preprocess(text: string, filename: string) {
    if (!filename.endsWith(".vue")) {
      return [{ text, filename: "0.vue" }];
    }

    try {
      const tsconfigDir = findTsconfigDir(filename);
      const provider = getProgramProvider(ts);
      const vueVirtualFiles = provider.getOrCreateVueVirtualFiles(tsconfigDir);
      const vFileInfo = vueVirtualFiles.getVirtualFile(filename, text);

      if (!vFileInfo) {
        return [{ text, filename: "0.vue" }];
      }

      fileDataStore.set(filename, {
        sourceText: text,
        generatedText: vFileInfo.code,
        mappings: vFileInfo.mappings,
        templateRange: getTemplateRange(text),
      });

      return [
        { text, filename: "0.vue" },
        { text: vFileInfo.code, filename: "1.ts" },
      ];
    } catch {
      return [{ text, filename: "0.vue" }];
    }
  },

  postprocess(messages: Linter.LintMessage[][], filename: string) {
    const vueMessages = messages[0] ?? [];
    const tsMessages = messages[1];

    if (!tsMessages || tsMessages.length === 0) {
      fileDataStore.delete(filename);
      return vueMessages;
    }

    const fileData = fileDataStore.get(filename);
    fileDataStore.delete(filename);

    if (!fileData) return vueMessages;

    const remappedMessages: Linter.LintMessage[] = [];

    for (const msg of tsMessages) {
      // Convert ESLint 1-based line/column to offset in generated code
      const genOffset = lineColToOffset(fileData.generatedText, msg.line, msg.column - 1);

      // Reverse-map: generated offset → source offset
      const srcOffset = generatedToSource(fileData.mappings, genOffset);
      if (srcOffset === undefined) continue;

      // Only keep errors in the template region
      if (fileData.templateRange) {
        const [tStart, tEnd] = fileData.templateRange;
        if (srcOffset < tStart || srcOffset >= tEnd) continue;
      }

      // Convert source offset to line/column
      const { line, column } = offsetToLineCol(fileData.sourceText, srcOffset);

      // Remap endLine/endColumn if present
      let endLine = msg.endLine;
      let endColumn = msg.endColumn;
      if (msg.endLine !== undefined && msg.endColumn !== undefined) {
        const genEndOffset = lineColToOffset(
          fileData.generatedText,
          msg.endLine,
          msg.endColumn - 1,
        );
        const srcEndOffset = generatedToSource(fileData.mappings, genEndOffset);
        if (srcEndOffset !== undefined) {
          const end = offsetToLineCol(fileData.sourceText, srcEndOffset);
          endLine = end.line;
          endColumn = end.column + 1;
        }
      }

      remappedMessages.push({
        ...msg,
        line,
        column: column + 1, // ESLint uses 1-based columns
        endLine,
        endColumn,
      });
    }

    return [...vueMessages, ...remappedMessages];
  },

  supportsAutofix: false,
};
