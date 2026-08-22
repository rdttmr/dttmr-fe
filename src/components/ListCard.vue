<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import type { LocalList } from '@/database/db'
import { useListsStore } from '@/stores/lists'

const props = defineProps<{ list: LocalList }>()
const emit = defineEmits<{
  (e: 'share', list: LocalList): void
  (e: 'delete', list: LocalList): void
}>()

const listsStore = useListsStore()
const isMenuOpen = ref(false)
const menuContainerRef = ref<HTMLElement | null>(null)

const items = computed(() => listsStore.itemsForList(props.list.id))
const totalCount = computed(() => props.list.total_items ?? items.value.length)
const completedCount = computed(
  () => props.list.completed_items ?? items.value.filter((item) => item.is_completed).length,
)

function toggleMenu(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = !isMenuOpen.value
}

function handleShare(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  emit('share', props.list)
}

function handleDelete(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  emit('delete', props.list)
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
  <div class="list-card card">
    <RouterLink :to="`/lists/${list.id}`" class="list-card-link">
      <div class="list-card-main">
        <h3>{{ list.name }}</h3>
        <p class="meta">
          {{ completedCount }}/{{ totalCount }} done
          <span v-if="list.pendingSync" class="pending-tag">syncing…</span>
        </p>
      </div>
      <span class="chevron">›</span>
    </RouterLink>

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
        <button type="button" class="submenu-item" role="menuitem" @click="handleShare">
          <svg
            class="submenu-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span>Share list</span>
        </button>
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
          <span>Delete list</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  color: inherit;
  transition:
    border-color 0.15s ease-in-out,
    transform 0.1s ease-in-out;
}

.list-card:hover {
  border-color: var(--c-border-hover);
}

.list-card-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.list-card-link:active {
  transform: scale(0.995);
}

.list-card-main {
  flex: 1;
  min-width: 0;
}

.list-card-main h3 {
  font-size: 1.02rem;
  margin-bottom: 0.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 0.78rem;
  color: var(--c-text-soft);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pending-tag {
  color: var(--c-accent-strong);
}

.chevron {
  color: var(--c-text-soft);
  font-size: 1.3rem;
  line-height: 1;
  padding-right: 0.25rem;
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
