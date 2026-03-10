<script setup lang="ts">
// This should trigger @typescript-eslint/no-unsafe-assignment
const x: string = {} as any;
</script>

<template>
  <div>{{ x }}</div>
</template>
