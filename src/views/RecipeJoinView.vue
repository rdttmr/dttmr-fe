<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRecipesStore } from '@/stores/recipes'
import AuthShell from '@/components/AuthShell.vue'
import AppIcon from '@/components/AppIcon.vue'

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
  <AuthShell>
    <div class="join-body">
      <template v-if="status === 'invalid'">
        <span class="status-icon is-error"><AppIcon name="link" :size="26" /></span>
        <h2>Invalid link</h2>
        <p class="subtitle">
          This link is missing a share code. Ask whoever shared it for a new one.
        </p>
        <button type="button" class="btn btn-secondary" @click="router.push('/recipes')">
          Go to Recipes
        </button>
      </template>

      <template v-else-if="status === 'joining'">
        <span class="status-icon"><span class="spinner"></span></span>
        <h2>Joining recipe…</h2>
        <p class="subtitle">Hang on a moment.</p>
      </template>

      <template v-else>
        <span class="status-icon is-error"><AppIcon name="alert" :size="26" /></span>
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
  </AuthShell>
</template>

<style scoped>
.join-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.status-icon {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin-bottom: 1.1rem;
  border-radius: 20px;
  background-color: var(--c-accent-bg);
  color: var(--c-accent-strong);
}

.status-icon.is-error {
  background-color: var(--c-danger-bg);
  color: var(--c-danger);
}

.spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 3px solid var(--c-border-hover);
  border-top-color: var(--c-accent-strong);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.5rem;
  letter-spacing: -0.03em;
}

.subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
  color: var(--c-text-soft);
}

.banner-error {
  margin-bottom: 1.25rem;
  text-align: left;
  width: 100%;
}

.actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.actions .btn {
  flex: 1;
}

.join-body > .btn {
  width: 100%;
}
</style>
