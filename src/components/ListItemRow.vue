<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'

const props = defineProps<{ item: LocalListItem }>()
const emit = defineEmits<{
  (e: 'delete', item: LocalListItem): void
}>()

const listsStore = useListsStore()
const isEditing = ref(false)
const editedTitle = ref(props.item.title)
const isMenuOpen = ref(false)
const menuContainerRef = ref<HTMLElement | null>(null)

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

function toggleMenu(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = !isMenuOpen.value
}

function handleDelete(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  emit('delete', props.item)
  listsStore.deleteListItem(props.item.id)
}

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
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
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
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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
