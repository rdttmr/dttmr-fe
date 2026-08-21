<script setup lang="ts">
import { onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'

const listsStore = useListsStore()

onMounted(() => {
  listsStore.loadLists()
})
</script>

<template>
  <main class="page about">
    <h1>About dttmr</h1>
    <p>
      An offline-first progressive web app for shared lists. Every change you make is saved
      instantly on this device and pushed to the server as soon as you're back online.
    </p>

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
</style>
