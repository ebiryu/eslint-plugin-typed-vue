# eslint-plugin-typed-vue

ESLint plugin that enables typescript-eslint's type-aware rules for Vue SFC files.

## Problem

typescript-eslint's type-aware rules (e.g., `@typescript-eslint/no-unsafe-assignment`) don't work correctly with Vue SFCs because TypeScript cannot parse `.vue` files natively. This causes `import Foo from './Foo.vue'` to resolve as `any`, triggering false positives from `no-unsafe-*` rules.

## How It Works

This plugin uses [`@vue/language-core`](https://github.com/vuejs/language-tools) to generate virtual TypeScript code from `.vue` files and builds a `ts.Program` that understands `.vue` imports. It then injects this Program into `@typescript-eslint/parser` so type-aware rules work correctly.

Additionally, it provides an ESLint Processor that extracts the generated TypeScript code from `.vue` files, enabling typescript-eslint rules to run against template expressions with accurate source position remapping.

```
.vue file
    ↓
vue-eslint-parser (AST generation)
    ↓
enhanced-parser (@vue/language-core virtual TS → ts.Program)
    ↓
typescript-eslint type-aware rules work correctly
```

## Requirements

- ESLint >= 9.0.0 (Flat Config)
- TypeScript >= 5.0.0
- vue-eslint-parser >= 9.0.0
- @typescript-eslint/parser >= 8.0.0
- eslint-plugin-vue >= 10.0.0

## Installation

```bash
npm install -D eslint-plugin-typed-vue
```

Peer dependencies:

```bash
npm install -D eslint typescript vue-eslint-parser @typescript-eslint/parser eslint-plugin-vue
```

## Usage

```js
// eslint.config.js
import typedVue from "eslint-plugin-typed-vue";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommendedTypeChecked,
  ...typedVue.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

The `recommended` config sets up:

- **Plugin registration**: Registers `typed-vue` plugin globally so custom rules are available
- **`**/\*.vue`**: `vue-eslint-parser`with`enhanced-parser` as the inner parser, plus the Processor for template type checking
- **`**/_.ts`, `\*\*/_.tsx`, etc.**: `enhanced-parser`for type-aware linting with`.vue` import support

## Supported Vue SFC Patterns

| Pattern                                     | Support |
| ------------------------------------------- | ------- |
| `<script lang="ts">`                        | Yes     |
| `<script setup lang="ts">`                  | Yes     |
| `<script lang="tsx">`                       | Yes     |
| `<script>` + `<script setup>` (dual script) | Yes     |
| Cross-component type imports                | Yes     |
| `defineProps` / `defineEmits` / generics    | Yes     |
| Template expressions (via Processor)        | Yes     |

## Custom Rules

### `typed-vue/strict-boolean-expressions`

Requires boolean expressions in `v-if`, `v-else-if`, and `v-show` directives. Vue `Ref`, `ComputedRef`, and `ShallowRef` types are automatically unwrapped (e.g., `Ref<boolean>` is treated as `boolean`).

```vue
<template>
  <!-- Error: Unexpected non-boolean type 'number' -->
  <div v-if="count">...</div>

  <!-- OK -->
  <div v-if="count > 0">...</div>
  <div v-if="isVisible">...</div>
</template>
```

### `typed-vue/no-unsafe-template-expression`

Disallows expressions with `any` type in template interpolations (`{{ }}`) and `v-bind` directives. vue-tsc does not catch these because the generated code accesses the expression without a type constraint.

```vue
<template>
  <!-- Error: Unsafe use of `any` in interpolation -->
  <div>{{ unsafeData }}</div>

  <!-- Error: Unsafe use of `any` in v-bind -->
  <input :value="unsafeData" />

  <!-- OK -->
  <div>{{ typedData }}</div>
</template>
```

### `typed-vue/no-unsafe-event-handler`

Disallows expressions with `any` type in event handler directives (`@click`, `v-on:click`, etc.). vue-tsc does not catch these because `any` is assignable to any handler type.

```vue
<template>
  <!-- Error: Unsafe use of `any` as event handler -->
  <button @click="unsafeHandler">Click</button>

  <!-- OK -->
  <button @click="typedHandler">Click</button>
</template>
```

## API

### `resetCache()`

Resets all internal caches (Program, VueVirtualFiles, tsconfig). Call this when the file system has changed between lint runs (e.g., in watch mode or benchmarks).

```ts
import { resetCache } from "eslint-plugin-typed-vue";

resetCache();
```

## Known Limitations

### Performance scales with file count

The plugin uses `ts.createProgram` with incremental compilation (`oldProgram`). Each `.vue` file requires a per-file Program rebuild because the source code provided by `vue-eslint-parser` may differ from the on-disk content. This results in approximately O(N) scaling per file as the number of files grows. For very large projects (100+ Vue files), lint times may become noticeable.

### No autofix support in Processor

The ESLint Processor's `supportsAutofix` is set to `false`. Errors detected in template expressions via the Processor cannot be auto-fixed because the source mapping between generated TypeScript code and the original `.vue` template is not bidirectional for fix ranges.

### `@vue/language-core` version coupling

The plugin depends on `@vue/language-core` v3.x. Changes to the virtual file format in this package may require updates to this plugin.

### Template-only errors from Processor

The Processor filters typescript-eslint errors to the `<template>` region only. Errors in `<script>` blocks are handled by the standard parser path (block 0) and are not duplicated.

### `projectService` is not supported

This plugin uses `parserOptions.programs` to inject a custom TypeScript Program that understands `.vue` files via `@vue/language-core`. This is incompatible with typescript-eslint's `projectService` option, which uses TypeScript's native Project Service APIs.

If your ESLint config has `projectService: true`, this plugin will override it for `.vue` and `.ts` files. This is intentional — `projectService` cannot perform the `.vue` virtual file transformation that this plugin provides.

The `programs` option is [not deprecated](https://typescript-eslint.io/blog/project-service/) and will remain available until `projectService` can fully replace it.

### `tsconfig.json` must include `.vue` files

Your `tsconfig.json` (or `tsconfig.app.json`) must be configured to include `.vue` files. Typically this is done via `vue-tsc` or by adding `"include": ["src/**/*.vue", "src/**/*.ts"]`.

## License

MIT
