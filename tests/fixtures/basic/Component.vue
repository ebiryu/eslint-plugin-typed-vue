<script lang="ts">
import { ref } from "vue";

const count = ref(0);
const message: string = "hello";

export default {
  setup() {
    return { count, message };
  },
};
</script>

<template>
  <div>{{ count }} {{ message }}</div>
</template>
