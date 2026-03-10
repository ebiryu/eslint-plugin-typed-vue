import type ts from "typescript";
import {
  type VueVirtualCode,
  getDefaultCompilerOptions,
  createVueLanguagePlugin,
} from "@vue/language-core";
import type { VirtualCode } from "@volar/language-core";

interface VueLanguagePluginWithTs {
  getLanguageId(scriptId: string): string | undefined;
  createVirtualCode?(
    scriptId: string,
    languageId: string,
    snapshot: ts.IScriptSnapshot,
    ctx: { getAssociatedScript: (id: string) => unknown },
  ): VueVirtualCode | undefined;
  typescript?: {
    extraFileExtensions: { extension: string }[];
    getServiceScript(code: VueVirtualCode):
      | {
          code: VirtualCode;
          scriptKind: number;
        }
      | undefined;
  };
}

export interface SourceMapping {
  sourceOffsets: number[];
  generatedOffsets: number[];
  lengths: number[];
  generatedLengths?: number[];
}

export interface VirtualFileInfo {
  code: string;
  virtualCode: VueVirtualCode;
  scriptKind: number;
  snapshot: ts.IScriptSnapshot;
  /** Mappings from .vue source positions to generated TS positions */
  mappings: SourceMapping[];
}

/**
 * Maps a generated offset in the Volar virtual TS code back to a source offset in the .vue file.
 */
export function generatedToSource(
  mappings: SourceMapping[],
  generatedOffset: number,
): number | undefined {
  for (const m of mappings) {
    for (let i = 0; i < m.generatedOffsets.length; i++) {
      const gOff = m.generatedOffsets[i];
      const sOff = m.sourceOffsets[i];
      const gLen = m.generatedLengths?.[i] ?? m.lengths[i];
      if (generatedOffset >= gOff && generatedOffset < gOff + gLen) {
        const delta = generatedOffset - gOff;
        if (delta < m.lengths[i]) {
          return sOff + delta;
        }
      }
    }
  }
  return undefined;
}

export class VueVirtualFiles {
  private cache = new Map<string, VirtualFileInfo>();
  private languagePlugin: VueLanguagePluginWithTs;

  constructor(
    private tsModule: typeof ts,
    compilerOptions: ts.CompilerOptions,
  ) {
    const vueCompilerOptions = getDefaultCompilerOptions();
    this.languagePlugin = createVueLanguagePlugin(
      this.tsModule,
      compilerOptions,
      vueCompilerOptions,
      (id: string) => id,
    );
  }

  getVirtualFile(fileName: string, content: string): VirtualFileInfo | undefined {
    const cached = this.cache.get(fileName);
    if (cached) {
      const cachedText = cached.virtualCode.initSnapshot.getText(
        0,
        cached.virtualCode.initSnapshot.getLength(),
      );
      if (cachedText === content) {
        return cached;
      }
    }

    const snapshot: ts.IScriptSnapshot = {
      getText: (start, end) => content.slice(start, end),
      getLength: () => content.length,
      getChangeRange: () => undefined,
    };

    const virtualCode = this.languagePlugin.createVirtualCode?.(fileName, "vue", snapshot, {
      getAssociatedScript: () => undefined,
    });

    if (!virtualCode) {
      return undefined;
    }

    const serviceScript = this.languagePlugin.typescript?.getServiceScript(virtualCode);
    if (!serviceScript) {
      return undefined;
    }

    const generatedCode = serviceScript.code.snapshot.getText(
      0,
      serviceScript.code.snapshot.getLength(),
    );

    const info: VirtualFileInfo = {
      code: generatedCode,
      virtualCode,
      scriptKind: serviceScript.scriptKind,
      snapshot: serviceScript.code.snapshot,
      mappings: (serviceScript.code.mappings ?? []) as SourceMapping[],
    };

    this.cache.set(fileName, info);
    return info;
  }

  clearCache(fileName?: string) {
    if (fileName) {
      this.cache.delete(fileName);
    } else {
      this.cache.clear();
    }
  }
}
