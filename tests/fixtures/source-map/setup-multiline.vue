<script setup lang="ts">
import { ref } from "vue";

const safe1 = ref(0);
const safe2: string = "hello";
const unsafe1: string = {} as any;
const safe3: boolean = true;
const unsafe2: number = {} as any;
</script>

<template>
  <div>{{ safe1 }}</div>
</template>
