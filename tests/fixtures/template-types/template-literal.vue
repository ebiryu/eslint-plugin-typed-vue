<script setup lang="ts">
interface Item {
  id: number;
  feedId: number;
  title: string;
}
const item: Item = { id: 1, feedId: 42, title: "Test" };
const prefix: string = "/feeds";
const unsafeVal: any = "oops";
</script>

<template>
  <a :href="`/feeds/${item.feedId}`">safe template literal</a>
  <a :href="`${prefix}/${item.id}`">safe multi-interpolation</a>
  <div :title="`Title: ${item.title}`">safe string interpolation</div>
  <div>{{ `count: ${item.id}` }}</div>
  <a :href="unsafeVal">unsafe non-literal binding</a>
</template>
