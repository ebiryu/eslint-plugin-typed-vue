<script setup lang="ts">
const isVisible = true;
const count = 42;
const name = "hello";
</script>

<template>
  <div v-if="isVisible">boolean - OK</div>
  <div v-if="count">number - NOT OK</div>
  <div v-if="name">string - NOT OK</div>
</template>
