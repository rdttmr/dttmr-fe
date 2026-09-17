<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'

const route = useRoute()
const router = useRouter()
const recipesStore = useRecipesStore()

const code = computed(() => {
  const value = route.query.code
  return typeof value === 'string' ? value : ''
})

const status = ref<'joining' | 'error' | 'invalid'>('joining')
const error = ref('')

onMounted(() => {
  void attemptJoin()
})

async function attemptJoin() {
  if (!code.value) {
    status.value = 'invalid'
    return
  }

  status.value = 'joining'
  error.value = ''
  try {
    await recipesStore.ensureLoaded()
    const before = new Set(recipesStore.recipes.map((recipe) => recipe.id))
    await recipesStore.joinRecipe(code.value)
    const joined = recipesStore.recipes.find((recipe) => !before.has(recipe.id))
    router.replace(joined ? `/recipes/${joined.id}` : '/recipes')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to join recipe'
    status.value = 'error'
  }
}
</script>

<template>
  <div class="join-container">
    <div class="join-card card">
      <div class="brand-mark">
        <span class="brand-seal"></span>
        <span class="brand-word">dttmr</span>
      </div>

      <template v-if="status === 'invalid'">
        <h2>Invalid link</h2>
        <p class="subtitle">This link is missing a share code. Ask whoever shared it for a new one.</p>
        <button type="button" class="btn btn-secondary" @click="router.push('/recipes')">
          Go to Recipes
        </button>
      </template>

      <template v-else-if="status === 'joining'">
        <h2>Joining recipe…</h2>
        <p class="subtitle">Hang on a moment.</p>
      </template>

      <template v-else>
        <h2>Couldn't join recipe</h2>
        <p v-if="error" class="banner banner-error">{{ error }}</p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" @click="router.push('/recipes')">
            Go to Recipes
          </button>
          <button type="button" class="btn btn-primary" @click="attemptJoin">Try again</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.join-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.join-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem 1.75rem;
  text-align: center;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  margin-bottom: 1.5rem;
}

.brand-seal {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  background: var(--c-accent);
  transform: rotate(-8deg);
  box-shadow: 0 0 0 3px var(--c-bg-soft) inset;
}

.brand-word {
  font-family: var(--font-stamp);
  font-size: 1.3rem;
  letter-spacing: 0.04em;
  color: var(--c-heading);
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.3rem;
}

.subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.85rem;
  color: var(--c-text-soft);
}

.banner-error {
  margin-bottom: 1.25rem;
  text-align: left;
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.actions .btn {
  width: auto;
}
</style>
