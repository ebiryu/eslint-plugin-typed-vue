<script setup lang="ts">
import { ref, computed } from "vue";

const count = ref(0);
const message: string = "hello";
const doubled = computed(() => count.value * 2);
</script>

<template>
  <div>{{ count }} {{ message }} {{ doubled }}</div>
</template>
