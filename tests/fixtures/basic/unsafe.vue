<script lang="ts">
// This should trigger @typescript-eslint/no-unsafe-assignment
const x: string = {} as any;

export default {
  setup() {
    return { x };
  },
};
</script>

<template>
  <div>{{ x }}</div>
</template>
