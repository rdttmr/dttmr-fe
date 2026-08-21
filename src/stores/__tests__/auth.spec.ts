import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'
import * as authApi from '@/api/auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('initializes with tokens from localStorage if available', () => {
    localStorage.setItem('access_token', 'initial-access-token')
    localStorage.setItem('refresh_token', 'initial-refresh-token')

    const authStore = useAuthStore()

    expect(authStore.accessToken).toBe('initial-access-token')
    expect(authStore.refreshToken).toBe('initial-refresh-token')
    expect(authStore.isAuthenticated).toBe(true)
  })

  it('initializes with null tokens if localStorage is empty', () => {
    const authStore = useAuthStore()

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
  })

  it('successfully logs in and stores tokens in state and localStorage', async () => {
    const mockTokenPair = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    }

    vi.spyOn(authApi, 'loginApi').mockResolvedValueOnce(mockTokenPair)

    const authStore = useAuthStore()
    const result = await authStore.login({
      email: 'test@example.com',
      password: 'password123',
    })

    expect(result).toEqual(mockTokenPair)
    expect(authStore.accessToken).toBe('new-access-token')
    expect(authStore.refreshToken).toBe('new-refresh-token')
    expect(authStore.isAuthenticated).toBe(true)
    expect(localStorage.getItem('access_token')).toBe('new-access-token')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token')
    expect(authStore.error).toBeNull()
  })

  it('handles login failure and sets error message', async () => {
    vi.spyOn(authApi, 'loginApi').mockRejectedValueOnce(new Error('Invalid credentials'))

    const authStore = useAuthStore()

    await expect(
      authStore.login({
        email: 'test@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow('Invalid credentials')

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.error).toBe('Invalid credentials')
  })

  it('refreshes tokens successfully and updates state and localStorage', async () => {
    localStorage.setItem('access_token', 'old-access-token')
    localStorage.setItem('refresh_token', 'old-refresh-token')

    const authStore = useAuthStore()

    const refreshedTokenPair = {
      access_token: 'refreshed-access-token',
      refresh_token: 'refreshed-refresh-token',
    }

    const refreshSpy = vi.spyOn(authApi, 'refreshApi').mockResolvedValueOnce(refreshedTokenPair)

    const result = await authStore.refreshTokens()

    expect(refreshSpy).toHaveBeenCalledWith({ refresh_token: 'old-refresh-token' })
    expect(result).toEqual(refreshedTokenPair)
    expect(authStore.accessToken).toBe('refreshed-access-token')
    expect(authStore.refreshToken).toBe('refreshed-refresh-token')
    expect(localStorage.getItem('access_token')).toBe('refreshed-access-token')
    expect(localStorage.getItem('refresh_token')).toBe('refreshed-refresh-token')
  })

  it('clears tokens and throws if refreshTokens is called without a refresh token', async () => {
    const authStore = useAuthStore()

    await expect(authStore.refreshTokens()).rejects.toThrow('No refresh token available')
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
  })

  it('clears tokens and sets error when refresh API call fails', async () => {
    localStorage.setItem('access_token', 'old-access-token')
    localStorage.setItem('refresh_token', 'expired-refresh-token')

    const authStore = useAuthStore()

    vi.spyOn(authApi, 'refreshApi').mockRejectedValueOnce(new Error('Refresh token expired'))

    await expect(authStore.refreshTokens()).rejects.toThrow('Refresh token expired')
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.error).toBe('Refresh token expired')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('clears tokens and calls logout API on logout', async () => {
    localStorage.setItem('access_token', 'sample-access')
    localStorage.setItem('refresh_token', 'sample-refresh')

    const authStore = useAuthStore()
    expect(authStore.isAuthenticated).toBe(true)

    const logoutSpy = vi.spyOn(authApi, 'logoutApi').mockResolvedValueOnce()

    await authStore.logout()

    expect(logoutSpy).toHaveBeenCalledWith({ refresh_token: 'sample-refresh' })
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('still clears tokens if logout API fails', async () => {
    localStorage.setItem('access_token', 'sample-access')
    localStorage.setItem('refresh_token', 'sample-refresh')

    const authStore = useAuthStore()
    vi.spyOn(authApi, 'logoutApi').mockRejectedValueOnce(new Error('Network error'))

    await authStore.logout()

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('clears tokens and calls logoutAll API on logoutAll', async () => {
    localStorage.setItem('access_token', 'sample-access')
    localStorage.setItem('refresh_token', 'sample-refresh')

    const authStore = useAuthStore()
    const logoutAllSpy = vi.spyOn(authApi, 'logoutAllApi').mockResolvedValueOnce()

    await authStore.logoutAll()

    expect(logoutAllSpy).toHaveBeenCalledWith('sample-access')
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('still clears tokens if logoutAll API fails', async () => {
    localStorage.setItem('access_token', 'sample-access')
    localStorage.setItem('refresh_token', 'sample-refresh')

    const authStore = useAuthStore()
    vi.spyOn(authApi, 'logoutAllApi').mockRejectedValueOnce(new Error('Network error'))

    await authStore.logoutAll()

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })
})
