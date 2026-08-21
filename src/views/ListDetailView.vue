<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import ListItemRow from '@/components/ListItemRow.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const listsStore = useListsStore()

const newItemTitle = ref('')
const isAddingItem = ref(false)
const itemError = ref('')

onMounted(() => {
  listsStore.loadLists()
  listsStore.loadListItems(props.id)
})

const list = computed(() => listsStore.lists.find((entry) => entry.id === props.id))
const items = computed(() => listsStore.itemsForList(props.id))
const pendingItems = computed(() => items.value.filter((item) => !item.is_completed))
const completedItems = computed(() => items.value.filter((item) => item.is_completed))

async function handleAddItem() {
  const title = newItemTitle.value.trim()
  if (!title) return

  itemError.value = ''
  isAddingItem.value = true
  try {
    await listsStore.createListItem(props.id, title)
    newItemTitle.value = ''
  } catch (err) {
    itemError.value = err instanceof Error ? err.message : 'Failed to add item'
  } finally {
    isAddingItem.value = false
  }
}
</script>

<template>
  <main class="page">
    <button type="button" class="back-link" @click="router.push('/')">‹ Lists</button>

    <template v-if="list">
      <h1>{{ list.name }}</h1>
      <p v-if="list.pendingSync" class="pending-note">This list hasn't synced to the server yet.</p>

      <form class="new-item-form" @submit.prevent="handleAddItem">
        <div class="field">
          <input
            v-model="newItemTitle"
            type="text"
            placeholder="Add an item…"
            :disabled="isAddingItem"
          />
        </div>
        <button
          type="submit"
          class="btn btn-primary add-btn"
          :disabled="isAddingItem || !newItemTitle.trim()"
        >
          +
        </button>
      </form>

      <p v-if="itemError" class="banner banner-error">{{ itemError }}</p>

      <section v-if="pendingItems.length > 0" class="card items-card">
        <ul class="items-list">
          <ListItemRow v-for="item in pendingItems" :key="item.id" :item="item" />
        </ul>
      </section>

      <section v-if="completedItems.length > 0" class="card items-card completed-card">
        <h4>Completed</h4>
        <ul class="items-list">
          <ListItemRow v-for="item in completedItems" :key="item.id" :item="item" />
        </ul>
      </section>

      <p v-if="items.length === 0" class="empty-hint">No items yet — add your first one above.</p>
    </template>

    <p v-else class="empty-hint">List not found on this device.</p>
  </main>
</template>

<style scoped>
.back-link {
  background: none;
  border: none;
  color: var(--c-accent-strong);
  font-size: 0.9rem;
  padding: 0;
  margin-bottom: 0.75rem;
  cursor: pointer;
}

h1 {
  font-size: 1.35rem;
  margin-bottom: 0.5rem;
}

.pending-note {
  font-size: 0.8rem;
  color: var(--c-warning);
  margin-bottom: 1rem;
}

.new-item-form {
  display: flex;
  gap: 0.6rem;
  margin: 1rem 0;
}

.new-item-form .field {
  flex: 1;
}

.add-btn {
  width: 46px;
  flex-shrink: 0;
  font-size: 1.3rem;
  line-height: 1;
}

.items-card {
  padding: 0.2rem 0.9rem;
  margin-bottom: 1rem;
}

.completed-card h4 {
  padding: 0.7rem 0.2rem 0;
  font-size: 0.8rem;
  color: var(--c-text-soft);
}

.items-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  text-align: center;
  padding: 1.5rem 0;
}
</style>
