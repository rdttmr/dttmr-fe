<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import AppIcon from '@/components/AppIcon.vue'
import type { IconName } from '@/components/AppIcon.vue'

const authStore = useAuthStore()
const listsStore = useListsStore()
const recipesStore = useRecipesStore()
const route = useRoute()

const tabs = computed<
  { to: string; label: string; icon: IconName; names: string[]; badge: number }[]
>(() => [
  {
    to: '/',
    label: 'Lists',
    icon: 'list',
    names: ['lists', 'list-detail'],
    badge: listsStore.pendingCount,
  },
  {
    to: '/recipes',
    label: 'Recipes',
    icon: 'recipes',
    names: ['recipes', 'recipe-detail', 'recipe-join'],
    badge: recipesStore.pendingCount,
  },
  { to: '/exercises', label: 'Train', icon: 'dumbbell', names: ['exercises'], badge: 0 },
  { to: '/account', label: 'Account', icon: 'user', names: ['account'], badge: 0 },
])
</script>

<template>
  <nav v-if="authStore.isAuthenticated" class="bottom-nav" aria-label="Main">
    <RouterLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="nav-item"
      :class="{ 'is-active': tab.names.includes(String(route.name)) }"
    >
      <span class="nav-icon-wrap">
        <AppIcon
          :name="tab.icon"
          :size="21"
          :stroke="tab.names.includes(String(route.name)) ? 2.3 : 1.9"
        />
        <span v-if="tab.badge > 0" class="nav-badge mono-num">{{ tab.badge }}</span>
      </span>
      <span class="nav-label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0.75rem;
  right: 0.75rem;
  bottom: calc(0.65rem + var(--safe-bottom));
  z-index: 30;
  display: flex;
  height: var(--nav-height);
  padding: 0.35rem;
  gap: 0.2rem;
  background-color: var(--c-glass);
  border: 1px solid var(--c-border-hover);
  border-radius: 26px;
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  box-shadow: var(--shadow-lg);
}

.nav-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  border-radius: 20px;
  color: var(--c-text-soft);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition:
    color 0.2s,
    background-color 0.25s var(--ease-out),
    transform 0.15s var(--ease-out);
}

.nav-item:hover {
  color: var(--c-heading);
}

.nav-item:active {
  transform: scale(0.94);
}

.nav-item.is-active {
  color: var(--c-heading);
  background-color: var(--c-accent-bg);
}

.nav-item.is-active .nav-icon-wrap {
  color: var(--c-accent-strong);
  transform: translateY(-1px);
}

.nav-item.is-active::after {
  content: '';
  position: absolute;
  bottom: 4px;
  width: 16px;
  height: 3px;
  border-radius: 3px;
  background-image: var(--grad-accent);
  animation: pop-in 0.35s var(--ease-spring);
}

@keyframes pop-in {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
}

.nav-icon-wrap {
  position: relative;
  display: flex;
  transition:
    color 0.2s,
    transform 0.3s var(--ease-spring);
}

.nav-label {
  line-height: 1;
  margin-bottom: 0.25rem;
}

.nav-badge {
  position: absolute;
  top: -6px;
  right: -11px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background-image: var(--grad-accent);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 2px var(--c-bg-soft);
}

@media (min-width: 768px) {
  .bottom-nav {
    left: 50%;
    right: auto;
    bottom: 1.5rem;
    transform: translateX(-50%);
    width: min(440px, calc(100% - 2rem));
  }
}
</style>
