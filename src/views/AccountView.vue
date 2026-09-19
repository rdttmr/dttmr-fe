<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import { useAuthStore } from '@/stores/auth'
import { useRecipesStore } from '@/stores/recipes'
import { hueFromString } from '@/utils/hue'
import AppIcon from '@/components/AppIcon.vue'
import { getVersionApi } from '@/api/version'
import type { VersionInfo } from '@/types/version'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'
import InvitesPanel from '@/components/InvitesPanel.vue'

const listsStore = useListsStore()
const authStore = useAuthStore()
const recipesStore = useRecipesStore()
const router = useRouter()

const displayName = computed(() => authStore.username || authStore.email || 'Account')
const initials = computed(() => {
  const source = (authStore.username || authStore.email || '?').trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const [first = '', second = ''] = parts
  const letters = second ? first.charAt(0) + second.charAt(0) : source.slice(0, 2)
  return letters.toUpperCase()
})
const hue = computed(() => hueFromString(displayName.value))
const pendingChanges = computed(() => listsStore.pendingCount + recipesStore.pendingCount)
const isSyncing = computed(() => listsStore.isSyncing || recipesStore.isSyncing)

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

const showChangePassword = ref(false)
const versionInfo = ref<VersionInfo | null>(null)
const versionError = ref('')
const isLoadingVersion = ref(false)

onMounted(() => {
  listsStore.ensureLoaded()
  recipesStore.ensureLoaded()
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
    <section class="profile card" :style="{ '--hue': hue }">
      <span class="avatar" aria-hidden="true">{{ initials }}</span>
      <div class="profile-text">
        <h1 v-if="authStore.username">Hi, {{ authStore.username }}</h1>
        <h1 v-else>Account</h1>
        <p class="profile-email">{{ authStore.email ?? 'Unknown' }}</p>
      </div>
    </section>

    <div class="profile-actions">
      <button
        type="button"
        class="btn btn-secondary change-password-btn"
        @click="showChangePassword = true"
      >
        <AppIcon name="key" :size="17" /> Change password
      </button>
      <button type="button" class="btn btn-secondary logout-btn" @click="handleLogout">
        <AppIcon name="logout" :size="17" /> Sign out
      </button>
    </div>

    <h2 class="section-label">Sync</h2>
    <section class="stats">
      <div class="stat card">
        <span class="stat-icon" :class="{ 'is-pending': pendingChanges > 0 }">
          <AppIcon :name="pendingChanges > 0 ? 'cloud' : 'cloud-check'" :size="20" />
        </span>
        <strong class="mono-num">{{ pendingChanges }}</strong>
        <span class="stat-label">Pending changes</span>
      </div>
      <div class="stat card">
        <span class="stat-icon" :class="{ 'is-pending': isSyncing }">
          <AppIcon name="refresh" :size="20" :class="{ spinning: isSyncing }" />
        </span>
        <strong>{{ isSyncing ? 'Yes' : 'No' }}</strong>
        <span class="stat-label">Syncing now</span>
      </div>
    </section>

    <h2 class="section-label">Invites</h2>
    <InvitesPanel />

    <h2 class="section-label">About</h2>
    <section class="card info-card">
      <p v-if="isLoadingVersion" class="loading-text">Loading…</p>
      <template v-else-if="versionInfo">
        <p class="row">
          <span><AppIcon name="server" :size="16" /> Version</span>
          <strong class="mono-num">{{ versionInfo.version }}</strong>
        </p>
        <p class="row">
          <span><AppIcon name="shield" :size="16" /> Commit</span>
          <strong class="mono-num">{{ versionInfo.commit }}</strong>
        </p>
        <p class="row">
          <span><AppIcon name="refresh" :size="16" /> Build time</span>
          <strong>{{ versionInfo.buildTime }}</strong>
        </p>
      </template>
      <p v-else class="banner banner-error">{{ versionError }}</p>
    </section>

    <ChangePasswordModal v-if="showChangePassword" @close="showChangePassword = false" />
  </main>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  margin-top: 0.75rem;
  padding: 1.4rem 1.3rem;
  background-color: var(--c-bg-soft);
  background-image:
    radial-gradient(110% 160% at 0% 0%, hsl(var(--hue) 85% 60% / 0.24), transparent 60%),
    radial-gradient(
      90% 140% at 100% 100%,
      hsl(calc(var(--hue) + 28) 85% 60% / 0.14),
      transparent 65%
    );
}

.avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 24px;
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  background-image: linear-gradient(
    135deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 52%)
  );
  box-shadow:
    0 10px 26px hsl(var(--hue) 80% 50% / 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.profile-text {
  min-width: 0;
}

.profile h1 {
  font-size: 1.6rem;
  line-height: 1.15;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.profile-email {
  margin-top: 0.2rem;
  font-size: 0.88rem;
  color: var(--c-text-soft);
  overflow-wrap: anywhere;
}

.profile-actions {
  display: flex;
  gap: 0.6rem;
  margin-top: 0.75rem;
}

.profile-actions .btn {
  flex: 1;
  width: auto;
  padding: 0.7rem 0.6rem;
  font-size: 0.88rem;
}

.logout-btn:hover:not(:disabled) {
  color: var(--c-danger);
  border-color: var(--c-danger-border);
  background-color: var(--c-danger-bg);
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 1rem 1.1rem;
  background-color: var(--c-bg-soft);
}

.stat strong {
  font-family: var(--font-display);
  font-size: 1.7rem;
  line-height: 1.1;
  color: var(--c-heading);
  letter-spacing: -0.02em;
}

.stat .mono-num {
  font-family: var(--font-display);
}

.stat-label {
  font-size: 0.78rem;
  color: var(--c-text-soft);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-bottom: 0.6rem;
  border-radius: 12px;
  background-color: var(--c-success-bg);
  color: var(--c-success);
}

.stat-icon.is-pending {
  background-color: var(--c-warning-bg);
  color: var(--c-warning);
}

.spinning {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.info-card {
  padding: 0.5rem 1.1rem;
  background-color: var(--c-bg-soft);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  font-size: 0.9rem;
  color: var(--c-text-soft);
}

.row + .row {
  border-top: 1px solid var(--c-border);
}

.row span {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.row strong {
  color: var(--c-heading);
  font-weight: 600;
  text-align: right;
  overflow-wrap: anywhere;
}

.info-card .loading-text,
.info-card .banner {
  margin: 0.5rem 0;
}
</style>
