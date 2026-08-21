<script setup lang="ts">
import { ref } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'

const props = defineProps<{ item: LocalListItem }>()

const listsStore = useListsStore()
const isEditing = ref(false)
const editedTitle = ref(props.item.title)

function toggleCompleted() {
  listsStore.setListItemCompleted(props.item.id, !props.item.is_completed)
}

function startEditing() {
  editedTitle.value = props.item.title
  isEditing.value = true
}

function saveTitle() {
  const title = editedTitle.value.trim()
  if (title && title !== props.item.title) {
    listsStore.updateListItem(props.item.id, { title })
  }
  isEditing.value = false
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

    <input
      v-if="isEditing"
      v-model="editedTitle"
      class="title-input"
      type="text"
      @keyup.enter="saveTitle"
      @keyup.escape="isEditing = false"
      @blur="saveTitle"
    />
    <span v-else class="title" @click="startEditing">{{ item.title }}</span>

    <span v-if="item.pendingSync" class="pending-dot" title="Not yet synced"></span>
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
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid var(--c-border-hover);
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
}

.item-row.completed .checkbox {
  background: linear-gradient(135deg, var(--c-accent-strong), var(--c-accent-soft));
  border-color: transparent;
}

.title {
  flex: 1;
  font-size: 0.95rem;
  cursor: text;
  word-break: break-word;
}

.item-row.completed .title {
  color: var(--c-text-soft);
  text-decoration: line-through;
}

.title-input {
  flex: 1;
  padding: 0.3rem 0.5rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-accent);
  background-color: var(--c-bg-mute);
  color: var(--c-heading);
  font-size: 0.95rem;
  outline: none;
}

.pending-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--c-warning);
  flex-shrink: 0;
}
</style>
