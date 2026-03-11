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

interface FlatMappingEntry {
  fromOffset: number;
  toOffset: number;
  fromLength: number;
  toLength: number;
}

function flattenMappings(
  mappings: SourceMapping[],
  direction: "generatedToSource" | "sourceToGenerated",
): FlatMappingEntry[] {
  const entries: FlatMappingEntry[] = [];
  for (const m of mappings) {
    for (let i = 0; i < m.sourceOffsets.length; i++) {
      if (direction === "generatedToSource") {
        entries.push({
          fromOffset: m.generatedOffsets[i],
          toOffset: m.sourceOffsets[i],
          fromLength: m.generatedLengths?.[i] ?? m.lengths[i],
          toLength: m.lengths[i],
        });
      } else {
        entries.push({
          fromOffset: m.sourceOffsets[i],
          toOffset: m.generatedOffsets[i],
          fromLength: m.lengths[i],
          toLength: m.generatedLengths?.[i] ?? m.lengths[i],
        });
      }
    }
  }
  entries.sort((a, b) => a.fromOffset - b.fromOffset);
  return entries;
}

function binarySearchMapping(entries: FlatMappingEntry[], offset: number): number | undefined {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const e = entries[mid];
    if (offset < e.fromOffset) {
      hi = mid - 1;
    } else if (offset >= e.fromOffset + e.fromLength) {
      lo = mid + 1;
    } else {
      const delta = offset - e.fromOffset;
      if (delta < e.toLength) {
        return e.toOffset + delta;
      }
      return undefined;
    }
  }
  return undefined;
}

const flatMappingCache = new WeakMap<
  SourceMapping[],
  { generatedToSource?: FlatMappingEntry[]; sourceToGenerated?: FlatMappingEntry[] }
>();

function getFlatMappings(
  mappings: SourceMapping[],
  direction: "generatedToSource" | "sourceToGenerated",
): FlatMappingEntry[] {
  let cached = flatMappingCache.get(mappings);
  if (!cached) {
    cached = {};
    flatMappingCache.set(mappings, cached);
  }
  if (!cached[direction]) {
    cached[direction] = flattenMappings(mappings, direction);
  }
  return cached[direction];
}

/**
 * Maps a generated offset in the virtual TS code back to a source offset in the .vue file.
 */
export function generatedToSource(
  mappings: SourceMapping[],
  generatedOffset: number,
): number | undefined {
  const entries = getFlatMappings(mappings, "generatedToSource");
  return binarySearchMapping(entries, generatedOffset);
}

/**
 * Maps a source offset in the .vue file to a generated offset in the virtual TS code.
 */
export function sourceToGenerated(
  mappings: SourceMapping[],
  sourceOffset: number,
): number | undefined {
  const entries = getFlatMappings(mappings, "sourceToGenerated");
  return binarySearchMapping(entries, sourceOffset);
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
