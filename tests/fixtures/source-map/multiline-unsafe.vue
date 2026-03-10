<script lang="ts">
import { ref } from "vue";

const safe1: number = 1;
const safe2: string = "hello";
const unsafe1: string = {} as any;
const safe3: boolean = true;
const unsafe2: number = {} as any;

export default {
  setup() {
    return { safe1, safe2, unsafe1, safe3, unsafe2 };
  },
};
</script>

<template>
  <div>{{ safe1 }}</div>
</template>
