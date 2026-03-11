<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const count = ref(0);
const name = ref<string | null>(null);
const items = ref<{ id: number; label: string }[]>([]);

// Computed with explicit return type
const doubled = computed((): number => count.value * 2);

// Computed with inferred type
const hasItems = computed(() => items.value.length > 0);

// Conditional type narrowing
const displayName = computed(() => {
  if (name.value !== null) {
    return name.value.toUpperCase();
  }
  return "Anonymous";
});

// Watch with typed callback
watch(count, (newVal: number, oldVal: number) => {
  console.log(newVal, oldVal);
});
</script>

<template>
  <div>
    <span>{{ doubled }}</span>
    <span>{{ displayName }}</span>
    <ul v-if="hasItems">
      <li v-for="item in items" :key="item.id">{{ item.label }}</li>
    </ul>
  </div>
</template>
