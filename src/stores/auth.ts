import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { loginApi, refreshApi, logoutApi, logoutAllApi } from '@/api/auth'
import type { AccessTokenClaims, LoginPayload, TokenPair } from '@/types/auth'
import { decodeJwtPayload } from '@/utils/jwt'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'))
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  const currentUser = computed(() =>
    accessToken.value ? decodeJwtPayload<AccessTokenClaims>(accessToken.value) : null,
  )
  const email = computed(() => currentUser.value?.email ?? null)
  const username = computed(() => currentUser.value?.name ?? null)

  function setTokens(tokens: TokenPair) {
    accessToken.value = tokens.access_token
    refreshToken.value = tokens.refresh_token
    localStorage.setItem('access_token', tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
  }

  function clearTokens() {
    accessToken.value = null
    refreshToken.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  async function login(payload: LoginPayload): Promise<TokenPair> {
    isLoading.value = true
    error.value = null
    try {
      const tokens = await loginApi(payload)
      setTokens(tokens)
      return tokens
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function refreshTokens(): Promise<TokenPair> {
    if (!refreshToken.value) {
      clearTokens()
      throw new Error('No refresh token available')
    }

    try {
      const tokens = await refreshApi({ refresh_token: refreshToken.value })
      setTokens(tokens)
      return tokens
    } catch (err) {
      clearTokens()
      error.value = err instanceof Error ? err.message : 'Token refresh failed'
      throw err
    }
  }

  async function logout() {
    const currentRefreshToken = refreshToken.value
    clearTokens()
    error.value = null
    if (currentRefreshToken) {
      try {
        await logoutApi({ refresh_token: currentRefreshToken })
      } catch {
        // Backend logout failure should not prevent local token clearing
      }
    }
  }

  async function logoutAll() {
    const currentAccessToken = accessToken.value
    clearTokens()
    error.value = null
    if (currentAccessToken) {
      try {
        await logoutAllApi(currentAccessToken)
      } catch {
        // Backend logout failure should not prevent local token clearing
      }
    }
  }

  return {
    accessToken,
    refreshToken,
    isLoading,
    error,
    isAuthenticated,
    currentUser,
    email,
    username,
    setTokens,
    clearTokens,
    login,
    refreshTokens,
    logout,
    logoutAll,
  }
})
