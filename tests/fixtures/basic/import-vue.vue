<script lang="ts">
import Component from "./Component.vue";

// Component should NOT be `any` - it should be properly typed
const component = Component;

export default {
  components: { Component },
  setup() {
    return { component };
  },
};
</script>

<template>
  <Component />
</template>
