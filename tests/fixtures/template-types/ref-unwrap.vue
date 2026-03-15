<script setup lang="ts">
import { ref, computed, shallowRef } from "vue";

const isLoading = ref(true);
const isReady = computed(() => !isLoading.value);
const isActive = shallowRef(false);
const count = ref(0);
const name = ref("hello");
</script>

<template>
  <div v-if="isLoading">ref boolean - OK</div>
  <div v-if="isReady">computed boolean - OK</div>
  <div v-if="isActive">shallowRef boolean - OK</div>
  <div v-if="count">ref number - NOT OK</div>
  <div v-if="name">ref string - NOT OK</div>
</template>
