/**
 * Benchmark: measures lint time for N .vue files with typed rules.
 * Usage: pnpm bench [count]
 * Requires: pnpm build (uses dist/)
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, "fixtures");

function generateFixtures(count: number) {
  if (fs.existsSync(fixturesDir)) {
    fs.rmSync(fixturesDir, { recursive: true });
  }
  fs.mkdirSync(fixturesDir, { recursive: true });

  fs.writeFileSync(
    path.join(fixturesDir, "types.ts"),
    `export interface Item { id: number; name: string; active: boolean; }
export interface User { id: number; email: string; role: "admin" | "user"; }
export type Status = "pending" | "done" | "error";
`,
  );

  for (let i = 0; i < count; i++) {
    const hasUnsafe = i % 5 === 0;
    const useSetup = i % 2 === 0;

    const scriptContent = hasUnsafe
      ? `
import type { Item, User, Status } from './types';
import { ref, computed } from 'vue';

const data: any = {};
const items = ref<Item[]>([]);
const user = ref<User | null>(null);
const status = ref<Status>("pending");
const unsafeValue = data.nested.value;
const name = computed(() => user.value?.email ?? "unknown");
`
      : `
import type { Item, User, Status } from './types';
import { ref, computed } from 'vue';

const items = ref<Item[]>([]);
const user = ref<User | null>(null);
const status = ref<Status>("pending");
const isActive = computed(() => items.value.some(item => item.active));
const name = computed(() => user.value?.email ?? "unknown");
`;

    const templateContent = hasUnsafe
      ? `
  <div>
    <h1>Component ${i}</h1>
    <ul><li v-for="item in items" :key="item.id">{{ item.name }}</li></ul>
    <p v-if="user">{{ user.email }}</p>
    <span>{{ data.something }}</span>
  </div>
`
      : `
  <div>
    <h1>Component ${i}</h1>
    <ul><li v-for="item in items" :key="item.id">{{ item.name }}</li></ul>
    <p v-if="user">{{ user.email }}</p>
    <span>{{ status }}</span>
  </div>
`;

    const tag = useSetup ? '<script setup lang="ts">' : '<script lang="ts">';
    let script: string;
    if (useSetup) {
      script = `${tag}${scriptContent}</script>`;
    } else {
      script = `${tag}
import type { Item, User, Status } from './types';
import { defineComponent, ref, computed } from 'vue';

export default defineComponent({
  setup() {
    const items = ref<Item[]>([]);
    const user = ref<User | null>(null);
    const status = ref<Status>("pending");${hasUnsafe ? "\n    const data: any = {};\n    const unsafeValue = data.nested.value;" : ""}
    const name = computed(() => user.value?.email ?? "unknown");
    return { items, user, status${hasUnsafe ? ", data" : ""}, name };
  },
});
</script>`;
    }

    fs.writeFileSync(
      path.join(fixturesDir, `Comp${i}.vue`),
      `${script}\n\n<template>${templateContent}</template>\n`,
    );
  }

  fs.writeFileSync(
    path.join(fixturesDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          strict: true,
          jsx: "preserve",
          skipLibCheck: true,
        },
        include: ["*.ts", "*.vue"],
      },
      null,
      2,
    ),
  );
}

const pluginModule = await import("../dist/index.js");
const plugin = pluginModule.default;
const resetCache = pluginModule.resetCache;
const tsPlugin = (await import("@typescript-eslint/eslint-plugin")).default;

function createESLint() {
  return new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      ...plugin.configs.recommended,
      {
        files: ["**/*.vue", "**/*.ts"],
        languageOptions: {
          parserOptions: {
            tsconfigRootDir: fixturesDir,
          },
        },
        plugins: { "@typescript-eslint": tsPlugin },
        rules: {
          "@typescript-eslint/no-unsafe-assignment": "error",
          "@typescript-eslint/no-unsafe-member-access": "error",
        },
      },
    ],
  });
}

async function runBenchmark(count: number) {
  resetCache();
  generateFixtures(count);

  const eslint = createESLint();
  const files = Array.from({ length: count }, (_, i) => path.join(fixturesDir, `Comp${i}.vue`));

  const start = performance.now();
  const results = await eslint.lintFiles(files);
  const totalMs = performance.now() - start;

  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);
  const filesWithErrors = results.filter((r) => r.errorCount > 0).length;

  console.log(
    `  [${String(count).padStart(3)} files]  ${String(totalMs.toFixed(0)).padStart(6)}ms total  ${(totalMs / count).toFixed(1).padStart(6)}ms/file  ${((count / totalMs) * 1000).toFixed(1).padStart(5)} files/sec  ${totalErrors} errors in ${filesWithErrors} files`,
  );
}

const counts = process.argv[2] ? [parseInt(process.argv[2], 10)] : [10, 50, 100];

console.log("\n=== eslint-plugin-typed-vue benchmark ===\n");

for (const count of counts) {
  await runBenchmark(count);
}

if (fs.existsSync(fixturesDir)) {
  fs.rmSync(fixturesDir, { recursive: true });
}

console.log("\nDone.");
