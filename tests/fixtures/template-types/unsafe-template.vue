<script setup lang="ts">
const safeValue: string = "hello";
const unsafeValue: any = "world";
function safeHandler(e: Event): void {}
const unsafeHandler: any = () => {};
</script>

<template>
  <div>{{ safeValue }}</div>
  <div>{{ unsafeValue }}</div>
  <input :value="safeValue" />
  <input :value="unsafeValue" />
  <button @click="safeHandler">safe</button>
  <button @click="unsafeHandler">unsafe</button>
</template>
