<script setup lang="ts">
import { ref } from 'vue'
import type { LocalListItem } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import AppIcon from '@/components/AppIcon.vue'
import DeleteListItemModal from '@/components/DeleteListItemModal.vue'

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
const showDeleteModal = ref(false)
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

function toggleCompleted() {
  listsStore.setListItemCompleted(props.item.id, !props.item.is_completed)
}

function handleTitleClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickRatio = (event.clientX - rect.left) / rect.width
  if (clickRatio <= 0.6) {
    toggleCompleted()
  } else {
    startEditing()
  }
}

function startEditing() {
  isMenuOpen.value = false
  editedTitle.value = props.item.title
  originalTitle.value = props.item.title
  isEditing.value = true
}

function saveTitle() {
  const title = editedTitle.value.trim()
  if (title && title !== originalTitle.value) {
    listsStore.updateListItemTitle(props.item.id, title)
  }
  isEditing.value = false
}

function handleOpenDelete() {
  isMenuOpen.value = false
  showDeleteModal.value = true
}

function handleCloseDelete() {
  showDeleteModal.value = false
}

function handleConfirmDelete() {
  showDeleteModal.value = false
  listsStore.deleteListItem(props.item.id)
}
</script>

<template>
  <li class="item-row menu-lift" :class="{ completed: item.is_completed }">
    <button
      type="button"
      class="checkbox"
      :aria-pressed="item.is_completed"
      :aria-label="item.is_completed ? 'Mark as not done' : 'Mark as done'"
      @click="toggleCompleted"
    >
      <AppIcon name="check" :size="15" :stroke="3" />
    </button>

    <input
      v-if="isEditing"
      v-model="editedTitle"
      class="title-input"
      type="text"
      aria-label="Item title"
      @keyup.enter="saveTitle"
      @keyup.escape="isEditing = false"
      @blur="saveTitle"
    />
    <span v-else class="title" @click="handleTitleClick"
      ><span class="title-text">{{ item.title }}</span></span
    >

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
        <AppIcon name="more" :size="18" />
      </button>

      <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
        <button type="button" class="submenu-item" role="menuitem" @click="startEditing">
          <AppIcon name="edit" :size="16" />
          <span>Edit title</span>
        </button>
        <button
          type="button"
          class="submenu-item submenu-item-danger"
          role="menuitem"
          @click="handleOpenDelete"
        >
          <AppIcon name="trash" :size="16" />
          <span>Delete item</span>
        </button>
      </div>
    </div>

    <DeleteListItemModal
      v-if="showDeleteModal"
      :item="item"
      @close="handleCloseDelete"
      @confirm="handleConfirmDelete"
    />
  </li>
</template>
