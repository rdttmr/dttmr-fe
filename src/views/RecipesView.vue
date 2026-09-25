<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import { useGroupsStore } from '@/stores/groups'
import type { LocalRecipe } from '@/database/db'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
import AppIcon from '@/components/AppIcon.vue'
import RecipeCard from '@/components/RecipeCard.vue'
import GroupFilter from '@/components/GroupFilter.vue'
import MoveToGroupModal from '@/components/MoveToGroupModal.vue'
import DeleteRecipeModal from '@/components/DeleteRecipeModal.vue'
import { useDragReorder } from '@/composables/useDragReorder'
import { mergeSubsetOrder } from '@/utils/orderRebase'

const recipesStore = useRecipesStore()
const groupsStore = useGroupsStore()

// Doubles as the "new recipe" text box and the live filter query on the
// list below, same as the item input on ListDetailView.
const newRecipeName = ref('')
const isCreating = ref(false)
const createError = ref('')
const movingRecipe = ref<LocalRecipe | null>(null)
const deletingRecipe = ref<LocalRecipe | null>(null)

onMounted(() => {
  groupsStore.loadGroups()
  recipesStore.loadRecipes()
})

// Filtering is local and fuzzy only, for display purposes - it never
// touches the server.
const filterQuery = computed(() => newRecipeName.value.trim())

const groupRecipes = computed(() => {
  const groupId = groupsStore.activeGroupId
  if (!groupId) return recipesStore.sortedRecipes
  return recipesStore.sortedRecipes.filter((recipe) => recipe.group_id === groupId)
})

const filteredRecipes = computed(() => {
  const query = filterQuery.value
  if (!query) return groupRecipes.value
  return groupRecipes.value.filter((recipe) => fuzzyMatch(query, recipe.name))
})

// Dragging is off while searching: a fuzzy match is a scattered subset, so
// moving a row among matches says little about where it belongs in the full
// order. The group filter is fine: a drag there reorders that group's recipes
// within the slots they already hold (see mergeSubsetOrder).
const canReorder = computed(() => !filterQuery.value)

function groupLabel(recipe: LocalRecipe): string | undefined {
  if (!groupsStore.hasMultipleGroups || groupsStore.activeGroupId) return undefined
  return groupsStore.groupName(recipe.group_id)
}

// Local, reorderable copy of what's on screen. Kept in sync with
// filteredRecipes except while a drag is in progress, so a mid-sync-pass
// update can't yank a row out from under the user's finger.
const displayedRecipes = ref<LocalRecipe[]>([])
const { draggingId, isPointerActive, dragOffsetPx, setItemRef, onPointerDown } = useDragReorder(
  displayedRecipes,
  (orderedIds) => {
    const fullIds = recipesStore.sortedRecipes.map((recipe) => recipe.id)
    void recipesStore.reorderRecipes(mergeSubsetOrder(fullIds, orderedIds))
  },
)

watch(
  filteredRecipes,
  (next) => {
    if (draggingId.value === null) displayedRecipes.value = [...next]
  },
  { immediate: true },
)

async function handleMove(groupId: string) {
  if (!movingRecipe.value) return
  const recipeId = movingRecipe.value.id
  movingRecipe.value = null
  createError.value = ''
  try {
    await recipesStore.moveRecipeToGroup(recipeId, groupId)
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to move recipe'
  }
}

function handleOpenDelete(recipe: LocalRecipe) {
  deletingRecipe.value = recipe
}

function handleCloseDelete() {
  deletingRecipe.value = null
}

async function handleConfirmDelete() {
  if (!deletingRecipe.value) return
  const recipeId = deletingRecipe.value.id
  deletingRecipe.value = null
  try {
    await recipesStore.deleteRecipe(recipeId)
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to delete recipe'
  }
}

async function handleCreateRecipe() {
  const name = filterQuery.value
  if (!name) return

  createError.value = ''
  isCreating.value = true
  try {
    await recipesStore.createRecipe(name, groupsStore.activeGroupId ?? undefined)
    newRecipeName.value = ''
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to create recipe'
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <p class="eyebrow">Collections</p>
      <h1>Recipes</h1>
      <p v-if="groupRecipes.length > 0" class="page-sub">
        {{ groupRecipes.length }}
        {{ groupRecipes.length === 1 ? 'recipe' : 'recipes' }} · reusable shopping bundles
      </p>
    </header>

    <GroupFilter />

    <form class="composer" @submit.prevent="handleCreateRecipe">
      <div class="field">
        <AppIcon name="search" class="composer-icon" />
        <input
          v-model="newRecipeName"
          type="text"
          placeholder="Search or create a recipe…"
          aria-label="New recipe name"
          :disabled="isCreating"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary add-btn"
        aria-label="Create recipe"
        :disabled="isCreating || !filterQuery"
      >
        <AppIcon name="plus" :size="22" :stroke="2.4" />
      </button>
    </form>

    <p v-if="createError" class="banner banner-error">{{ createError }}</p>

    <TransitionGroup
      v-if="displayedRecipes.length > 0"
      tag="ul"
      name="recipe-reorder"
      class="recipes stagger"
    >
      <li
        v-for="(recipe, index) in displayedRecipes"
        :key="recipe.clientId ?? recipe.id"
        :ref="(el) => setItemRef(recipe.id, el as Element | null)"
        class="recipe-row"
        :class="{ 'no-transition': isPointerActive && draggingId === recipe.id }"
        :style="{
          '--i': Math.min(index, 8),
          ...(draggingId === recipe.id ? { transform: `translateY(${dragOffsetPx}px)` } : {}),
        }"
      >
        <RecipeCard
          :recipe="recipe"
          :group-label="groupLabel(recipe)"
          :sortable="canReorder && displayedRecipes.length > 1"
          :dragging="draggingId === recipe.id"
          @move="movingRecipe = recipe"
          @delete="handleOpenDelete(recipe)"
          @handle-pointerdown="onPointerDown(recipe.id, $event)"
        />
      </li>
    </TransitionGroup>

    <div v-else-if="groupRecipes.length === 0" class="empty-state">
      <span class="empty-icon"><AppIcon name="chef" :size="34" :stroke="1.6" /></span>
      <p v-if="groupsStore.activeGroupId" class="empty-title">
        No recipes in {{ groupsStore.groupName(groupsStore.activeGroupId) }}
      </p>
      <p v-else class="empty-title">No recipes yet</p>
      <p class="empty-hint">Bundle items from your lists into a recipe you can reuse and share.</p>
    </div>

    <p v-else class="empty-hint">No recipes match "{{ filterQuery }}".</p>

    <MoveToGroupModal
      v-if="movingRecipe"
      kind="recipe"
      :name="movingRecipe.name"
      :current-group-id="movingRecipe.group_id"
      @close="movingRecipe = null"
      @move="handleMove"
    />
    <DeleteRecipeModal
      v-if="deletingRecipe"
      :recipe="deletingRecipe"
      @close="handleCloseDelete"
      @confirm="handleConfirmDelete"
    />
  </main>
</template>

<style scoped>
.recipes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.recipe-row {
  transition:
    transform 0.22s var(--ease-out),
    z-index 0s;
}

.recipe-row.no-transition {
  transition: none;
  z-index: 2;
  position: relative;
}

.recipe-reorder-move {
  transition: transform 0.28s var(--ease-out);
}

.recipe-reorder-enter-active,
.recipe-reorder-leave-active {
  transition:
    opacity 0.25s,
    transform 0.25s var(--ease-out);
}

.recipe-reorder-leave-active {
  position: absolute;
  width: 100%;
}

.recipe-reorder-enter-from,
.recipe-reorder-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
