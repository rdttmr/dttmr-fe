<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useListsStore } from '@/stores/lists'
import type { LocalListItem } from '@/database/db'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
import AppIcon from '@/components/AppIcon.vue'
import ListItemRow from '@/components/ListItemRow.vue'
import DeleteListModal from '@/components/DeleteListModal.vue'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { hueFromString } from '@/utils/hue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const listsStore = useListsStore()

// Doubles as the "add item" text box and the live filter query on the list below.
const itemInput = ref('')
const isAddingItem = ref(false)
const itemError = ref('')
const showDeleteModal = ref(false)
const showCompleted = ref(true)
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

onMounted(() => {
  listsStore.loadLists()
  listsStore.loadListItems(props.id)
})

// Vue Router reuses this component instance when navigating between two
// list-detail routes, so the initial onMounted load alone would leave a
// newly-navigated-to list's items unfetched.
watch(
  () => props.id,
  (newId) => {
    listsStore.loadListItems(newId)
  },
)

const list = computed(() => listsStore.lists.find((entry) => entry.id === props.id))
const items = computed(() => listsStore.itemsForList(props.id))

function byModifiedDesc(a: LocalListItem, b: LocalListItem) {
  return (b.modified_at ?? '').localeCompare(a.modified_at ?? '')
}

// Filtering is local and fuzzy only, for display purposes — it never touches
// the server or the sync queue.
const filterQuery = computed(() => itemInput.value.trim())

const filteredItems = computed(() => {
  const query = filterQuery.value
  if (!query) return items.value
  return items.value.filter((item) => fuzzyMatch(query, item.title))
})

const pendingItems = computed(() =>
  filteredItems.value.filter((item) => !item.is_completed).sort(byModifiedDesc),
)
const completedItems = computed(() =>
  filteredItems.value.filter((item) => item.is_completed).sort(byModifiedDesc),
)

const doneCount = computed(() => items.value.filter((item) => item.is_completed).length)
const percent = computed(() =>
  items.value.length > 0 ? Math.round((doneCount.value / items.value.length) * 100) : 0,
)
const allDone = computed(() => items.value.length > 0 && doneCount.value === items.value.length)
const hue = computed(() => hueFromString(list.value?.name ?? ''))

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
  const title = filterQuery.value
  if (!title) return

  itemError.value = ''
  isAddingItem.value = true
  try {
    await listsStore.createListItem(props.id, title)
    itemInput.value = ''
  } catch (err) {
    itemError.value = err instanceof Error ? err.message : 'Failed to add item'
  } finally {
    isAddingItem.value = false
  }
}
</script>

<template>
  <main class="page">
    <button type="button" class="back-link" @click="router.push('/')">
      <AppIcon name="chevron-left" :size="18" :stroke="2.4" />
      Lists
    </button>

    <template v-if="list">
      <section
        class="hero card menu-lift"
        :class="{ 'is-complete': allDone }"
        :style="{ '--hue': hue }"
      >
        <div class="list-header">
          <div class="hero-text">
            <h1>{{ list.name }}</h1>
            <p class="hero-meta">
              <template v-if="items.length > 0">
                <span class="mono-num">{{ doneCount }}/{{ items.length }}</span> done
                <span class="dot">·</span>
                <span class="mono-num">{{ percent }}%</span>
              </template>
              <template v-else>Nothing here yet</template>
            </p>
          </div>

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
              <AppIcon name="more" :size="18" />
            </button>

            <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
              <button
                type="button"
                class="submenu-item submenu-item-danger"
                role="menuitem"
                @click="handleOpenDelete"
              >
                <AppIcon name="trash" :size="16" />
                <span>Delete list</span>
              </button>
            </div>
          </div>
        </div>

        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="progress-fill" :style="{ width: `${percent}%` }"></span>
        </div>
      </section>

      <p v-if="list.pendingSync" class="pending-note">
        <AppIcon name="cloud" :size="14" /> This list hasn't synced to the server yet.
      </p>

      <form class="composer" @submit.prevent="handleAddItem">
        <div class="field">
          <AppIcon name="search" class="composer-icon" />
          <input
            v-model="itemInput"
            type="text"
            placeholder="Add an item or search…"
            aria-label="Add an item"
            :disabled="isAddingItem"
          />
        </div>
        <button
          type="submit"
          class="btn btn-primary add-btn"
          aria-label="Add item"
          :disabled="isAddingItem || !filterQuery"
        >
          <AppIcon name="plus" :size="22" :stroke="2.4" />
        </button>
      </form>

      <p v-if="itemError" class="banner banner-error">{{ itemError }}</p>

      <div v-if="allDone && !filterQuery" class="all-done">
        <span class="all-done-icon"><AppIcon name="sparkle" :size="18" /></span>
        <div>
          <strong>All done!</strong>
          <span>Everything on this list is checked off.</span>
        </div>
      </div>

      <template v-if="pendingItems.length > 0">
        <h2 class="section-label">
          To do <span class="count">{{ pendingItems.length }}</span>
        </h2>
        <section class="card items-card">
          <TransitionGroup tag="ul" name="row" class="items-list">
            <ListItemRow v-for="item in pendingItems" :key="item.id" :item="item" />
          </TransitionGroup>
        </section>
      </template>

      <template v-if="completedItems.length > 0">
        <button
          type="button"
          class="section-label section-toggle"
          :aria-expanded="showCompleted"
          @click="showCompleted = !showCompleted"
        >
          Completed <span class="count">{{ completedItems.length }}</span>
          <AppIcon
            name="chevron-down"
            :size="16"
            class="toggle-chevron"
            :class="{ 'is-collapsed': !showCompleted }"
          />
        </button>
        <section v-if="showCompleted" class="card items-card completed-card">
          <TransitionGroup tag="ul" name="row" class="items-list">
            <ListItemRow v-for="item in completedItems" :key="item.id" :item="item" />
          </TransitionGroup>
        </section>
      </template>

      <div v-if="items.length === 0" class="empty-state">
        <span class="empty-icon"><AppIcon name="basket" :size="34" :stroke="1.7" /></span>
        <p class="empty-title">Empty list</p>
        <p class="empty-hint">Type above and press enter to add your first item.</p>
      </div>
      <p v-else-if="filteredItems.length === 0" class="empty-hint">
        No items match "{{ filterQuery }}".
      </p>

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
.hero {
  position: relative;
  padding: 1.2rem 1.2rem 1.1rem;
  margin-top: 0.4rem;
  overflow: visible;
  background-color: var(--c-bg-soft);
  background-image:
    radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 85% 60% / 0.22), transparent 60%),
    radial-gradient(
      90% 120% at 100% 100%,
      hsl(calc(var(--hue) + 28) 85% 60% / 0.14),
      transparent 65%
    );
}

.list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.hero-text {
  min-width: 0;
}

.hero h1 {
  font-size: clamp(1.6rem, 6vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.hero-meta {
  margin-top: 0.35rem;
  font-size: 0.85rem;
  color: var(--c-text-soft);
}

.hero-meta .dot {
  margin: 0 0.25rem;
}

.progress {
  height: 7px;
  border-radius: 7px;
  background-color: var(--c-border);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 7px;
  background-image: linear-gradient(
    90deg,
    hsl(var(--hue) 85% 62%),
    hsl(calc(var(--hue) + 28) 88% 58%)
  );
  box-shadow: 0 0 12px hsl(var(--hue) 90% 60% / 0.6);
  transition: width 0.7s var(--ease-out);
}

.is-complete .progress-fill {
  background-image: linear-gradient(90deg, var(--c-success), #7be8bd);
  box-shadow: 0 0 12px rgba(69, 214, 154, 0.6);
}

.pending-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.85rem;
  font-size: 0.8rem;
  color: var(--c-warning);
}

.all-done {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.5rem;
  padding: 0.85rem 1rem;
  border-radius: var(--radius-lg);
  background-color: var(--c-success-bg);
  border: 1px solid rgba(69, 214, 154, 0.3);
  color: var(--c-success);
  font-size: 0.85rem;
  animation: rise-in 0.5s var(--ease-out);
}

.all-done strong {
  display: block;
  font-weight: 700;
  font-size: 0.95rem;
}

.all-done-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background-color: var(--c-success-bg);
}

.section-toggle {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.section-toggle:hover {
  color: var(--c-heading);
}

.toggle-chevron {
  margin-left: auto;
  transition: transform 0.25s var(--ease-out);
}

.toggle-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.completed-card {
  background-color: transparent;
  box-shadow: none;
}

.row-enter-active,
.row-leave-active {
  transition:
    opacity 0.25s,
    transform 0.3s var(--ease-out);
}

.row-move {
  transition: transform 0.3s var(--ease-out);
}

.row-enter-from {
  opacity: 0;
  transform: translateX(-14px);
}

.row-leave-active {
  position: absolute;
  width: calc(100% - 1rem);
}

.row-leave-to {
  opacity: 0;
  transform: translateX(14px);
}

.items-card {
  position: relative;
}
</style>
