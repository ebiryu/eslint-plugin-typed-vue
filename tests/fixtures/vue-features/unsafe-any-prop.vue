<script setup lang="ts">
const props = defineProps<{
  data: any;
}>();

// Unsafe: accessing members on `any`
const value = props.data.nested.deep;
</script>

<template>
  <div>{{ data.something }}</div>
</template>
