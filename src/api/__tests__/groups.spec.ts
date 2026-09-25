import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  getGroupsApi,
  shareGroupApi,
  joinGroupApi,
  setDefaultGroupApi,
  deleteGroupApi,
} from '../groups'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/auth'

describe('groups API', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
    useAuthStore().setTokens({ access_token: 'token-123', refresh_token: 'refresh-123' })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function mockResponse(body?: unknown, status = 200) {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status,
      json: async () => body,
    } as unknown as Response)
    global.fetch = fetchMock
    return fetchMock
  }

  it('getGroupsApi sends GET to /groups and returns the groups', async () => {
    const groups = [{ id: 'g1', name: 'Personal', is_default: true, member_count: 1 }]
    const fetchMock = mockResponse(groups)

    expect(await getGroupsApi()).toEqual(groups)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/groups`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('shareGroupApi sends POST to /groups/{id}/share and returns the invite', async () => {
    const invite = { id: 'i1', group_id: 'g1', code: 'abc123' }
    const fetchMock = mockResponse(invite)

    expect(await shareGroupApi('g1')).toEqual(invite)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/groups/g1/share`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('joinGroupApi sends POST to /groups/join with the code in the body', async () => {
    const fetchMock = mockResponse(undefined, 204)

    await joinGroupApi('abc123')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/groups/join`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: 'abc123' }) }),
    )
  })

  it('setDefaultGroupApi sends POST to /groups/{id}/default', async () => {
    const fetchMock = mockResponse(undefined, 204)

    await setDefaultGroupApi('g1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/groups/g1/default`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('deleteGroupApi throws the server message on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: 'group is not empty' }),
    } as unknown as Response)

    await expect(deleteGroupApi('g1')).rejects.toThrow('group is not empty')
  })
})
