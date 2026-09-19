<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { createUserApi } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import AuthShell from '@/components/AuthShell.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const listsStore = useListsStore()
const recipesStore = useRecipesStore()

const inviteCode = computed(() => {
  const invite = route.query.invite
  return typeof invite === 'string' ? invite : ''
})

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const isSubmitting = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }

  isSubmitting.value = true
  try {
    await createUserApi({
      name: name.value,
      email: email.value,
      password: password.value,
      invite_code: inviteCode.value,
    })

    await authStore.login({ email: email.value, password: password.value })
    listsStore.sync().catch(() => {})
    recipesStore.sync().catch(() => {})
    router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create account'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AuthShell>
    <h2>Create your account</h2>

    <div v-if="authStore.isAuthenticated" class="already-logged-in">
      <p>You're already logged in as {{ authStore.email }}.</p>
      <div class="actions">
        <button type="button" class="btn btn-primary" @click="router.push('/')">Go to Home</button>
        <button type="button" class="btn btn-danger" @click="authStore.logout()">Log Out</button>
      </div>
    </div>

    <div v-else-if="!inviteCode" class="invalid-invite">
      <p>This page requires a valid invite link. Ask whoever invited you for a new one.</p>
    </div>

    <form v-else @submit.prevent="handleSubmit">
      <p class="subtitle">You've been invited to join dttmr. Set up your account below.</p>

      <div v-if="error" class="error-banner banner banner-error">{{ error }}</div>

      <div class="field">
        <label for="name">Name</label>
        <input
          id="name"
          v-model="name"
          type="text"
          placeholder="Jane Doe"
          autocomplete="name"
          required
          :disabled="isSubmitting"
        />
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          placeholder="name@example.com"
          autocomplete="email"
          required
          :disabled="isSubmitting"
        />
      </div>

      <div class="field">
        <label for="password">Password</label>
        <input
          id="password"
          v-model="password"
          type="password"
          placeholder="At least 8 characters"
          autocomplete="new-password"
          required
          :disabled="isSubmitting"
        />
      </div>

      <div class="field">
        <label for="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          placeholder="Repeat your password"
          autocomplete="new-password"
          required
          :disabled="isSubmitting"
        />
      </div>

      <button type="submit" class="btn btn-primary submit-btn" :disabled="isSubmitting">
        <span v-if="isSubmitting">Creating account...</span>
        <span v-else>Create account</span>
      </button>
    </form>
  </AuthShell>
</template>

<style scoped>
h2 {
  margin: 0 0 0.35rem;
  font-size: 1.6rem;
  letter-spacing: -0.035em;
}

.subtitle {
  margin: 0 0 1.4rem;
  font-size: 0.9rem;
  color: var(--c-text-soft);
}

.error-banner {
  margin-bottom: 1.1rem;
}

.already-logged-in,
.invalid-invite {
  margin-top: 0.75rem;
}

.already-logged-in p,
.invalid-invite p {
  margin-bottom: 1.25rem;
  color: var(--c-text);
}

.actions {
  display: flex;
  gap: 0.75rem;
}

.actions .btn {
  flex: 1;
}

form .field {
  margin-bottom: 1rem;
}

.submit-btn {
  margin-top: 0.6rem;
  padding: 0.9rem 1rem;
}
</style>
