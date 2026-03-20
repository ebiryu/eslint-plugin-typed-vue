<script setup lang="ts">
interface FormState {
  name: string;
  agreed: boolean;
}
const form: FormState = { name: "", agreed: false };
function onSubmit() {}
function onInput(_event: Event) {}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <input :value="form.name" @input="onInput" />
    <button :disabled="!form.agreed">Submit</button>
  </form>
</template>
