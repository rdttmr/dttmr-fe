<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import type { LocalList } from '@/database/db'
import { useListsStore } from '@/stores/lists'
import { useEscapeKey } from '@/composables/useEscapeKey'

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

useEscapeKey(handleClose)

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
  <div class="modal-overlay" @click.self="handleClose">
    <div
      class="modal-card card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div class="modal-header">
        <h3 id="share-modal-title">Share "{{ list.name }}"</h3>
        <button type="button" class="close-btn" aria-label="Close modal" @click="handleClose">
          ✕
        </button>
      </div>

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

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" @click="handleClose">Done</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 100;
  animation: fadeIn 0.15s ease-out;
}

.modal-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--c-bg-soft);
  border: 1px solid var(--c-border-hover);
  border-radius: var(--radius-lg);
  padding: 1.25rem 1.4rem;
  box-shadow: var(--shadow-md);
  animation: slideUp 0.15s ease-out;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.modal-header h3 {
  font-size: 1.1rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: var(--c-text-soft);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  border-radius: var(--radius-sm);
  line-height: 1;
}

.close-btn:hover {
  color: var(--c-heading);
}

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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.modal-footer .btn {
  width: auto;
  padding: 0.5rem 1.2rem;
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

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
