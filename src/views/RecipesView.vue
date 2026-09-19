<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import type { LocalRecipe } from '@/database/db'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
import AppIcon from '@/components/AppIcon.vue'
import RecipeCard from '@/components/RecipeCard.vue'
import ShareRecipeModal from '@/components/ShareRecipeModal.vue'
import DeleteRecipeModal from '@/components/DeleteRecipeModal.vue'

const recipesStore = useRecipesStore()

// Doubles as the "new recipe" text box and the live filter query on the
// list below, same as the item input on ListDetailView.
const newRecipeName = ref('')
const isCreating = ref(false)
const createError = ref('')
const sharingRecipe = ref<LocalRecipe | null>(null)
const deletingRecipe = ref<LocalRecipe | null>(null)

onMounted(() => {
  recipesStore.loadRecipes()
})

// Filtering is local and fuzzy only, for display purposes - it never
// touches the server.
const filterQuery = computed(() => newRecipeName.value.trim())

const filteredRecipes = computed(() => {
  const query = filterQuery.value
  if (!query) return recipesStore.sortedRecipes
  return recipesStore.sortedRecipes.filter((recipe) => fuzzyMatch(query, recipe.name))
})

function handleOpenShare(recipe: LocalRecipe) {
  sharingRecipe.value = recipe
}

function handleCloseShare() {
  sharingRecipe.value = null
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
    await recipesStore.createRecipe(name)
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
      <p v-if="recipesStore.sortedRecipes.length > 0" class="page-sub">
        {{ recipesStore.sortedRecipes.length }}
        {{ recipesStore.sortedRecipes.length === 1 ? 'recipe' : 'recipes' }} · reusable shopping
        bundles
      </p>
    </header>

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

    <ul v-if="filteredRecipes.length > 0" class="recipes stagger">
      <li
        v-for="(recipe, index) in filteredRecipes"
        :key="recipe.clientId ?? recipe.id"
        :style="{ '--i': Math.min(index, 8) }"
      >
        <RecipeCard
          :recipe="recipe"
          @share="handleOpenShare(recipe)"
          @delete="handleOpenDelete(recipe)"
        />
      </li>
    </ul>

    <div v-else-if="recipesStore.sortedRecipes.length === 0" class="empty-state">
      <span class="empty-icon"><AppIcon name="chef" :size="34" :stroke="1.6" /></span>
      <p class="empty-title">No recipes yet</p>
      <p class="empty-hint">Bundle items from your lists into a recipe you can reuse and share.</p>
    </div>

    <p v-else class="empty-hint">No recipes match "{{ filterQuery }}".</p>

    <ShareRecipeModal v-if="sharingRecipe" :recipe="sharingRecipe" @close="handleCloseShare" />
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
</style>
