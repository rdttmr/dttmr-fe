<script setup lang="ts">
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
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <span class="brand-dot"></span>
      <span class="brand-name">dttmr</span>
    </div>

    <div class="status">
      <span
        class="sync-dot"
        :class="{ offline: !authStore.isAuthenticated }"
        :title="listsStore.isSyncing ? 'Syncing…' : 'Up to date'"
      ></span>
      <span v-if="listsStore.pendingCount > 0" class="pending">
        {{ listsStore.pendingCount }} pending
      </span>
      <span v-if="listsStore.error" class="sync-error" :title="listsStore.error">⚠ sync error</span>
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
  background: linear-gradient(180deg, rgba(10, 14, 26, 0.92) 60%, rgba(10, 14, 26, 0));
  backdrop-filter: blur(8px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--c-heading);
  letter-spacing: 0.02em;
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-accent-strong), var(--c-accent-soft));
  box-shadow: 0 0 12px var(--c-accent);
}

.status {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--c-success);
}

.sync-dot.offline {
  background-color: var(--c-text-soft);
}

.sync-error {
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
