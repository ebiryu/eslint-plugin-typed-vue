import * as path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import type { Linter } from "eslint";
import { getProgramProvider } from "./services/program-provider.ts";
import { generatedToSource, type SourceMapping } from "./services/vue-virtual-files.ts";

/**
 * Load eslint-plugin-vue's postprocess for comment-directive support.
 * eslint-plugin-vue is a peer dependency expected in the user's project.
 */
let vuePluginPostprocess:
  | ((messages: Linter.LintMessage[][], filename: string) => Linter.LintMessage[])
  | undefined;
let vuePluginLoaded = false;

function getVuePluginPostprocess() {
  if (vuePluginLoaded) return vuePluginPostprocess;
  vuePluginLoaded = true;
  try {
    const esmRequire = createRequire(import.meta.url);
    const vuePlugin = esmRequire("eslint-plugin-vue");
    const proc = vuePlugin?.processors?.vue;
    if (proc?.postprocess) {
      vuePluginPostprocess = proc.postprocess;
    }
  } catch {
    // eslint-plugin-vue not available
  }
  return vuePluginPostprocess;
}

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
      ts.sys.fileExists(path.join(dir, "tsconfig.json")) ||
      ts.sys.fileExists(path.join(dir, "tsconfig.app.json"))
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

/**
 * Check if the given offset in .vue source text is inside an HTML tag name.
 * Tag names appear right after '<' or '</', e.g. `<OfflineIndicator` or `</div`.
 * Messages mapping to tag name positions come from @vue/language-core boilerplate
 * (e.g. bare `ComponentName;` statements for auto-imported components) and should
 * not be reported as lint errors.
 */
function isAtTagName(sourceText: string, offset: number): boolean {
  // Scan backwards from offset to find the nearest '<' that isn't inside a string or expression
  let i = offset - 1;
  while (i >= 0) {
    const ch = sourceText[i];
    if (ch === "<") return true;
    // If we hit '>' or a quote or a whitespace before '<', we're not in a tag name
    if (ch === ">" || ch === '"' || ch === "'" || ch === "`" || ch === "{" || ch === "}") {
      return false;
    }
    // '/' is ok (for </Component>), but other special chars mean we're not in a tag name
    if (
      ch !== "/" &&
      ch !== " " &&
      ch !== "\t" &&
      ch !== "\n" &&
      ch !== "\r" &&
      !isTagNameChar(ch)
    ) {
      return false;
    }
    // whitespace between '<' and the tag name is not valid HTML, so if we see
    // whitespace we should check if there's a '<' before it
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      return false;
    }
    i--;
  }
  return false;
}

function isTagNameChar(ch: string): boolean {
  return /[a-zA-Z0-9\-_.]/.test(ch);
}

/**
 * Check if the given line in generated code is @vue/language-core boilerplate
 * for event handler normalization. These lines contain `{} as any` and are not
 * user-written code, so lint errors from them should be suppressed.
 *
 * Pattern: `{ eventName: {} as any } as typeof __VLS_...`
 */
function isEventBoilerplateLine(generatedText: string, line: number): boolean {
  let currentLine = 1;
  let i = 0;
  while (i < generatedText.length && currentLine < line) {
    if (generatedText[i] === "\n") currentLine++;
    i++;
  }
  // Extract the line content
  let end = generatedText.indexOf("\n", i);
  if (end === -1) end = generatedText.length;
  const lineText = generatedText.slice(i, end);
  return lineText.includes("{} as any");
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
    // Delegate block 0 messages to eslint-plugin-vue's postprocess for
    // comment-directive support (<!-- eslint-disable --> etc.).
    const vuePostprocess = getVuePluginPostprocess();
    const vueMessages = vuePostprocess
      ? vuePostprocess([messages[0] ?? []], filename)
      : (messages[0] ?? []);
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

      // Skip messages that map back to HTML tag names in the template.
      // @vue/language-core generates bare identifier statements (e.g. `ComponentName;`)
      // for auto-imported components, which map to the tag name position in the template.
      // These are not user-written expressions and should not be linted.
      if (isAtTagName(fileData.sourceText, srcOffset)) continue;

      // Skip messages originating from @vue/language-core event handler boilerplate.
      // The generated code contains `{ eventName: {} as any } as typeof __VLS_...`
      // which triggers no-unsafe-assignment but is not user code.
      if (isEventBoilerplateLine(fileData.generatedText, msg.line)) continue;

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
