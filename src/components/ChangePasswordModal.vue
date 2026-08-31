<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { changePasswordApi } from '@/api/users'
import BaseModal from '@/components/BaseModal.vue'

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
  <BaseModal title="Change password" title-id="change-password-modal-title" @close="handleClose">
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

.password-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.password-form .btn {
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
