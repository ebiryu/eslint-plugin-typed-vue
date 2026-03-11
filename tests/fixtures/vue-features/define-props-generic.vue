<script setup lang="ts">
interface Props {
  items: string[];
  selected: string | null;
  callback: (item: string) => void;
}

const props = defineProps<Props>();

// Safe: accessing typed props
const first: string | undefined = props.items[0];
const sel: string | null = props.selected;
props.callback("test");
</script>

<template>
  <ul>
    <li v-for="item in items" :key="item">{{ item }}</li>
  </ul>
  <span v-if="selected">{{ selected }}</span>
</template>
