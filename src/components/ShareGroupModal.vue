<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Group } from '@/types/group'
import { useGroupsStore } from '@/stores/groups'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  group: Group
}>()

const emit = defineEmits<{
  close: []
}>()

const groupsStore = useGroupsStore()

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
    code.value = await groupsStore.shareGroup(props.group.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to share group'
  } finally {
    isLoading.value = false
  }
}

// The link that lands someone on the (otherwise unlinked) join page - see
// router.ts, which routes /groups/join?code=... to GroupJoinView.
function getGroupJoinUrl(shareCode: string): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`
  return `${base}groups/join?code=${encodeURIComponent(shareCode)}`
}

async function handleShare() {
  if (!code.value) return
  const url = getGroupJoinUrl(code.value)

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Join "${props.group.name}"`,
        text: 'Use this link to join the group',
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
    :title="`Share &quot;${group.name}&quot;`"
    title-id="share-group-modal-title"
    icon="share"
    @close="handleClose"
  >
    <p class="modal-description">
      Whoever opens this link joins the group and sees all of its lists and recipes. The link works
      once.
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
