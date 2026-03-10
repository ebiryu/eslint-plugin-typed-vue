import * as path from "node:path";
import * as fs from "node:fs";
import type tsLib from "typescript";
import { VueVirtualFiles } from "./vue-virtual-files.js";

export class ProgramProvider {
  private program: tsLib.Program | undefined;
  private vueVirtualFiles: VueVirtualFiles | undefined;

  constructor(private tsModule: typeof tsLib) {}

  getProgram(tsconfigRootDir: string): tsLib.Program {
    if (this.program) {
      return this.program;
    }

    const tsconfigPath = this.findTsconfig(tsconfigRootDir);

    const configFile = this.tsModule.readConfigFile(tsconfigPath, (p: string) =>
      fs.readFileSync(p, "utf-8"),
    );
    const parsedConfig = this.tsModule.parseJsonConfigFileContent(
      configFile.config,
      this.tsModule.sys,
      path.dirname(tsconfigPath),
    );

    // Allow .vue extensions to be processed by TypeScript
    const compilerOptions: tsLib.CompilerOptions = {
      ...parsedConfig.options,
      allowNonTsExtensions: true,
    };

    this.vueVirtualFiles = new VueVirtualFiles(this.tsModule, compilerOptions);

    const vueFiles = this.collectVueFiles(parsedConfig.fileNames, path.dirname(tsconfigPath));
    const allFileNames = [...parsedConfig.fileNames, ...vueFiles];

    const host = this.createCompilerHost(compilerOptions);

    this.program = this.tsModule.createProgram({
      rootNames: allFileNames,
      options: compilerOptions,
      host,
    });

    return this.program;
  }

  /**
   * Create a program where the specified .vue file's source matches the given code
   * instead of Volar's virtual code. Uses the base program as oldProgram for
   * incremental compilation. This ensures @typescript-eslint/parser sees an AST
   * that matches what vue-eslint-parser expects.
   */
  getProgramForVueCode(
    tsconfigRootDir: string,
    vueFilePath: string,
    code: string,
  ): tsLib.Program {
    const baseProgram = this.getProgram(tsconfigRootDir);
    const options = baseProgram.getCompilerOptions();
    const baseHost = this.createCompilerHost(options);

    // Determine ScriptKind from the base program's source file (set by Volar)
    const baseSf = baseProgram.getSourceFile(vueFilePath);
    const scriptKind =
      (baseSf as { scriptKind?: number })?.scriptKind ?? this.tsModule.ScriptKind.TS;

    const host: tsLib.CompilerHost = {
      ...baseHost,
      getSourceFile: (fileName, languageVersionOrOptions, onError) => {
        if (fileName === vueFilePath) {
          const languageVersion =
            typeof languageVersionOrOptions === "number"
              ? languageVersionOrOptions
              : languageVersionOrOptions.languageVersion;
          return this.tsModule.createSourceFile(
            fileName,
            code,
            languageVersion,
            true,
            scriptKind,
          );
        }
        return baseHost.getSourceFile!(fileName, languageVersionOrOptions, onError);
      },
    };

    return this.tsModule.createProgram({
      rootNames: baseProgram.getRootFileNames(),
      options,
      host,
      oldProgram: baseProgram,
    });
  }

  getVueVirtualFiles(): VueVirtualFiles | undefined {
    return this.vueVirtualFiles;
  }

  reset() {
    this.program = undefined;
    this.vueVirtualFiles?.clearCache();
  }

  private findTsconfig(rootDir: string): string {
    const candidates = ["tsconfig.json", "tsconfig.app.json"];
    for (const name of candidates) {
      const p = path.resolve(rootDir, name);
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return path.resolve(rootDir, "tsconfig.json");
  }

  private collectVueFiles(tsFileNames: string[], rootDir: string): string[] {
    const vueFiles = new Set<string>();

    const dirs = new Set<string>();
    dirs.add(rootDir);
    for (const f of tsFileNames) {
      dirs.add(path.dirname(f));
    }

    for (const dir of dirs) {
      this.scanDirForVueFiles(dir, vueFiles);
    }

    const commonDirs = ["src", "components", "pages", "views", "layouts"];
    for (const d of commonDirs) {
      const dirPath = path.resolve(rootDir, d);
      if (fs.existsSync(dirPath)) {
        this.scanDirForVueFiles(dirPath, vueFiles);
      }
    }

    return [...vueFiles];
  }

  private scanDirForVueFiles(dir: string, result: Set<string>) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules") {
          this.scanDirForVueFiles(fullPath, result);
        } else if (entry.isFile() && entry.name.endsWith(".vue")) {
          result.add(fullPath);
        }
      }
    } catch {
      // ignore unreadable directories
    }
  }

  private createCompilerHost(options: tsLib.CompilerOptions): tsLib.CompilerHost {
    const defaultHost = this.tsModule.createCompilerHost(options);

    const host: tsLib.CompilerHost = {
      ...defaultHost,

      fileExists: (fileName) => {
        if (fileName.endsWith(".vue")) {
          return fs.existsSync(fileName);
        }
        return defaultHost.fileExists(fileName);
      },

      getSourceFile: (fileName, languageVersionOrOptions, onError) => {
        if (fileName.endsWith(".vue")) {
          return this.getVueSourceFile(fileName, languageVersionOrOptions);
        }
        return defaultHost.getSourceFile(fileName, languageVersionOrOptions, onError);
      },

      resolveModuleNames: (
        moduleNames,
        containingFile,
        _reusedNames,
        _redirectedReference,
        compilerOptions,
      ) => {
        return moduleNames.map((moduleName): tsLib.ResolvedModuleFull | undefined => {
          const result = this.tsModule.resolveModuleName(
            moduleName,
            containingFile,
            compilerOptions,
            defaultHost,
          );

          if (result.resolvedModule) {
            return result.resolvedModule;
          }

          if (moduleName.endsWith(".vue")) {
            const resolved = path.resolve(path.dirname(containingFile), moduleName);
            if (fs.existsSync(resolved)) {
              return {
                resolvedFileName: resolved,
                extension: ".ts" as tsLib.Extension,
                isExternalLibraryImport: false,
              };
            }
          }

          return undefined;
        });
      },
    };

    return host;
  }

  private getVueSourceFile(
    fileName: string,
    languageVersionOrOptions: tsLib.ScriptTarget | tsLib.CreateSourceFileOptions,
  ): tsLib.SourceFile | undefined {
    const languageVersion =
      typeof languageVersionOrOptions === "number"
        ? languageVersionOrOptions
        : languageVersionOrOptions.languageVersion;

    try {
      const content = fs.readFileSync(fileName, "utf-8");
      const virtualFile = this.vueVirtualFiles?.getVirtualFile(fileName, content);

      if (!virtualFile) {
        return this.tsModule.createSourceFile(
          fileName,
          "export default {} as any;",
          languageVersion,
          true,
          this.tsModule.ScriptKind.TS,
        );
      }

      return this.tsModule.createSourceFile(
        fileName,
        virtualFile.code,
        languageVersion,
        true,
        virtualFile.scriptKind,
      );
    } catch {
      return this.tsModule.createSourceFile(
        fileName,
        "export default {} as any;",
        languageVersion,
        true,
        this.tsModule.ScriptKind.TS,
      );
    }
  }
}

const providers = new Map<string, ProgramProvider>();

export function getProgramProvider(tsModule: typeof tsLib): ProgramProvider {
  const key = "__default__";
  let provider = providers.get(key);
  if (!provider) {
    provider = new ProgramProvider(tsModule);
    providers.set(key, provider);
  }
  return provider;
}
