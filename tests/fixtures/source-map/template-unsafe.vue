<script setup lang="ts">
const safe: string = "hello";
const unsafe: string = {} as any;
</script>

<template>
  <div>{{ safe }}</div>
  <div :class="unsafe">test</div>
</template>
