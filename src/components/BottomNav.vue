<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'

const authStore = useAuthStore()
const listsStore = useListsStore()
</script>

<template>
  <nav v-if="authStore.isAuthenticated" class="bottom-nav">
    <RouterLink to="/" class="nav-item" active-class="is-active">
      <span class="nav-icon">☰</span>
      <span class="nav-label">Lists</span>
      <span v-if="listsStore.pendingCount > 0" class="nav-badge">{{
        listsStore.pendingCount
      }}</span>
    </RouterLink>
    <RouterLink to="/account" class="nav-item" active-class="is-active">
      <span class="nav-icon">⚙</span>
      <span class="nav-label">Account</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  height: calc(var(--nav-height) + var(--safe-bottom));
  padding-bottom: var(--safe-bottom);
  background-color: var(--c-bg-soft);
  border-top: 1px solid var(--c-border);
  backdrop-filter: blur(12px);
  z-index: 20;
}

.nav-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  color: var(--c-text-soft);
  font-size: 0.7rem;
}

.nav-icon {
  font-size: 1.25rem;
  line-height: 1;
}

.nav-badge {
  position: absolute;
  top: 0.35rem;
  right: calc(50% - 1.35rem);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background-color: var(--c-accent);
  color: #fff;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 768px) {
  .bottom-nav {
    left: 50%;
    right: auto;
    bottom: 1.25rem;
    transform: translateX(-50%);
    width: min(420px, calc(100% - 2rem));
    height: 56px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--c-border);
    box-shadow: var(--shadow-md);
  }
}
</style>
