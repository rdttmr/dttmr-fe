import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { changePasswordApi, createUserApi } from '../users'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/http'

describe('users API', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
    localStorage.clear()
  })

  describe('changePasswordApi', () => {
    it('sends POST to /user/password with the old and new password', async () => {
      const authStore = useAuthStore()
      authStore.setTokens({ access_token: 'token-123', refresh_token: 'refresh-123' })

      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as unknown as Response)
      global.fetch = fetchMock

      await changePasswordApi({ old_password: 'old', new_password: 'new12345' })

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE_URL}/user/password`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ old_password: 'old', new_password: 'new12345' }),
        }),
      )
    })

    it('throws on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Failed' }),
      } as unknown as Response)

      await expect(
        changePasswordApi({ old_password: 'old', new_password: 'new12345' }),
      ).rejects.toThrow('Failed')
    })
  })

  describe('createUserApi', () => {
    it('sends POST to /users with the registration payload and returns the created user', async () => {
      const mockUser = { id: 'user-1', email: 'new@example.com', name: 'New User' }
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockUser,
      } as unknown as Response)
      global.fetch = fetchMock

      const payload = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        invite_code: 'invite-abc',
      }
      const result = await createUserApi(payload)

      expect(fetchMock).toHaveBeenCalledWith(
        `${API_BASE_URL}/users`,
        expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
      )
      expect(result).toEqual(mockUser)
    })

    it('throws on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid invite code' }),
      } as unknown as Response)

      await expect(
        createUserApi({
          email: 'new@example.com',
          password: 'password123',
          name: 'New User',
          invite_code: 'bad-code',
        }),
      ).rejects.toThrow('Invalid invite code')
    })
  })
})
