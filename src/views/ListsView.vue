<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'
import { useGroupsStore } from '@/stores/groups'
import type { LocalList } from '@/database/db'
import ListCard from '@/components/ListCard.vue'
import AppIcon from '@/components/AppIcon.vue'
import GroupFilter from '@/components/GroupFilter.vue'
import MoveToGroupModal from '@/components/MoveToGroupModal.vue'
import DeleteListModal from '@/components/DeleteListModal.vue'
import { useDragReorder } from '@/composables/useDragReorder'
import { mergeSubsetOrder } from '@/utils/orderRebase'

const listsStore = useListsStore()
const groupsStore = useGroupsStore()

const newListName = ref('')
const isCreating = ref(false)
const createError = ref('')
const movingList = ref<LocalList | null>(null)
const deletingList = ref<LocalList | null>(null)

const visibleLists = computed(() => {
  const groupId = groupsStore.activeGroupId
  if (!groupId) return listsStore.sortedLists
  return listsStore.sortedLists.filter((list) => list.group_id === groupId)
})

// Which group each card belongs to only matters when several are mixed.
function groupLabel(list: LocalList): string | undefined {
  if (!groupsStore.hasMultipleGroups || groupsStore.activeGroupId) return undefined
  return groupsStore.groupName(list.group_id)
}

// Local, reorderable copy of the visible list order. Kept in sync with
// visibleLists except while a drag is in progress, so a mid-sync-pass
// update (e.g. total_items ticking over) can't yank a row out from under the
// user's finger. While filtered to one group, the drag reorders only that
// group's lists within the slots they already hold.
const displayedLists = ref<LocalList[]>([])
const { draggingId, isPointerActive, dragOffsetPx, setItemRef, onPointerDown } = useDragReorder(
  displayedLists,
  (orderedIds) => {
    const fullIds = listsStore.sortedLists.map((list) => list.id)
    void listsStore.reorderLists(mergeSubsetOrder(fullIds, orderedIds))
  },
)

watch(
  visibleLists,
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
  groupsStore.loadGroups()
  listsStore.loadLists()
})

async function handleMove(groupId: string) {
  if (!movingList.value) return
  const listId = movingList.value.id
  movingList.value = null
  createError.value = ''
  try {
    await listsStore.moveListToGroup(listId, groupId)
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to move list'
  }
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
    await listsStore.createList(name, groupsStore.activeGroupId ?? undefined)
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

    <GroupFilter />

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
          :group-label="groupLabel(list)"
          :dragging="draggingId === list.id"
          @move="movingList = list"
          @delete="handleOpenDelete(list)"
          @handle-pointerdown="onPointerDown(list.id, $event)"
        />
      </li>
    </TransitionGroup>

    <div v-else class="empty-state">
      <span class="empty-icon"><AppIcon name="list" :size="34" :stroke="1.7" /></span>
      <p v-if="groupsStore.activeGroupId" class="empty-title">
        No lists in {{ groupsStore.groupName(groupsStore.activeGroupId) }}
      </p>
      <p v-else class="empty-title">No lists yet</p>
      <p class="empty-hint">Name your first list above and start ticking things off.</p>
    </div>

    <MoveToGroupModal
      v-if="movingList"
      kind="list"
      :name="movingList.name"
      :current-group-id="movingList.group_id"
      @close="movingList = null"
      @move="handleMove"
    />
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
