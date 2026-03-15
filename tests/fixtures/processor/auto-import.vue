<script setup lang="ts">
const state: any = {};
function togglePlayPause() {}
function seek(_time: number) {}
function skipForward() {}
function skipBackward() {}
</script>

<template>
  <div>
    <OfflineIndicator />
    <AppHeader />
    <main>
      <slot />
    </main>
    <AudioPlayer
      :state="state"
      @toggle-play-pause="togglePlayPause"
      @seek="seek"
      @skip-forward="skipForward"
      @skip-backward="skipBackward"
    />
    <BottomTabBar />
  </div>
</template>
