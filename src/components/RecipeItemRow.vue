<script setup lang="ts">
import { ref } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'

const props = defineProps<{ item: LocalListItem; recipeId: string }>()

const listsStore = useListsStore()
const recipesStore = useRecipesStore()

const showRemoveModal = ref(false)

function toggleCompleted() {
  listsStore.setListItemCompleted(props.item.id, !props.item.is_completed)
}

function handleRemove() {
  showRemoveModal.value = true
}

function handleRemoveCancel() {
  showRemoveModal.value = false
}

function handleRemoveConfirm() {
  showRemoveModal.value = false
  recipesStore.removeItemFromRecipe(props.recipeId, props.item.id)
}
</script>

<template>
  <li class="item-row" :class="{ completed: item.is_completed }">
    <button
      type="button"
      class="checkbox"
      :aria-pressed="item.is_completed"
      @click="toggleCompleted"
    >
      <span v-if="item.is_completed">✓</span>
    </button>

    <span class="title" @click="toggleCompleted">{{ item.title }}</span>

    <span v-if="item.pendingSync" class="pending-dot" title="Not yet synced"></span>

    <button
      type="button"
      class="remove-btn"
      aria-label="Remove from recipe"
      title="Remove from recipe"
      @click="handleRemove"
    >
      ✕
    </button>

    <ConfirmDeleteModal
      v-if="showRemoveModal"
      :title="`Remove &quot;${item.title}&quot;?`"
      description="Are you sure you want to remove this item from the recipe?"
      confirm-label="Remove"
      @close="handleRemoveCancel"
      @confirm="handleRemoveConfirm"
    />
  </li>
</template>

<style scoped>
.item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.2rem;
  border-bottom: 1px solid var(--c-border);
}

.item-row:last-child {
  border-bottom: none;
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
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 700;
}

.item-row.completed .checkbox {
  background: var(--c-accent);
  border-color: var(--c-accent);
}

.title {
  flex: 1;
  font-size: 0.95rem;
  cursor: pointer;
  word-break: break-word;
}

.item-row.completed .title {
  color: var(--c-text-soft);
  text-decoration: line-through;
}

.pending-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--c-warning);
  flex-shrink: 0;
}

.remove-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--c-text-soft);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  padding: 0;
  transition:
    background-color 0.15s ease-in-out,
    color 0.15s ease-in-out;
}

.remove-btn:hover {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}
</style>
