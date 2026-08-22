<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'
import type { LocalList } from '@/database/db'
import ListCard from '@/components/ListCard.vue'
import ShareListModal from '@/components/ShareListModal.vue'
import DeleteListModal from '@/components/DeleteListModal.vue'

const listsStore = useListsStore()

const newListName = ref('')
const isCreating = ref(false)
const createError = ref('')
const sharingList = ref<LocalList | null>(null)
const deletingList = ref<LocalList | null>(null)

onMounted(() => {
  listsStore.loadLists()
})

function handleOpenShare(list: LocalList) {
  sharingList.value = list
}

function handleCloseShare() {
  sharingList.value = null
}

function handleOpenDelete(list: LocalList) {
  deletingList.value = list
}

function handleCloseDelete() {
  deletingList.value = null
}

async function handleConfirmDelete() {
  if (!deletingList.value) return
  const listId = deletingList.value.id
  deletingList.value = null
  try {
    await listsStore.deleteList(listId)
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to delete list'
  }
}

async function handleCreateList() {
  const name = newListName.value.trim()
  if (!name) return

  createError.value = ''
  isCreating.value = true
  try {
    await listsStore.createList(name)
    newListName.value = ''
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create list'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <main class="page">
    <h1>Your Lists</h1>

    <form class="new-list-form" @submit.prevent="handleCreateList">
      <div class="field">
        <input
          v-model="newListName"
          type="text"
          placeholder="New list name…"
          :disabled="isCreating"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary add-btn"
        :disabled="isCreating || !newListName.trim()"
      >
        +
      </button>
    </form>

    <p v-if="createError" class="banner banner-error">{{ createError }}</p>

    <ul v-if="listsStore.sortedLists.length > 0" class="lists">
      <li v-for="list in listsStore.sortedLists" :key="list.id">
        <ListCard :list="list" @share="handleOpenShare(list)" @delete="handleOpenDelete(list)" />
      </li>
    </ul>

    <div v-else class="empty-state">
      <p>No lists yet</p>
      <p class="empty-hint">Create your first list above to get started.</p>
    </div>

    <ShareListModal v-if="sharingList" :list="sharingList" @close="handleCloseShare" />
    <DeleteListModal
      v-if="deletingList"
      :list="deletingList"
      @close="handleCloseDelete"
      @confirm="handleConfirmDelete"
    />
  </main>
</template>

<style scoped>
h1 {
  font-size: 1.4rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin-bottom: 1.25rem;
}

.new-list-form {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.new-list-form .field {
  flex: 1;
}

.add-btn {
  width: 46px;
  flex-shrink: 0;
  font-size: 1.3rem;
  line-height: 1;
}

.lists {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--c-text-soft);
}

.empty-state p:first-child {
  color: var(--c-heading);
  font-weight: 500;
  margin-bottom: 0.35rem;
}

.empty-hint {
  font-size: 0.85rem;
}
</style>
