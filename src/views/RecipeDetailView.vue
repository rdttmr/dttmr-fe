<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import type { LocalListItem } from '@/database/db'
import RecipeItemRow from '@/components/RecipeItemRow.vue'
import DeleteRecipeModal from '@/components/DeleteRecipeModal.vue'
import ShareRecipeModal from '@/components/ShareRecipeModal.vue'
import AddRecipeItemsModal from '@/components/AddRecipeItemsModal.vue'
import { useDismissableMenu } from '@/composables/useDismissableMenu'

const props = defineProps<{ id: string }>()

const router = useRouter()
const recipesStore = useRecipesStore()

const showDeleteModal = ref(false)
const showShareModal = ref(false)
const showAddItemsModal = ref(false)
const actionError = ref('')
const isUnchecking = ref(false)
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

onMounted(() => {
  recipesStore.loadRecipes()
  recipesStore.loadRecipeItems(props.id)
})

watch(
  () => props.id,
  (newId) => {
    recipesStore.loadRecipeItems(newId)
  },
)

const recipe = computed(() => recipesStore.recipes.find((entry) => entry.id === props.id))
const items = computed(() => recipesStore.itemsForRecipe(props.id))

function byModifiedDesc(a: LocalListItem, b: LocalListItem) {
  return (b.modified_at ?? '').localeCompare(a.modified_at ?? '')
}

const pendingItems = computed(() =>
  items.value.filter((item) => !item.is_completed).sort(byModifiedDesc),
)
const completedItems = computed(() =>
  items.value.filter((item) => item.is_completed).sort(byModifiedDesc),
)

function handleOpenDelete() {
  isMenuOpen.value = false
  showDeleteModal.value = true
}

function handleCloseDelete() {
  showDeleteModal.value = false
}

async function handleConfirmDelete() {
  if (!recipe.value) return
  showDeleteModal.value = false
  try {
    await recipesStore.deleteRecipe(recipe.value.id)
    router.push('/recipes')
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Failed to delete recipe'
  }
}

function handleOpenShare() {
  isMenuOpen.value = false
  showShareModal.value = true
}

function handleCloseShare() {
  showShareModal.value = false
}

async function handleUncheckAll() {
  actionError.value = ''
  isUnchecking.value = true
  try {
    await recipesStore.uncheckRecipe(props.id)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Failed to uncheck items'
  } finally {
    isUnchecking.value = false
  }
}
</script>

<template>
  <main class="page">
    <button type="button" class="back-link" @click="router.push('/recipes')">‹ Recipes</button>

    <template v-if="recipe">
      <div class="recipe-header">
        <h1>{{ recipe.name }}</h1>

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
            <svg class="dots-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
            <button type="button" class="submenu-item" role="menuitem" @click="handleOpenShare">
              <span>Share recipe</span>
            </button>
            <button
              type="button"
              class="submenu-item submenu-item-danger"
              role="menuitem"
              @click="handleOpenDelete"
            >
              <span>Delete recipe</span>
            </button>
          </div>
        </div>
      </div>
      <p v-if="recipe.pendingSync" class="pending-note">
        This recipe hasn't synced to the server yet.
      </p>

      <div class="actions-row">
        <button type="button" class="btn btn-secondary" @click="showAddItemsModal = true">
          + Add items
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isUnchecking || completedItems.length === 0"
          @click="handleUncheckAll"
        >
          Uncheck all
        </button>
      </div>

      <p v-if="actionError" class="banner banner-error">{{ actionError }}</p>

      <section v-if="pendingItems.length > 0" class="card items-card">
        <ul class="items-list">
          <RecipeItemRow v-for="item in pendingItems" :key="item.id" :item="item" :recipe-id="props.id" />
        </ul>
      </section>

      <section v-if="completedItems.length > 0" class="card items-card completed-card">
        <h4>Completed</h4>
        <ul class="items-list">
          <RecipeItemRow
            v-for="item in completedItems"
            :key="item.id"
            :item="item"
            :recipe-id="props.id"
          />
        </ul>
      </section>

      <p v-if="items.length === 0" class="empty-hint">
        No items yet — use "Add items" to bring in items from your lists.
      </p>

      <DeleteRecipeModal
        v-if="showDeleteModal"
        :recipe="recipe"
        @close="handleCloseDelete"
        @confirm="handleConfirmDelete"
      />
      <ShareRecipeModal v-if="showShareModal" :recipe="recipe" @close="handleCloseShare" />
      <AddRecipeItemsModal
        v-if="showAddItemsModal"
        :recipe-id="props.id"
        @close="showAddItemsModal = false"
      />
    </template>

    <p v-else class="empty-hint">Recipe not found on this device.</p>
  </main>
</template>

<style scoped>
.back-link {
  background: none;
  border: none;
  color: var(--c-accent-strong);
  font-size: 0.9rem;
  padding: 0;
  margin-bottom: 0.75rem;
  cursor: pointer;
}

.recipe-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.recipe-header h1 {
  font-size: 1.35rem;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-note {
  font-size: 0.8rem;
  color: var(--c-warning);
  margin-bottom: 1rem;
}

.actions-row {
  display: flex;
  gap: 0.6rem;
  margin: 1rem 0;
}

.actions-row .btn {
  width: auto;
  flex: 1;
}

.items-card {
  padding: 0.2rem 0.9rem;
  margin-bottom: 1rem;
}

.completed-card h4 {
  padding: 0.7rem 0.2rem 0;
  font-size: 0.8rem;
  color: var(--c-text-soft);
}

.items-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  text-align: center;
  padding: 1.5rem 0;
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
