<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import type { LocalListItem } from '@/database/db'
import ListItemRow from '@/components/ListItemRow.vue'
import DeleteListModal from '@/components/DeleteListModal.vue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const listsStore = useListsStore()

const newItemTitle = ref('')
const isAddingItem = ref(false)
const itemError = ref('')
const isMenuOpen = ref(false)
const showDeleteModal = ref(false)
const menuContainerRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (menuContainerRef.value && !menuContainerRef.value.contains(event.target as Node)) {
    isMenuOpen.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isMenuOpen.value) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  listsStore.loadLists()
  listsStore.loadListItems(props.id)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

const list = computed(() => listsStore.lists.find((entry) => entry.id === props.id))
const items = computed(() => listsStore.itemsForList(props.id))

function byModifiedDesc(a: LocalListItem, b: LocalListItem) {
  return (b.modified_at ?? '').localeCompare(a.modified_at ?? '')
}

const pendingItems = computed(() =>
  items.value.filter((item) => !item.is_completed).sort(byModifiedDesc),
)
const completedItems = computed(() =>
  items.value.filter((item) => item.is_completed).sort(byModifiedDesc),
)

function toggleMenu(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = !isMenuOpen.value
}

function handleOpenDelete() {
  isMenuOpen.value = false
  showDeleteModal.value = true
}

function handleCloseDelete() {
  showDeleteModal.value = false
}

async function handleConfirmDelete() {
  if (!list.value) return
  showDeleteModal.value = false
  try {
    await listsStore.deleteList(list.value.id)
    router.push('/')
  } catch (err) {
    itemError.value = err instanceof Error ? err.message : 'Failed to delete list'
  }
}

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
      <div class="list-header">
        <h1>{{ list.name }}</h1>

        <div ref="menuContainerRef" class="menu-container">
          <button
            type="button"
            class="menu-trigger-btn"
            aria-label="List options"
            aria-haspopup="true"
            :aria-expanded="isMenuOpen"
            title="More options"
            @click="toggleMenu"
          >
            <svg class="dots-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
            <button
              type="button"
              class="submenu-item submenu-item-danger"
              role="menuitem"
              @click="handleOpenDelete"
            >
              <svg
                class="submenu-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span>Delete list</span>
            </button>
          </div>
        </div>
      </div>
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

      <DeleteListModal
        v-if="showDeleteModal && list"
        :list="list"
        @close="handleCloseDelete"
        @confirm="handleConfirmDelete"
      />
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

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.list-header h1 {
  font-size: 1.35rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.menu-container {
  position: relative;
  display: flex;
  align-items: center;
}

.menu-trigger-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--c-text-soft);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    background-color 0.15s ease-in-out,
    color 0.15s ease-in-out,
    border-color 0.15s ease-in-out;
}

.menu-trigger-btn:hover,
.menu-trigger-btn[aria-expanded='true'] {
  background-color: var(--c-bg-mute);
  color: var(--c-heading);
  border-color: var(--c-border);
}

.dots-icon {
  display: block;
}

.submenu-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  min-width: 140px;
  background-color: var(--c-bg-elevated);
  border: 1px solid var(--c-border-hover);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 0.35rem;
  animation: dropdownIn 0.12s ease-out;
}

.submenu-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--c-heading);
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s ease-in-out,
    color 0.15s ease-in-out;
}

.submenu-item:hover {
  background-color: var(--c-bg-mute);
  color: var(--c-accent-strong);
}

.submenu-item-danger {
  color: var(--c-danger);
}

.submenu-item-danger:hover {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.submenu-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

@keyframes dropdownIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
