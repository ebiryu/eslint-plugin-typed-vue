<script setup lang="ts">
const isVisible = true;
const count = 42;
const name = "hello";
const items: string[] = [];
</script>

<template>
  <div v-if="isVisible">boolean - OK</div>
  <div v-if="count">number - NOT OK</div>
  <div v-if="name">string - NOT OK</div>
  <div v-if="items.length > 0">comparison - OK</div>
  <div v-show="isVisible">v-show boolean - OK</div>
  <div v-show="count">v-show number - NOT OK</div>
</template>
