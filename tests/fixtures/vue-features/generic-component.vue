<script setup lang="ts" generic="T extends { id: number }">
import { computed } from 'vue';

const props = defineProps<{
  items: T[];
  selected: T | null;
}>();

const selectedId = computed((): number | null => {
  return props.selected?.id ?? null;
});

const ids: number[] = props.items.map((item) => item.id);
</script>

<template>
  <div>
    <span v-for="item in items" :key="item.id">{{ item.id }}</span>
    <p v-if="selected">Selected: {{ selected.id }}</p>
  </div>
</template>
