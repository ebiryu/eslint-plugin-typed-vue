<script setup lang="ts">
interface Meta {
  type: string;
}
interface Item {
  id: number;
  meta?: Meta;
}
const item: Item = { id: 1 };
const showActions: boolean | undefined = true;
const isReady = true;
const count = 10;
</script>

<template>
  <div v-if="item.meta && showActions">AND with optional obj and boolean|undefined - NOT OK</div>
  <div v-if="isReady && count > 0">AND true literal && boolean - OK (boolean)</div>
  <div v-if="isReady || count > 0">OR with comparison - OK (boolean)</div>
  <div v-if="item.meta && count > 0">AND optional obj && boolean - NOT OK (false | boolean)</div>
</template>
