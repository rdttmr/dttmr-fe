<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { LocalRecipe } from '@/database/db'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { useRecipesStore } from '@/stores/recipes'
import { hueFromString } from '@/utils/hue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{ recipe: LocalRecipe }>()
const emit = defineEmits<{
  share: [recipe: LocalRecipe]
  delete: [recipe: LocalRecipe]
}>()

const recipesStore = useRecipesStore()

const hue = computed(() => hueFromString(props.recipe.name))
const itemCount = computed(() => recipesStore.itemsForRecipe(props.recipe.id).length)

const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

function handleShare(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  emit('share', props.recipe)
}

function handleDelete(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  isMenuOpen.value = false
  emit('delete', props.recipe)
}
</script>

<template>
  <div class="recipe-card card menu-lift" :style="{ '--hue': hue }">
    <RouterLink :to="`/recipes/${recipe.id}`" class="recipe-card-link">
      <span class="tile" aria-hidden="true">
        <AppIcon name="chef" :size="22" :stroke="1.9" />
      </span>
      <div class="recipe-card-main">
        <h3>{{ recipe.name }}</h3>
        <p class="meta">
          <template v-if="itemCount > 0">
            <span class="mono-num">{{ itemCount }}</span>
            {{ itemCount === 1 ? 'ingredient' : 'ingredients' }}
          </template>
          <template v-else>No items yet</template>
          <span v-if="recipe.pendingSync" class="pending-tag">syncing…</span>
        </p>
      </div>
      <AppIcon name="chevron-right" class="chevron" :size="18" />
    </RouterLink>

    <div ref="menuContainerRef" class="menu-container">
      <button
        type="button"
        class="menu-trigger-btn"
        aria-label="Recipe options"
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
          <span>Share recipe</span>
        </button>
        <button
          type="button"
          class="submenu-item submenu-item-danger"
          role="menuitem"
          @click="handleDelete"
        >
          <AppIcon name="trash" :size="16" />
          <span>Delete recipe</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recipe-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.8rem 0.6rem 0.8rem 0.85rem;
  color: inherit;
  background-color: var(--c-bg-soft);
  transition:
    border-color 0.2s,
    box-shadow 0.25s var(--ease-out);
}

.recipe-card:hover {
  border-color: var(--c-border-hover);
  box-shadow: var(--shadow-md);
}

.recipe-card-link {
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
  width: 50px;
  height: 50px;
  border-radius: 50%;
  color: hsl(var(--hue) 90% 72%);
  background-color: hsl(var(--hue) 80% 60% / 0.14);
  box-shadow: inset 0 0 0 1.5px hsl(var(--hue) 80% 65% / 0.35);
  transition:
    transform 0.3s var(--ease-spring),
    background-color 0.2s;
}

.recipe-card:hover .tile {
  transform: rotate(8deg) scale(1.06);
  background-color: hsl(var(--hue) 80% 60% / 0.22);
}

.recipe-card-main {
  flex: 1;
  min-width: 0;
}

.recipe-card-main h3 {
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
}

.pending-tag {
  color: var(--c-warning);
}

.chevron {
  color: var(--c-text-soft);
  transition: transform 0.2s var(--ease-out);
}

.recipe-card:hover .chevron {
  transform: translateX(3px);
  color: var(--c-heading);
}
</style>
