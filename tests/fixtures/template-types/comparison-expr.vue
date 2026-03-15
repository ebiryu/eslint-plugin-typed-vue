<script setup lang="ts">
interface Stats {
  total: number;
}
const stats: Stats[] = [];
const count = 10;
const flag = true;
</script>

<template>
  <div v-if="stats.length === 0">empty - OK (boolean)</div>
  <div v-else-if="stats.length > 5">many - OK (boolean)</div>
  <div v-else-if="count">fallback - NOT OK (number)</div>
  <div v-if="count !== 0">not zero - OK (boolean)</div>
  <div v-if="!flag">negation - OK (boolean)</div>
  <div v-show="stats.length >= 1">v-show comparison - OK (boolean)</div>
  <div v-show="count">v-show number - NOT OK (number)</div>
</template>
