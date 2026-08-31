<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useListsStore } from '@/stores/lists'
import { useAuthStore } from '@/stores/auth'
import ChangePasswordModal from '@/components/ChangePasswordModal.vue'

const listsStore = useListsStore()
const authStore = useAuthStore()

const showChangePassword = ref(false)

onMounted(() => {
  listsStore.loadLists()
})
</script>

<template>
  <main class="page about">
    <h1 v-if="authStore.username">Hi, {{ authStore.username }}</h1>
    <h1 v-else>Account</h1>

    <section class="card info-card">
      <h4>Users</h4>
      <p class="row">
        <span>Signed in as</span>
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

    <h1>Pending changes</h1>

    <section class="card info-card">
      <h4>Sync status</h4>
      <p class="row">
        <span>Pending changes</span>
        <strong>{{ listsStore.pendingCount }}</strong>
      </p>
      <p class="row">
        <span>Syncing</span>
        <strong>{{ listsStore.isSyncing ? 'Yes' : 'No' }}</strong>
      </p>
    </section>

    <ChangePasswordModal v-if="showChangePassword" @close="showChangePassword = false" />
  </main>
</template>

<style scoped>
.about h1 {
  font-size: 1.35rem;
  margin-bottom: 0.75rem;
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
</style>
