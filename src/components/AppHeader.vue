<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import AppIcon from '@/components/AppIcon.vue'
import BrandMark from '@/components/BrandMark.vue'
import type { IconName } from '@/components/AppIcon.vue'

const authStore = useAuthStore()
const listsStore = useListsStore()
const recipesStore = useRecipesStore()

const combinedError = computed(() => listsStore.error ?? recipesStore.error)
const combinedPendingCount = computed(() => listsStore.pendingCount + recipesStore.pendingCount)
const combinedIsSyncing = computed(() => listsStore.isSyncing || recipesStore.isSyncing)

type SyncState = { tone: 'idle' | 'synced' | 'pending' | 'error'; label: string; icon: IconName }

const sync = computed<SyncState | null>(() => {
  if (!authStore.isAuthenticated) return null
  if (combinedError.value) return { tone: 'error', label: 'Sync error', icon: 'alert' }
  if (combinedIsSyncing.value) return { tone: 'pending', label: 'Syncing', icon: 'refresh' }
  if (combinedPendingCount.value > 0) {
    return { tone: 'pending', label: `${combinedPendingCount.value} pending`, icon: 'cloud' }
  }
  return { tone: 'synced', label: 'Synced', icon: 'cloud-check' }
})

const syncTitle = computed(() => {
  if (!authStore.isAuthenticated) return 'Not signed in'
  if (combinedError.value) return combinedError.value
  if (combinedIsSyncing.value) return 'Syncing…'
  if (combinedPendingCount.value > 0)
    return `${combinedPendingCount.value} change(s) waiting to sync`
  return 'Up to date'
})
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <RouterLink to="/" class="brand" aria-label="dttmr home">
        <BrandMark :size="30" class="brand-mark" />
        <span class="brand-name">dttmr</span>
      </RouterLink>

      <div
        v-if="sync"
        class="sync-pill"
        :class="`is-${sync.tone}`"
        :title="syncTitle"
        :aria-label="syncTitle"
        role="status"
      >
        <AppIcon :name="sync.icon" :size="14" :stroke="2.2" class="sync-icon" />
        <span class="sync-label">{{ sync.label }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: var(--safe-top);
  background: linear-gradient(180deg, var(--c-bg) 0%, transparent 100%);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 680px;
  margin: 0 auto;
  height: var(--header-height);
  padding: 0 1.1rem;
}

@media (min-width: 768px) {
  .header-inner {
    padding: 0 2rem;
  }
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--c-heading);
  transition: transform 0.2s var(--ease-out);
}

.brand:active {
  transform: scale(0.96);
}

.brand-name {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: -0.03em;
}

.sync-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem 0.35rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background-color: var(--c-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--c-text-soft);
  transition:
    color 0.3s,
    border-color 0.3s,
    background-color 0.3s;
}

.sync-pill.is-synced {
  color: var(--c-success);
}

.sync-pill.is-pending {
  color: var(--c-warning);
  border-color: rgba(255, 184, 92, 0.3);
}

.sync-pill.is-pending .sync-icon {
  animation: spin 1.4s linear infinite;
}

.sync-pill.is-error {
  color: var(--c-danger);
  border-color: var(--c-danger-border);
  cursor: help;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
