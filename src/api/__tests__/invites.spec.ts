import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { getInvitesApi, createInviteApi, deleteInviteApi } from '../invites'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/http'

describe('invites API', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()

    const authStore = useAuthStore()
    authStore.setTokens({ access_token: 'token-123', refresh_token: 'refresh-123' })
  })

  afterEach(() => {
    global.fetch = originalFetch
    localStorage.clear()
  })

  it('getInvitesApi sends GET to /user/invites and returns the invites', async () => {
    const mockInvites = [{ id: 'invite-1', code: 'ABC123' }]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockInvites,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await getInvitesApi()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/user/invites`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockInvites)
  })

  it('getInvitesApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(getInvitesApi()).rejects.toThrow('Failed')
  })

  it('createInviteApi sends POST to /user/invites and returns the created invite', async () => {
    const mockInvite = { id: 'invite-1', code: 'ABC123' }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockInvite,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await createInviteApi()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/user/invites`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(mockInvite)
  })

  it('createInviteApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed to create invite' }),
    } as unknown as Response)

    await expect(createInviteApi()).rejects.toThrow('Failed to create invite')
  })

  it('deleteInviteApi sends DELETE to /user/invites/:id', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await deleteInviteApi('invite-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/user/invites/invite-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteInviteApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed to delete invite' }),
    } as unknown as Response)

    await expect(deleteInviteApi('invite-1')).rejects.toThrow('Failed to delete invite')
  })
})
