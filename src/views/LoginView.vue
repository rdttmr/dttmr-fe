<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const listsStore = useListsStore()

const email = ref('')
const password = ref('')
const localError = ref('')

async function handleSubmit() {
  localError.value = ''

  if (!email.value || !password.value) {
    localError.value = 'Please enter both email and password.'
    return
  }

  try {
    await authStore.login({
      email: email.value,
      password: password.value,
    })

    // The initial sync at app boot may have run before the user was
    // authenticated (e.g. no valid session yet), leaving the lists store
    // "loaded" with empty/stale data and no further automatic retry. Kick
    // off a fresh, now-authenticated sync so lists and items actually show
    // up after logging in.
    listsStore.sync().catch(() => {})

    const redirect = route.query.redirect
    router.push(typeof redirect === 'string' && redirect ? redirect : '/')
  } catch (err) {
    localError.value = err instanceof Error ? err.message : 'Failed to log in'
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card card">
      <div class="brand-mark">
        <span class="brand-dot"></span>
      </div>
      <h2>Login</h2>
      <p class="subtitle">Enter your credentials to access your account</p>

      <div v-if="authStore.isAuthenticated" class="already-logged-in">
        <p>You are already logged in.</p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" @click="router.push('/')">
            Go to Home
          </button>
          <button type="button" class="btn btn-danger" @click="authStore.logout()">Log Out</button>
        </div>
      </div>

      <form v-else @submit.prevent="handleSubmit">
        <div v-if="localError || authStore.error" class="error-banner banner banner-error">
          {{ localError || authStore.error }}
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
            :disabled="authStore.isLoading"
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            autocomplete="current-password"
            required
            :disabled="authStore.isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary" :disabled="authStore.isLoading">
          <span v-if="authStore.isLoading">Logging in...</span>
          <span v-else>Log In</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem 1.75rem;
}

.brand-mark {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.brand-dot {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--c-accent-strong), var(--c-accent-soft));
  box-shadow: 0 0 24px var(--c-accent-bg);
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.4rem;
  text-align: center;
}

.subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.85rem;
  color: var(--c-text-soft);
  text-align: center;
}

.error-banner {
  margin-bottom: 1.1rem;
}

.already-logged-in {
  text-align: center;
}

.already-logged-in p {
  margin-bottom: 1.25rem;
  color: var(--c-text);
}

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

form .field {
  margin-bottom: 1.1rem;
}

@media (min-width: 768px) {
  .login-card {
    padding: 2.5rem 2.25rem;
  }
}
</style>
