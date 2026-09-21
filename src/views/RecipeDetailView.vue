<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import type { LocalListItem } from '@/database/db'
import AppIcon from '@/components/AppIcon.vue'
import RecipeItemRow from '@/components/RecipeItemRow.vue'
import DeleteRecipeModal from '@/components/DeleteRecipeModal.vue'
import RenameModal from '@/components/RenameModal.vue'
import ShareRecipeModal from '@/components/ShareRecipeModal.vue'
import AddRecipeItemsModal from '@/components/AddRecipeItemsModal.vue'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { hueFromString } from '@/utils/hue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const recipesStore = useRecipesStore()

const showDeleteModal = ref(false)
const showRenameModal = ref(false)
const showCompleted = ref(true)
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

const doneCount = computed(() => items.value.filter((item) => item.is_completed).length)
const percent = computed(() =>
  items.value.length > 0 ? Math.round((doneCount.value / items.value.length) * 100) : 0,
)
const hue = computed(() => hueFromString(recipe.value?.name ?? ''))

function handleOpenRename() {
  isMenuOpen.value = false
  showRenameModal.value = true
}

async function handleRename(name: string) {
  if (!recipe.value) return
  showRenameModal.value = false
  actionError.value = ''
  try {
    await recipesStore.renameRecipe(recipe.value.id, name)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Failed to rename recipe'
  }
}

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
    <button type="button" class="back-link" @click="router.push('/recipes')">
      <AppIcon name="chevron-left" :size="18" :stroke="2.4" />
      Recipes
    </button>

    <template v-if="recipe">
      <section class="hero card menu-lift" :style="{ '--hue': hue }">
        <div class="recipe-header">
          <span class="hero-tile" aria-hidden="true"
            ><AppIcon name="chef" :size="26" :stroke="1.8"
          /></span>
          <div class="hero-text">
            <h1>{{ recipe.name }}</h1>
            <p class="hero-meta">
              <template v-if="items.length > 0">
                <span class="mono-num">{{ doneCount }}/{{ items.length }}</span> checked
              </template>
              <template v-else>No items yet</template>
            </p>
          </div>

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
              <button type="button" class="submenu-item" role="menuitem" @click="handleOpenRename">
                <AppIcon name="edit" :size="16" />
                <span>Rename recipe</span>
              </button>
              <button type="button" class="submenu-item" role="menuitem" @click="handleOpenShare">
                <AppIcon name="share" :size="16" />
                <span>Share recipe</span>
              </button>
              <button
                type="button"
                class="submenu-item submenu-item-danger"
                role="menuitem"
                @click="handleOpenDelete"
              >
                <AppIcon name="trash" :size="16" />
                <span>Delete recipe</span>
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="items.length > 0"
          class="progress"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="progress-fill" :style="{ width: `${percent}%` }"></span>
        </div>
      </section>

      <p v-if="recipe.pendingSync" class="pending-note">
        <AppIcon name="cloud" :size="14" /> This recipe hasn't synced to the server yet.
      </p>

      <div class="actions-row">
        <button type="button" class="btn btn-primary" @click="showAddItemsModal = true">
          <AppIcon name="plus" :size="18" :stroke="2.4" /> Add items
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="isUnchecking || completedItems.length === 0"
          @click="handleUncheckAll"
        >
          <AppIcon name="refresh" :size="17" /> Uncheck all
        </button>
      </div>

      <p v-if="actionError" class="banner banner-error">{{ actionError }}</p>

      <template v-if="pendingItems.length > 0">
        <h2 class="section-label">
          Ingredients <span class="count">{{ pendingItems.length }}</span>
        </h2>
        <section class="card items-card">
          <TransitionGroup tag="ul" name="row" class="items-list">
            <RecipeItemRow
              v-for="item in pendingItems"
              :key="item.id"
              :item="item"
              :recipe-id="props.id"
            />
          </TransitionGroup>
        </section>
      </template>

      <template v-if="completedItems.length > 0">
        <button
          type="button"
          class="section-label section-toggle"
          :aria-expanded="showCompleted"
          @click="showCompleted = !showCompleted"
        >
          Completed <span class="count">{{ completedItems.length }}</span>
          <AppIcon
            name="chevron-down"
            :size="16"
            class="toggle-chevron"
            :class="{ 'is-collapsed': !showCompleted }"
          />
        </button>
        <section v-if="showCompleted" class="card items-card completed-card">
          <TransitionGroup tag="ul" name="row" class="items-list">
            <RecipeItemRow
              v-for="item in completedItems"
              :key="item.id"
              :item="item"
              :recipe-id="props.id"
            />
          </TransitionGroup>
        </section>
      </template>

      <div v-if="items.length === 0" class="empty-state">
        <span class="empty-icon"><AppIcon name="basket" :size="34" :stroke="1.7" /></span>
        <p class="empty-title">No items yet</p>
        <p class="empty-hint">Use “Add items” to bring in items from your lists.</p>
      </div>

      <RenameModal
        v-if="showRenameModal"
        kind="recipe"
        :current-name="recipe.name"
        @close="showRenameModal = false"
        @save="handleRename"
      />
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
.hero {
  padding: 1.2rem 1.2rem 1.1rem;
  margin-top: 0.4rem;
  overflow: visible;
  background-color: var(--c-bg-soft);
  background-image:
    radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 85% 60% / 0.22), transparent 60%),
    radial-gradient(
      90% 120% at 100% 100%,
      hsl(calc(var(--hue) + 28) 85% 60% / 0.14),
      transparent 65%
    );
}

.recipe-header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.recipe-header + .progress {
  margin-top: 1rem;
}

.hero-tile {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  color: hsl(var(--hue) 90% 75%);
  background-color: hsl(var(--hue) 80% 60% / 0.18);
  box-shadow: inset 0 0 0 1.5px hsl(var(--hue) 80% 65% / 0.4);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero h1 {
  font-size: clamp(1.5rem, 5.5vw, 1.9rem);
  line-height: 1.12;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.hero-meta {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--c-text-soft);
}

.progress {
  height: 7px;
  border-radius: 7px;
  background-color: var(--c-border);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: 7px;
  background-image: linear-gradient(
    90deg,
    hsl(var(--hue) 85% 62%),
    hsl(calc(var(--hue) + 28) 88% 58%)
  );
  box-shadow: 0 0 12px hsl(var(--hue) 90% 60% / 0.6);
  transition: width 0.7s var(--ease-out);
}

.pending-note {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.85rem;
  font-size: 0.8rem;
  color: var(--c-warning);
}

.actions-row {
  display: flex;
  gap: 0.6rem;
  margin: 1.1rem 0 0.5rem;
}

.actions-row .btn {
  flex: 1;
  width: auto;
}

.section-toggle {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.section-toggle:hover {
  color: var(--c-heading);
}

.toggle-chevron {
  margin-left: auto;
  transition: transform 0.25s var(--ease-out);
}

.toggle-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.completed-card {
  background-color: transparent;
  box-shadow: none;
}

.items-card {
  position: relative;
}

.row-enter-active,
.row-leave-active {
  transition:
    opacity 0.25s,
    transform 0.3s var(--ease-out);
}

.row-move {
  transition: transform 0.3s var(--ease-out);
}

.row-enter-from {
  opacity: 0;
  transform: translateX(-14px);
}

.row-leave-active {
  position: absolute;
  width: calc(100% - 1rem);
}

.row-leave-to {
  opacity: 0;
  transform: translateX(14px);
}
</style>
