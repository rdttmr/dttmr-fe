<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { LocalList } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  list: LocalList
}>()

const emit = defineEmits<{
  close: []
}>()

const listsStore = useListsStore()

const emailInput = ref<HTMLInputElement | null>(null)
const newEmail = ref('')
const isSubmitting = ref(false)
const error = ref('')
const successMessage = ref('')

onMounted(() => {
  nextTick(() => {
    emailInput.value?.focus()
  })
})

function handleClose() {
  emit('close')
}

async function handleAddUser() {
  const email = newEmail.value.trim()
  if (!email) return

  error.value = ''
  successMessage.value = ''
  isSubmitting.value = true

  try {
    await listsStore.addUserToList(props.list.id, email)
    newEmail.value = ''
    successMessage.value = `Shared with "${email}"!`
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to share list'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <BaseModal
    :title="`Share &quot;${list.name}&quot;`"
    title-id="share-modal-title"
    @close="handleClose"
  >
    <p class="modal-description">Enter an email to invite them to collaborate on this list.</p>

    <form class="share-form" @submit.prevent="handleAddUser">
      <div class="field">
        <input
          ref="emailInput"
          v-model="newEmail"
          type="email"
          placeholder="Email"
          :disabled="isSubmitting"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary share-btn"
        :disabled="isSubmitting || !newEmail.trim()"
      >
        Add
      </button>
    </form>

    <p v-if="error" class="banner banner-error">{{ error }}</p>
    <p v-if="successMessage" class="banner banner-success">{{ successMessage }}</p>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleClose">Done</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-description {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin-bottom: 1rem;
}

.share-form {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.share-form .field {
  flex: 1;
}

.share-btn {
  width: auto;
  flex-shrink: 0;
  padding: 0.65rem 1.2rem;
}

.banner-success {
  background-color: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.4);
  color: var(--c-success);
  margin-top: 0.75rem;
}

.banner-error {
  margin-top: 0.75rem;
}
</style>
