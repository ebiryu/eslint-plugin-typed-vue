<script lang="ts">
export interface Item {
  id: number;
  name: string;
}
</script>

<script setup lang="ts">
import { ref } from "vue";

const items = ref<Item[]>([]);
const addItem = (name: string) => {
  items.value.push({ id: items.value.length + 1, name });
};
</script>

<template>
  <div v-for="item in items" :key="item.id">{{ item.name }}</div>
</template>
