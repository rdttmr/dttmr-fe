<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { changePasswordApi } from '@/api/users'
import { useEscapeKey } from '@/composables/useEscapeKey'

const emit = defineEmits<{
  close: []
}>()

const passwordInput = ref<HTMLInputElement | null>(null)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const isSubmitting = ref(false)
const error = ref('')
const successMessage = ref('')

useEscapeKey(handleClose)

onMounted(() => {
  nextTick(() => {
    passwordInput.value?.focus()
  })
})

function handleClose() {
  emit('close')
}

async function handleSubmit() {
  error.value = ''
  successMessage.value = ''

  if (newPassword.value.length < 8) {
    error.value = 'New password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'New passwords do not match.'
    return
  }

  isSubmitting.value = true
  try {
    await changePasswordApi({
      old_password: currentPassword.value,
      new_password: newPassword.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    successMessage.value = 'Password changed successfully.'
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to change password'
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
      aria-labelledby="change-password-modal-title"
    >
      <div class="modal-header">
        <h3 id="change-password-modal-title">Change password</h3>
        <button type="button" class="close-btn" aria-label="Close modal" @click="handleClose">
          ✕
        </button>
      </div>

      <p class="modal-description">Enter your current password and choose a new one.</p>

      <form class="password-form" @submit.prevent="handleSubmit">
        <div class="field">
          <input
            ref="passwordInput"
            v-model="currentPassword"
            type="password"
            placeholder="Current password"
            autocomplete="current-password"
            :disabled="isSubmitting"
          />
        </div>
        <div class="field">
          <input
            v-model="newPassword"
            type="password"
            placeholder="New password"
            autocomplete="new-password"
            :disabled="isSubmitting"
          />
        </div>
        <div class="field">
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="Confirm new password"
            autocomplete="new-password"
            :disabled="isSubmitting"
          />
        </div>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="isSubmitting || !currentPassword || !newPassword || !confirmPassword"
        >
          Change password
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

.password-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.password-form .btn {
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
