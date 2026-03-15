<script setup lang="ts">
interface MyState {
  isLoading: boolean;
  count: number;
  name: string;
}
const state: MyState = { isLoading: false, count: 0, name: "" };
</script>

<template>
  <div v-if="state.isLoading">loading - OK (boolean)</div>
  <div v-if="state.count">count - NOT OK (number)</div>
  <div v-if="state.name">name - NOT OK (string)</div>
</template>
