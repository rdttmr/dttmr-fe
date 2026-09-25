<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Group } from '@/types/group'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { hueFromString } from '@/utils/hue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{ group: Group; canDelete?: boolean }>()
const emit = defineEmits<{
  share: []
  rename: []
  'make-default': []
  delete: []
}>()

const listsStore = useListsStore()
const recipesStore = useRecipesStore()
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

const listCount = computed(
  () => listsStore.lists.filter((list) => list.group_id === props.group.id).length,
)
const recipeCount = computed(
  () => recipesStore.recipes.filter((recipe) => recipe.group_id === props.group.id).length,
)
const memberCount = computed(() => props.group.member_count ?? 1)
const hue = computed(() => hueFromString(props.group.name))

function select(action: 'share' | 'rename' | 'make-default' | 'delete') {
  isMenuOpen.value = false
  // One emit per literal keeps defineEmits' typing happy.
  if (action === 'share') emit('share')
  else if (action === 'rename') emit('rename')
  else if (action === 'make-default') emit('make-default')
  else emit('delete')
}
</script>

<template>
  <div class="group-card card menu-lift" :style="{ '--hue': hue }">
    <RouterLink :to="`/groups/${group.id}`" class="group-card-link">
      <span class="tile" aria-hidden="true">
        <AppIcon name="users" :size="20" :stroke="2.1" />
      </span>

      <div class="group-main">
        <h3>
          {{ group.name }}
          <span v-if="group.is_default" class="pill pill-accent">Default</span>
        </h3>
        <p class="meta">
          {{ memberCount }} {{ memberCount === 1 ? 'member' : 'members' }} · {{ listCount }}
          {{ listCount === 1 ? 'list' : 'lists' }} · {{ recipeCount }}
          {{ recipeCount === 1 ? 'recipe' : 'recipes' }}
        </p>
      </div>
      <AppIcon name="chevron-right" class="chevron" :size="18" />
    </RouterLink>

    <div ref="menuContainerRef" class="menu-container">
      <button
        type="button"
        class="menu-trigger-btn"
        aria-label="Group options"
        aria-haspopup="true"
        :aria-expanded="isMenuOpen"
        title="More options"
        @click="toggleMenu"
      >
        <AppIcon name="more" :size="18" />
      </button>

      <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
        <button type="button" class="submenu-item" role="menuitem" @click="select('share')">
          <AppIcon name="share" :size="16" />
          <span>Invite someone</span>
        </button>
        <button type="button" class="submenu-item" role="menuitem" @click="select('rename')">
          <AppIcon name="edit" :size="16" />
          <span>Rename group</span>
        </button>
        <button
          v-if="!group.is_default"
          type="button"
          class="submenu-item"
          role="menuitem"
          @click="select('make-default')"
        >
          <AppIcon name="check" :size="16" />
          <span>Make default</span>
        </button>
        <button
          v-if="canDelete"
          type="button"
          class="submenu-item submenu-item-danger"
          role="menuitem"
          @click="select('delete')"
        >
          <AppIcon name="trash" :size="16" />
          <span>Delete group</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-card {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.85rem 0.6rem 0.85rem 0.9rem;
  background-color: var(--c-bg-soft);
  transition:
    border-color 0.2s,
    box-shadow 0.25s var(--ease-out);
}

.group-card:hover {
  border-color: var(--c-border-hover);
  box-shadow: var(--shadow-md);
}

.group-card-link {
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
}

.group-main {
  flex: 1;
  min-width: 0;
}

.group-main h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin-bottom: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 0.78rem;
  color: var(--c-text-soft);
}
.chevron {
  flex-shrink: 0;
  color: var(--c-text-soft);
  transition: transform 0.2s var(--ease-out);
}

.group-card:hover .chevron {
  transform: translateX(3px);
  color: var(--c-heading);
}
</style>
