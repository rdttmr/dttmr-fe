<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BottomNav from '@/components/BottomNav.vue'

const route = useRoute()

// Sign-in / invite / join screens are full-bleed and carry their own branding.
const isBare = computed(() => ['login', 'register', 'recipe-join'].includes(String(route.name)))
</script>

<template>
  <div class="app-shell">
    <AppHeader v-if="!isBare" />
    <RouterView v-slot="{ Component, route: current }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="current.path" />
      </Transition>
    </RouterView>
    <BottomNav />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
