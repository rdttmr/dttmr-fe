<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
import AppIcon from '@/components/AppIcon.vue'
import { hueFromString } from '@/utils/hue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{ recipeId: string }>()

const emit = defineEmits<{
  close: []
}>()

const listsStore = useListsStore()
const recipesStore = useRecipesStore()

const selectedListId = ref<string | null>(null)
const listFilterQuery = ref('')
const itemFilterQuery = ref('')
const isLoadingItems = ref(false)

onMounted(() => {
  listsStore.loadLists()
})

const filteredLists = computed(() => {
  const query = listFilterQuery.value.trim()
  if (!query) return listsStore.sortedLists
  return listsStore.sortedLists.filter((list) => fuzzyMatch(query, list.name))
})

async function selectList(listId: string) {
  selectedListId.value = listId
  itemFilterQuery.value = ''
  isLoadingItems.value = true
  try {
    await listsStore.loadListItems(listId)
  } finally {
    isLoadingItems.value = false
  }
}

function backToLists() {
  selectedListId.value = null
}

const selectedList = computed(
  () => listsStore.lists.find((list) => list.id === selectedListId.value) ?? null,
)

const allItemsForSelectedList = computed(() =>
  selectedListId.value ? listsStore.itemsForList(selectedListId.value) : [],
)

const filteredItemsForSelectedList = computed(() => {
  const query = itemFilterQuery.value.trim()
  if (!query) return allItemsForSelectedList.value
  return allItemsForSelectedList.value.filter((item) => fuzzyMatch(query, item.title))
})

function isIncluded(itemId: string) {
  return recipesStore.isItemInRecipe(props.recipeId, itemId)
}

function toggleItem(itemId: string) {
  if (isIncluded(itemId)) {
    void recipesStore.removeItemFromRecipe(props.recipeId, itemId)
  } else {
    void recipesStore.addItemToRecipe(props.recipeId, itemId)
  }
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <BaseModal
    title="Add items"
    title-id="add-recipe-items-modal-title"
    icon="basket"
    wide
    scrollable
    @close="handleClose"
  >
    <div class="picker">
      <template v-if="!selectedListId">
        <p class="modal-description">Pick a list to add items from.</p>

        <div v-if="listsStore.sortedLists.length > 1" class="field search-field">
          <input v-model="listFilterQuery" type="text" placeholder="Filter lists…" />
        </div>

        <div class="picker-scroll">
          <ul v-if="filteredLists.length > 0" class="picker-list">
            <li v-for="list in filteredLists" :key="list.clientId ?? list.id">
              <button
                type="button"
                class="picker-row"
                :style="{ '--hue': hueFromString(list.name) }"
                @click="selectList(list.id)"
              >
                <span class="avatar">{{ initial(list.name) }}</span>
                <span class="row-main">
                  <span class="row-title">{{ list.name }}</span>
                  <span class="row-subtitle">
                    {{ list.total_items ?? 0 }} item{{ list.total_items === 1 ? '' : 's' }}
                  </span>
                </span>
                <AppIcon name="chevron-right" class="chevron" :size="18" />
              </button>
            </li>
          </ul>
          <p v-else-if="listsStore.sortedLists.length === 0" class="empty-hint">
            You don't have any lists yet.
          </p>
          <p v-else class="empty-hint">No lists match "{{ listFilterQuery }}".</p>
        </div>
      </template>

      <template v-else>
        <div class="item-picker-header">
          <button type="button" class="back-link" @click="backToLists">
            <AppIcon name="chevron-left" :size="16" :stroke="2.4" />
            {{ selectedList?.name ?? 'Lists' }}
          </button>
          <div class="field search-field">
            <input v-model="itemFilterQuery" type="text" placeholder="Filter items…" />
          </div>
        </div>

        <div class="picker-scroll">
          <p v-if="isLoadingItems" class="empty-hint">Loading items…</p>
          <ul v-else-if="filteredItemsForSelectedList.length > 0" class="picker-list">
            <li v-for="item in filteredItemsForSelectedList" :key="item.id">
              <button
                type="button"
                class="picker-row pick-item"
                :class="{ 'is-included': isIncluded(item.id) }"
                :aria-pressed="isIncluded(item.id)"
                @click="toggleItem(item.id)"
              >
                <span class="pick-check">
                  <AppIcon name="check" :size="14" :stroke="3" />
                </span>
                <span class="row-title item-title">{{ item.title }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="allItemsForSelectedList.length === 0" class="empty-hint">
            No items in this list yet.
          </p>
          <p v-else class="empty-hint">No items match "{{ itemFilterQuery }}".</p>
        </div>
      </template>
    </div>

    <template #footer>
      <button type="button" class="btn btn-primary" @click="handleClose">Done</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.picker {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.modal-description {
  font-size: 0.9rem;
  color: var(--c-text-soft);
  margin-bottom: 0.85rem;
  flex-shrink: 0;
}

.item-picker-header {
  flex-shrink: 0;
}

.item-picker-header .back-link {
  margin-top: 0;
}

.search-field {
  flex-shrink: 0;
  margin-bottom: 0.6rem;
}

.search-field input {
  padding: 0.65rem 0.9rem;
  font-size: 0.95rem;
}

.picker-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0 -0.5rem;
  padding: 0 0.5rem;
}

.picker-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.6rem 0.7rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--c-heading);
  font-size: 0.95rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    transform 0.15s var(--ease-out);
}

.picker-row:hover {
  background-color: var(--c-surface-hover);
}

.picker-row:active {
  transform: scale(0.985);
}

.avatar {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  color: #fff;
  background-image: linear-gradient(
    135deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 54%)
  );
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1rem;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.row-subtitle {
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.chevron {
  flex-shrink: 0;
  color: var(--c-text-soft);
}

.pick-item {
  padding-top: 0.7rem;
  padding-bottom: 0.7rem;
}

.pick-item.is-included {
  background-color: var(--c-accent-bg);
  border-color: var(--c-border-hover);
}

.pick-item.is-included .item-title {
  color: var(--c-accent-strong);
}

.item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  white-space: normal;
}

.pick-check {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--c-border-hover);
  color: #fff;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    transform 0.25s var(--ease-spring);
}

.pick-check .icon {
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 0.15s,
    transform 0.25s var(--ease-spring);
}

.pick-item.is-included .pick-check {
  background-image: var(--grad-accent);
  border-color: transparent;
}

.pick-item.is-included .pick-check .icon {
  opacity: 1;
  transform: scale(1);
}
</style>
