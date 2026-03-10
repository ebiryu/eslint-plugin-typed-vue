<script lang="ts">
export interface Item {
  id: number;
  name: string;
}
</script>

<script setup lang="ts">
// This should trigger @typescript-eslint/no-unsafe-assignment
const x: Item = {} as any;
</script>

<template>
  <div>{{ x }}</div>
</template>
