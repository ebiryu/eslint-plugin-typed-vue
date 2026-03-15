<script setup lang="ts">
import Component from "../basic/Component.vue";
const msg: string = "hello";
const show: boolean = true;
const items: string[] = ["a", "b"];
const count: number = 0;
function handleClick(): void {}
</script>

<template>
  <div>{{ msg }}</div>
  <Component />
  <div v-if="show">conditional</div>
  <div v-for="item in items" :key="item">{{ item }}</div>
  <Component :msg="msg" />
  <div :class="msg">bound</div>
  <div @click="handleClick">clickable</div>
  <div>{{ count + 1 }}</div>
  <div>{{ msg ? 'yes' : 'no' }}</div>
  <slot />
  <template v-slot:default>
    <div>slotted</div>
  </template>
</template>
