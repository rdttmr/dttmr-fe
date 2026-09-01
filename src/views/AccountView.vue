<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useListsStore } from '@/stores/lists'
import { useAuthStore } from '@/stores/auth'
import { getVersionApi } from '@/api/version'
import type { VersionInfo } from '@/types/version'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import InvitesPanel from '@/components/InvitesPanel.vue'

const listsStore = useListsStore()
const authStore = useAuthStore()

const showChangePassword = ref(false)
const versionInfo = ref<VersionInfo | null>(null)
const versionError = ref('')
const isLoadingVersion = ref(false)

onMounted(() => {
  listsStore.ensureLoaded()
  loadVersion()
})

async function loadVersion() {
  isLoadingVersion.value = true
  versionError.value = ''
  try {
    versionInfo.value = await getVersionApi()
  } catch (err) {
    versionError.value = err instanceof Error ? err.message : 'Failed to load API information'
  } finally {
    isLoadingVersion.value = false
  }
}

</script>

<template>
  <main class="page about">
    <h1 v-if="authStore.username">Hi, {{ authStore.username }}</h1>
    <h1 v-else>Account</h1>

    <section class="card info-card">
      <h4>Users</h4>
      <p class="row">
        <span>Signed in as </span>
        <strong>{{ authStore.email ?? 'Unknown' }}</strong>
      </p>
      <button
        type="button"
        class="btn btn-secondary change-password-btn"
        @click="showChangePassword = true"
      >
        Change password
      </button>
    </section>

    <InvitesPanel />

    <h1 class="section-heading">Pending changes</h1>

    <section class="card info-card">
      <h4>Sync status</h4>
      <p class="row">
        <span>Pending changes</span>
        <strong class="mono-num">{{ listsStore.pendingCount }}</strong>
      </p>
      <p class="row">
        <span>Syncing</span>
        <strong>{{ listsStore.isSyncing ? 'Yes' : 'No' }}</strong>
      </p>
    </section>

    <h1 class="section-heading">API information</h1>

    <section class="card info-card">
      <p v-if="isLoadingVersion" class="loading-text">Loading…</p>
      <template v-else-if="versionInfo">
        <p class="row">
          <span>Version</span>
          <strong class="mono-num">{{ versionInfo.version }}</strong>
        </p>
        <p class="row">
          <span>Commit</span>
          <strong class="mono-num">{{ versionInfo.commit }}</strong>
        </p>
        <p class="row">
          <span>Build time</span>
          <strong>{{ versionInfo.buildTime }}</strong>
        </p>
      </template>
      <p v-else class="banner banner-error">{{ versionError }}</p>
    </section>

    <ChangePasswordModal v-if="showChangePassword" @close="showChangePassword = false" />
  </main>
</template>

<style scoped>
@media (min-width: 768px) {
  .page.about {
    max-width: 780px;
  }
}

.about h1 {
  font-size: 1.35rem;
  margin-bottom: 0.75rem;
}

.section-heading {
  margin-top: 1.5rem;
}

.about p {
  color: var(--c-text-soft);
  font-size: 0.9rem;
  margin-bottom: 1.25rem;
}

.info-card {
  padding: 1rem 1.1rem;
}

.info-card + .info-card {
  margin-top: 1rem;
}

.info-card h4 {
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  color: var(--c-text);
}

.row strong {
  color: var(--c-heading);
}

.change-password-btn {
  width: auto;
  margin-top: 0.6rem;
  padding: 0.5rem 1rem;
}

.loading-text {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin: 0;
}
</style>
