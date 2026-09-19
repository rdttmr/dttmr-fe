<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'
import type { LocalList } from '@/database/db'
import ListCard from '@/components/ListCard.vue'
import AppIcon from '@/components/AppIcon.vue'
import ShareListModal from '@/components/ShareListModal.vue'
import DeleteListModal from '@/components/DeleteListModal.vue'
import { useDragReorder } from '@/composables/useDragReorder'

const listsStore = useListsStore()

const newListName = ref('')
const isCreating = ref(false)
const createError = ref('')
const sharingList = ref<LocalList | null>(null)
const deletingList = ref<LocalList | null>(null)

// Local, reorderable copy of the store's list order. Kept in sync with
// listsStore.sortedLists except while a drag is in progress, so a
// mid-sync-pass update (e.g. total_items ticking over) can't yank a row out
// from under the user's finger.
const displayedLists = ref<LocalList[]>([])
const { draggingId, isPointerActive, dragOffsetPx, setItemRef, onPointerDown } = useDragReorder(
  displayedLists,
  (orderedIds) => {
    void listsStore.reorderLists(orderedIds)
  },
)

watch(
  () => listsStore.sortedLists,
  (next) => {
    if (draggingId.value === null) displayedLists.value = [...next]
  },
  { immediate: true },
)

const totalLists = computed(() => displayedLists.value.length)
const openTasks = computed(() =>
  displayedLists.value.reduce(
    (sum, list) => sum + Math.max(0, (list.total_items ?? 0) - (list.completed_items ?? 0)),
    0,
  ),
)

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
    <header class="page-head">
      <p class="eyebrow">Overview</p>
      <h1>Your lists</h1>
      <p v-if="totalLists > 0" class="page-sub">
        {{ totalLists }} {{ totalLists === 1 ? 'list' : 'lists' }} ·
        <span class="mono-num">{{ openTasks }}</span> open {{ openTasks === 1 ? 'item' : 'items' }}
      </p>
    </header>

    <form class="composer" @submit.prevent="handleCreateList">
      <div class="field">
        <AppIcon name="sparkle" class="composer-icon" />
        <input
          v-model="newListName"
          type="text"
          placeholder="Name a new list…"
          aria-label="New list name"
          :disabled="isCreating"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary add-btn"
        aria-label="Create list"
        :disabled="isCreating || !newListName.trim()"
      >
        <AppIcon name="plus" :size="22" :stroke="2.4" />
      </button>
    </form>

    <p v-if="createError" class="banner banner-error">{{ createError }}</p>

    <TransitionGroup
      v-if="displayedLists.length > 0"
      tag="ul"
      name="list-reorder"
      class="lists stagger"
    >
      <li
        v-for="(list, index) in displayedLists"
        :key="list.clientId ?? list.id"
        :ref="(el) => setItemRef(list.id, el as Element | null)"
        class="list-row"
        :class="{ 'no-transition': isPointerActive && draggingId === list.id }"
        :style="{
          '--i': Math.min(index, 8),
          ...(draggingId === list.id ? { transform: `translateY(${dragOffsetPx}px)` } : {}),
        }"
      >
        <ListCard
          :list="list"
          :dragging="draggingId === list.id"
          @share="handleOpenShare(list)"
          @delete="handleOpenDelete(list)"
          @handle-pointerdown="onPointerDown(list.id, $event)"
        />
      </li>
    </TransitionGroup>

    <div v-else class="empty-state">
      <span class="empty-icon"><AppIcon name="list" :size="34" :stroke="1.7" /></span>
      <p class="empty-title">No lists yet</p>
      <p class="empty-hint">Name your first list above and start ticking things off.</p>
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
.lists {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-row {
  transition:
    transform 0.22s var(--ease-out),
    z-index 0s;
}

.list-row.no-transition {
  transition: none;
  z-index: 2;
  position: relative;
}

.list-reorder-move {
  transition: transform 0.28s var(--ease-out);
}

.list-reorder-enter-active,
.list-reorder-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s var(--ease-out);
}

.list-reorder-leave-active {
  position: absolute;
  width: 100%;
}

.list-reorder-enter-from,
.list-reorder-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
