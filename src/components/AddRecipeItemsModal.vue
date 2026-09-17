<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
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
  <BaseModal title="Add items" title-id="add-recipe-items-modal-title" wide scrollable @close="handleClose">
    <div class="picker">
      <template v-if="!selectedListId">
        <p class="modal-description">Pick a list to add items from.</p>

        <div v-if="listsStore.sortedLists.length > 1" class="field search-field">
          <input v-model="listFilterQuery" type="text" placeholder="Filter lists…" />
        </div>

        <div class="picker-scroll">
          <ul v-if="filteredLists.length > 0" class="picker-list">
            <li v-for="list in filteredLists" :key="list.clientId ?? list.id">
              <button type="button" class="picker-row list-row" @click="selectList(list.id)">
                <span class="avatar">{{ initial(list.name) }}</span>
                <span class="row-main">
                  <span class="row-title">{{ list.name }}</span>
                  <span class="row-subtitle">
                    {{ list.total_items ?? 0 }} item{{ list.total_items === 1 ? '' : 's' }}
                  </span>
                </span>
                <span class="chevron">›</span>
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
            ‹ {{ selectedList?.name ?? 'Lists' }}
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
                class="picker-row item-row"
                :class="{ 'is-included': isIncluded(item.id) }"
                :aria-pressed="isIncluded(item.id)"
                @click="toggleItem(item.id)"
              >
                <span class="checkbox">
                  <span v-if="isIncluded(item.id)">✓</span>
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
      <button type="button" class="btn btn-secondary" @click="handleClose">Done</button>
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
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin-bottom: 0.85rem;
  flex-shrink: 0;
}

.item-picker-header {
  flex-shrink: 0;
}

.back-link {
  background: none;
  border: none;
  color: var(--c-accent-strong);
  font-size: 0.85rem;
  padding: 0;
  margin-bottom: 0.75rem;
  cursor: pointer;
}

.search-field {
  flex-shrink: 0;
  margin-bottom: 0.6rem;
}

.picker-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.picker-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  padding: 0.55rem 0.6rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--c-heading);
  font-size: 0.92rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s ease-in-out,
    border-color 0.15s ease-in-out;
}

.picker-row:hover {
  background-color: var(--c-bg-mute);
  border-color: var(--c-border);
}

.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.row-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-subtitle {
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.chevron {
  flex-shrink: 0;
  color: var(--c-text-soft);
  font-size: 1.1rem;
  line-height: 1;
}

.item-row {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
}

.item-row.is-included {
  background-color: var(--c-accent-bg);
  border-color: var(--c-border-hover);
}

.item-row.is-included .item-title {
  color: var(--c-accent-strong);
}

.item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  white-space: normal;
}

.checkbox {
  flex-shrink: 0;
  width: 21px;
  height: 21px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--c-border-hover);
  background: transparent;
  color: var(--c-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
}

.item-row.is-included .checkbox {
  background: var(--c-accent);
  border-color: var(--c-accent);
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  text-align: center;
  padding: 2rem 0;
}
</style>
