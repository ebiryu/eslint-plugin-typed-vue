<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
}

const props = defineProps<Props>();
const greeting = `Hello, ${props.title}`;
</script>

<template>
  <div>{{ greeting }} {{ props.count }}</div>
</template>
