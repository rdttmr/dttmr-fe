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
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h1.5M4 12h1.5M4 18h1.5" stroke-linecap="round" />
        <path d="M9 6h11M9 12h11M9 18h11" stroke-linecap="round" />
      </svg>
      <span class="nav-label">Lists</span>
      <span v-if="listsStore.pendingCount > 0" class="nav-badge mono-num">{{
        listsStore.pendingCount
      }}</span>
    </RouterLink>
    <RouterLink to="/exercises" class="nav-item" active-class="is-active">
      <svg
        class="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="1" y="9" width="3" height="6" rx="1" />
        <rect x="4.5" y="7" width="2" height="10" rx="1" />
        <line x1="6.5" y1="12" x2="17.5" y2="12" />
        <rect x="17.5" y="7" width="2" height="10" rx="1" />
        <rect x="20" y="9" width="3" height="6" rx="1" />
      </svg>
      <span class="nav-label">Exercises</span>
    </RouterLink>
    <RouterLink to="/account" class="nav-item" active-class="is-active">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3.2" />
        <path
          d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3"
          stroke-linecap="round"
        />
      </svg>
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
  gap: 0.2rem;
  color: var(--c-text-soft);
  font-size: 0.68rem;
  transition: color 0.15s ease-in-out;
}

.nav-item.is-active {
  color: var(--c-accent-strong);
}

.nav-icon {
  width: 21px;
  height: 21px;
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
  color: var(--c-bg);
  font-size: 0.6rem;
  font-weight: 600;
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
