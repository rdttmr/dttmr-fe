<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { LocalRecipe } from '@/database/db'
import { useRecipesStore } from '@/stores/recipes'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  recipe: LocalRecipe
}>()

const emit = defineEmits<{
  close: []
}>()

const recipesStore = useRecipesStore()

const code = ref('')
const isLoading = ref(false)
const error = ref('')
const copied = ref(false)
let copiedTimeout: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  void generateCode()
})

async function generateCode() {
  error.value = ''
  isLoading.value = true
  try {
    code.value = await recipesStore.shareRecipe(props.recipe.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to share recipe'
  } finally {
    isLoading.value = false
  }
}

// The link that lands someone on the (otherwise unlinked) join page - see
// router.ts, which routes /recipes/join?code=... to RecipeJoinView.
function getRecipeJoinUrl(shareCode: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}recipes/join?code=${encodeURIComponent(shareCode)}`
}

async function handleShare() {
  if (!code.value) return
  const url = getRecipeJoinUrl(code.value)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Join "${props.recipe.name}"`,
        text: 'Use this link to join the recipe',
        url,
      })
      return
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      // Web Share unsupported in this context; fall through to clipboard copy.
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    clearTimeout(copiedTimeout)
    copiedTimeout = setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    // Clipboard access denied or unavailable; nothing sensible to do.
  }
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <BaseModal
    :title="`Share &quot;${recipe.name}&quot;`"
    title-id="share-recipe-modal-title"
    icon="share"
    @close="handleClose"
  >
    <p class="modal-description">Anyone with this link can join the recipe and see its items.</p>
    <p class="disclaimer">
      <AppIcon name="alert" :size="16" />
      <span
        >Joining doesn't check whether they can already see the lists these items belong to — anyone
        with the link can see the items regardless. That check isn't built yet, but sharing still
        works.</span
      >
    </p>

    <p v-if="isLoading" class="loading-hint">Generating link…</p>

    <template v-else-if="code">
      <code class="share-code" :title="code">{{ code }}</code>
      <button type="button" class="btn btn-primary share-btn" @click="handleShare">
        <AppIcon :name="copied ? 'check' : 'link'" :size="18" :stroke="2.3" />
        {{ copied ? 'Copied!' : 'Copy share link' }}
      </button>
    </template>

    <div v-if="error" class="banner banner-error">
      {{ error }}
      <button type="button" class="retry-btn" @click="generateCode">Retry</button>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleClose">Done</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-description {
  font-size: 0.92rem;
  color: var(--c-text-soft);
  margin-bottom: 1rem;
}

.disclaimer {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-md);
  background-color: var(--c-warning-bg);
  color: var(--c-warning);
  font-size: 0.78rem;
  line-height: 1.45;
  margin-bottom: 1rem;
}

.disclaimer .icon {
  margin-top: 0.1rem;
}

.loading-hint {
  font-size: 0.85rem;
  color: var(--c-text-soft);
}

.share-code {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  color: var(--c-heading);
  background-color: var(--c-bg-mute);
  border: 1px dashed var(--c-border-hover);
  border-radius: var(--radius-md);
  padding: 0.75rem 0.9rem;
  margin-bottom: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-btn {
  width: 100%;
}

.banner-error {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.retry-btn {
  background: none;
  border: 1px solid var(--c-danger-border);
  color: var(--c-danger);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
