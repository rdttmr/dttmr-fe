<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRecipesStore } from '@/stores/recipes'
import type { LocalRecipe } from '@/database/db'
import { fuzzyMatch } from '@/utils/fuzzyMatch'
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
    <h1>Your Recipes</h1>

    <form class="new-recipe-form" @submit.prevent="handleCreateRecipe">
      <div class="field">
        <input
          v-model="newRecipeName"
          type="text"
          placeholder="New recipe name…"
          :disabled="isCreating"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary add-btn"
        :disabled="isCreating || !filterQuery"
      >
        +
      </button>
    </form>

    <p v-if="createError" class="banner banner-error">{{ createError }}</p>

    <ul v-if="filteredRecipes.length > 0" class="recipes">
      <li v-for="recipe in filteredRecipes" :key="recipe.clientId ?? recipe.id">
        <RecipeCard
          :recipe="recipe"
          @share="handleOpenShare(recipe)"
          @delete="handleOpenDelete(recipe)"
        />
      </li>
    </ul>

    <div v-else-if="recipesStore.sortedRecipes.length === 0" class="empty-state">
      <p>No recipes yet</p>
      <p class="empty-hint">Create your first recipe above to get started.</p>
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
h1 {
  font-size: 1.4rem;
  margin-bottom: 0.25rem;
}

.new-recipe-form {
  display: flex;
  gap: 0.6rem;
  margin: 1rem 0;
}

.new-recipe-form .field {
  flex: 1;
}

.add-btn {
  width: 46px;
  flex-shrink: 0;
  font-size: 1.3rem;
  line-height: 1;
}

.recipes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--c-text-soft);
}

.empty-state p:first-child {
  color: var(--c-heading);
  font-weight: 500;
  margin-bottom: 0.35rem;
}

.empty-hint {
  font-size: 0.85rem;
}
</style>
