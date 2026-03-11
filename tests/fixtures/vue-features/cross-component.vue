<script setup lang="ts">
import { ref } from 'vue';
import type { User } from './types';

const user = ref<User>({ id: 1, name: "Alice", role: "admin" });

// Safe: User type is known
const userName: string = user.value.name;
const userRole: "admin" | "editor" = user.value.role;
</script>

<template>
  <div>
    <span>{{ user.name }}</span>
    <span>{{ user.role }}</span>
  </div>
</template>
