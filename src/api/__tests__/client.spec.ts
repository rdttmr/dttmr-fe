import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { fetchWithAuth, apiClient } from '../client'
import { useAuthStore } from '@/stores/auth'
import * as authApi from '@/api/auth'

describe('api client (fetchWithAuth)', () => {
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

  it('adds Authorization header if accessToken is available in store', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({
      access_token: 'test-token',
      refresh_token: 'refresh-token',
    })

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as unknown as Response)
    global.fetch = fetchMock

    await fetchWithAuth('/lists')

    expect(fetchMock).toHaveBeenCalled()
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs).toBeDefined()
    const headers = callArgs?.[1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('omits Authorization header when skipAuth is true', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({
      access_token: 'test-token',
      refresh_token: 'refresh-token',
    })

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as unknown as Response)
    global.fetch = fetchMock

    await fetchWithAuth('/health', { skipAuth: true })

    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs).toBeDefined()
    const headers = callArgs?.[1]?.headers as Headers
    expect(headers.has('Authorization')).toBe(false)
  })

  it('refreshes token and retries request on 401 response', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({
      access_token: 'expired-token',
      refresh_token: 'valid-refresh-token',
    })

    const refreshSpy = vi.spyOn(authApi, 'refreshApi').mockResolvedValueOnce({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    })

    const firstResponse = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }
    const secondResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: 'protected data' }),
    }

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(firstResponse as unknown as Response)
      .mockResolvedValueOnce(secondResponse as unknown as Response)
    global.fetch = fetchMock

    const res = await fetchWithAuth('/lists')

    expect(refreshSpy).toHaveBeenCalledWith({ refresh_token: 'valid-refresh-token' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(authStore.accessToken).toBe('new-access-token')

    // Second call should have new access token
    const secondCall = fetchMock.mock.calls[1]
    expect(secondCall).toBeDefined()
    const secondCallHeaders = secondCall?.[1]?.headers as Headers
    expect(secondCallHeaders.get('Authorization')).toBe('Bearer new-access-token')
    expect(res).toBe(secondResponse)
  })

  it('calls apiClient helper methods correctly', async () => {
    const authStore = useAuthStore()
    authStore.setTokens({
      access_token: 'my-token',
      refresh_token: 'my-refresh',
    })

    const mockResponse = {
      ok: true,
      status: 200,
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(mockResponse as unknown as Response)
    global.fetch = fetchMock

    await apiClient.get('/lists')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/lists'),
      expect.objectContaining({ method: 'GET' }),
    )

    await apiClient.post('/lists', { name: 'My List' })
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/lists'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'My List' }),
      }),
    )

    await apiClient.put('/lists/item', { title: 'Updated' })
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/lists/item'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated' }),
      }),
    )

    await apiClient.delete('/lists/user')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/lists/user'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})
