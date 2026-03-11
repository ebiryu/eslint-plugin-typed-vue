<script setup lang="ts">
const emit = defineEmits<{
  change: [value: string];
  update: [id: number, name: string];
}>();

// Safe: matches emit signature
emit("change", "hello");
emit("update", 1, "test");
</script>

<template>
  <button @click="emit('change', 'clicked')">Click</button>
</template>
