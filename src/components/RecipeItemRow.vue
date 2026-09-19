<script setup lang="ts">
import { ref } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import AppIcon from '@/components/AppIcon.vue'
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
      :aria-label="item.is_completed ? 'Mark as not done' : 'Mark as done'"
      @click="toggleCompleted"
    >
      <AppIcon name="check" :size="15" :stroke="3" />
    </button>

    <span class="title" @click="toggleCompleted"
      ><span class="title-text">{{ item.title }}</span></span
    >

    <span v-if="item.pendingSync" class="pending-dot" title="Not yet synced"></span>

    <button
      type="button"
      class="icon-btn remove-btn"
      aria-label="Remove from recipe"
      title="Remove from recipe"
      @click="handleRemove"
    >
      <AppIcon name="x" :size="16" />
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
.remove-btn:hover {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}
</style>
