<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
const label: string = "hello";
</script>

<template>
  <div>{{ count }}</div>
  <span>{{ label }}</span>
</template>
