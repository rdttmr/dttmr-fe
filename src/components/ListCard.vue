<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { LocalList } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { hueFromString } from '@/utils/hue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{ list: LocalList; dragging?: boolean }>()
const emit = defineEmits<{
  share: [list: LocalList]
  delete: [list: LocalList]
  'handle-pointerdown': [event: PointerEvent]
}>()

const listsStore = useListsStore()
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

// The server always reports total_items/completed_items once a list has
// synced at least once, so the common case never touches the store's full
// item list at all - only a list that hasn't synced yet falls back to
// scanning its own items.
const totalCount = computed(() =>
  props.list.total_items !== undefined
    ? props.list.total_items
    : listsStore.itemsForList(props.list.id).length,
)
const completedCount = computed(() =>
  props.list.completed_items !== undefined
    ? props.list.completed_items
    : listsStore.itemsForList(props.list.id).filter((item) => item.is_completed).length,
)

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

const hue = computed(() => hueFromString(props.list.name))
const percent = computed(() =>
  totalCount.value > 0 ? Math.round((completedCount.value / totalCount.value) * 100) : 0,
)
const isComplete = computed(() => totalCount.value > 0 && completedCount.value === totalCount.value)
</script>

<template>
  <div
    class="list-card card menu-lift"
    :class="{ 'is-dragging': dragging, 'is-complete': isComplete }"
    :style="{ '--hue': hue }"
  >
    <button
      type="button"
      class="grab-handle"
      aria-label="Reorder list"
      title="Drag to reorder"
      @pointerdown="emit('handle-pointerdown', $event)"
    >
      <AppIcon name="grip" :size="16" />
    </button>

    <RouterLink :to="`/lists/${list.id}`" class="list-card-link">
      <span class="tile" aria-hidden="true">
        <AppIcon :name="isComplete ? 'check' : 'list'" :size="20" :stroke="2.2" />
      </span>
      <div class="list-card-main">
        <h3>{{ list.name }}</h3>
        <p class="meta">
          <span class="mono-num">{{ completedCount }}/{{ totalCount }}</span> done
          <span v-if="list.pendingSync" class="pending-tag">syncing…</span>
        </p>
        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="progress-fill" :style="{ width: `${percent}%` }"></span>
        </div>
      </div>
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
        <AppIcon name="more" :size="18" />
      </button>

      <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
        <button type="button" class="submenu-item" role="menuitem" @click="handleShare">
          <AppIcon name="share" :size="16" />
          <span>Share list</span>
        </button>
        <button
          type="button"
          class="submenu-item submenu-item-danger"
          role="menuitem"
          @click="handleDelete"
        >
          <AppIcon name="trash" :size="16" />
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
  gap: 0.35rem;
  padding: 0.85rem 0.6rem 0.85rem 0.35rem;
  color: inherit;
  background-color: var(--c-bg-soft);
  transition:
    border-color 0.2s,
    box-shadow 0.25s var(--ease-out),
    transform 0.2s var(--ease-out);
}

.list-card:hover {
  border-color: var(--c-border-hover);
  box-shadow: var(--shadow-md);
}

.list-card.is-dragging {
  border-color: var(--c-accent-strong);
  box-shadow:
    var(--shadow-lg),
    0 0 0 3px var(--c-focus);
  transform: scale(1.02);
}

.grab-handle {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 48px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--c-text-soft);
  opacity: 0.55;
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  transition:
    opacity 0.15s,
    color 0.15s;
}

.list-card:hover .grab-handle,
.grab-handle:hover {
  opacity: 1;
  color: var(--c-heading);
}

.list-card.is-dragging .grab-handle {
  cursor: grabbing;
  opacity: 1;
  color: var(--c-accent-strong);
}

.list-card-link {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.tile {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 15px;
  color: #fff;
  background-image: linear-gradient(
    135deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 54%)
  );
  box-shadow:
    0 6px 16px hsl(var(--hue) 80% 50% / 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: transform 0.3s var(--ease-spring);
}

.list-card:hover .tile {
  transform: rotate(-5deg) scale(1.06);
}

.list-card-main {
  flex: 1;
  min-width: 0;
}

.list-card-main h3 {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 0.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--c-text-soft);
  margin-bottom: 0.5rem;
}

.pending-tag {
  color: var(--c-warning);
}

.progress {
  height: 5px;
  border-radius: 5px;
  background-color: var(--c-border);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 5px;
  background-image: linear-gradient(
    90deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 58%)
  );
  transition: width 0.6s var(--ease-out);
}

.is-complete .progress-fill {
  background-image: linear-gradient(90deg, var(--c-success), #7be8bd);
}

.is-complete .tile {
  background-image: linear-gradient(135deg, #2fcf8f, #1fa97a);
  box-shadow:
    0 6px 16px rgba(47, 207, 143, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
</style>
