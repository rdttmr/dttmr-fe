import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { loginApi, refreshApi, logoutApi, logoutAllApi, API_BASE_URL } from '../auth'

describe('auth API', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('loginApi', () => {
    it('sends POST request to /login and returns token pair on success', async () => {
      const mockResponse = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
      }

      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response)

      const payload = { email: 'user@example.com', password: 'secretpassword' }
      const result = await loginApi(payload)

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws error with message on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid email or password' }),
      } as unknown as Response)

      await expect(
        loginApi({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow('Invalid email or password')
    })
  })

  describe('refreshApi', () => {
    it('sends POST request to /login/refresh and returns token pair on success', async () => {
      const mockResponse = {
        access_token: 'new-access-123',
        refresh_token: 'new-refresh-456',
      }

      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response)

      const payload = { refresh_token: 'refresh-456' }
      const result = await refreshApi(payload)

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/login/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws error on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => {
          throw new Error('Not JSON')
        },
      } as unknown as Response)

      await expect(
        refreshApi({ refresh_token: 'invalid-token' }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('logoutApi', () => {
    it('sends POST request to /logout on success', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      } as unknown as Response)

      const payload = { refresh_token: 'refresh-456' }
      await logoutApi(payload)

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    })

    it('throws error on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({ error: 'failed to logout' }),
      } as unknown as Response)

      await expect(
        logoutApi({ refresh_token: 'invalid-token' }),
      ).rejects.toThrow('failed to logout')
    })
  })

  describe('logoutAllApi', () => {
    it('sends POST request to /logout/all with token header on success', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      } as unknown as Response)

      await logoutAllApi('access-123')

      expect(global.fetch).toHaveBeenCalledWith(`${API_BASE_URL}/logout/all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer access-123',
        },
        body: JSON.stringify({}),
      })
    })

    it('throws error on failure', async () => {
      global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Unauthorized' }),
      } as unknown as Response)

      await expect(logoutAllApi('bad-token')).rejects.toThrow('Unauthorized')
    })
  })
})
