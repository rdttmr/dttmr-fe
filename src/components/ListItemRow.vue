<script setup lang="ts">
import { ref } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useDismissableMenu } from '@/composables/useDismissableMenu'

const props = defineProps<{ item: LocalListItem }>()

const listsStore = useListsStore()
const isEditing = ref(false)
const editedTitle = ref(props.item.title)
// Captured separately from `editedTitle` at the moment editing starts: if the
// item is updated remotely (another device) while the field is open,
// `props.item.title` moves but this doesn't, so saveTitle() can tell "user
// didn't touch it" apart from "server changed underneath us" instead of
// diffing against the live (possibly just-changed) prop and overwriting the
// remote edit with the untouched original text.
const originalTitle = ref(props.item.title)
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

function toggleCompleted() {
  listsStore.setListItemCompleted(props.item.id, !props.item.is_completed)
}

function startEditing() {
  editedTitle.value = props.item.title
  originalTitle.value = props.item.title
  isEditing.value = true
}

function saveTitle() {
  const title = editedTitle.value.trim()
  if (title && title !== originalTitle.value) {
    listsStore.updateListItem(props.item.id, { title })
  }
  isEditing.value = false
}

function handleDelete(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  listsStore.deleteListItem(props.item.id)
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

    <div ref="menuContainerRef" class="menu-container">
      <button
        type="button"
        class="menu-trigger-btn"
        aria-label="Item options"
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
          @click="handleDelete"
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
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span>Delete item</span>
        </button>
      </div>
    </div>
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

.menu-container {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.menu-trigger-btn {
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
