<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'

const authStore = useAuthStore()
const listsStore = useListsStore()
const router = useRouter()

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

const stampClass = computed(() => {
  if (!authStore.isAuthenticated) return ''
  if (listsStore.pendingCount > 0 || listsStore.isSyncing) return 'stamp-pending'
  return 'stamp-synced'
})

const stampTitle = computed(() => {
  if (!authStore.isAuthenticated) return 'Not signed in'
  if (listsStore.isSyncing) return 'Syncing…'
  if (listsStore.pendingCount > 0) return `${listsStore.pendingCount} change(s) waiting to sync`
  return 'Up to date'
})
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="brand-seal"></span>
      <span class="brand-name">dttmr</span>
    </div>

    <div class="status">
      <span
        v-if="listsStore.error"
        class="stamp stamp-danger"
        :title="listsStore.error"
        :aria-label="listsStore.error"
        role="img"
      ></span>
      <span
        v-else
        class="stamp"
        :class="stampClass"
        :title="stampTitle"
        :aria-label="stampTitle"
        role="img"
      ></span>
      <button v-if="authStore.isAuthenticated" type="button" class="logout" @click="handleLogout">
        Log out
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(0.75rem + var(--safe-top)) 1rem 0.75rem;
  background: linear-gradient(180deg, rgba(20, 24, 26, 0.92) 60%, rgba(20, 24, 26, 0));
  backdrop-filter: blur(8px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--c-heading);
}

.brand-name {
  font-family: var(--font-stamp);
  font-size: 0.95rem;
  letter-spacing: 0.04em;
}

.brand-seal {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: var(--c-accent);
  transform: rotate(-8deg);
  box-shadow: 0 0 0 2px var(--c-bg) inset;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.stamp {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--c-text-soft);
}

.stamp::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: currentColor;
  flex-shrink: 0;
}

.stamp-pending {
  color: var(--c-warning);
}

.stamp-synced {
  color: var(--c-success);
}

.stamp-danger {
  color: var(--c-danger);
  cursor: help;
}

.logout {
  background: none;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-sm);
  color: var(--c-text);
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.logout:hover {
  border-color: var(--c-border-hover);
  color: var(--c-heading);
}
</style>
