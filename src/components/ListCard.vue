<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { LocalList } from '@/database/db'
import { useListsStore } from '@/stores/lists'

const props = defineProps<{ list: LocalList }>()

const listsStore = useListsStore()

const items = computed(() => listsStore.itemsForList(props.list.id))
const completedCount = computed(() => items.value.filter((item) => item.is_completed).length)
</script>

<template>
  <RouterLink :to="`/lists/${list.id}`" class="list-card card">
    <div class="list-card-main">
      <h3>{{ list.name }}</h3>
      <p class="meta">
        {{ completedCount }}/{{ items.length }} done
        <span v-if="list.pendingSync" class="pending-tag">syncing…</span>
      </p>
    </div>
    <span class="chevron">›</span>
  </RouterLink>
</template>

<style scoped>
.list-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  color: inherit;
  transition:
    border-color 0.15s ease-in-out,
    transform 0.1s ease-in-out;
}

.list-card:active {
  transform: scale(0.995);
}

.list-card:hover {
  border-color: var(--c-border-hover);
}

.list-card h3 {
  font-size: 1.02rem;
  margin-bottom: 0.2rem;
}

.meta {
  font-size: 0.78rem;
  color: var(--c-text-soft);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pending-tag {
  color: var(--c-accent-strong);
}

.chevron {
  color: var(--c-text-soft);
  font-size: 1.3rem;
}
</style>
