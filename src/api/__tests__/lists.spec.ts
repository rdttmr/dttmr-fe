import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  getListsApi,
  createListApi,
  getListItemsApi,
  createListItemApi,
  updateListItemTitleApi,
  setListItemCompletedApi,
  addUserToListApi,
  removeUserFromListApi,
  deleteListApi,
  deleteListItemApi,
} from '../lists'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/auth'

describe('lists API', () => {
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

  it('getListsApi sends GET to /lists and returns the lists', async () => {
    const mockLists = [{ id: 'list-1', name: 'Groceries' }]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockLists,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await getListsApi()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockLists)
  })

  it('getListsApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(getListsApi()).rejects.toThrow('Failed')
  })

  it('getListItemsApi sends GET to /lists/{id} and returns the items', async () => {
    const mockItems = [{ id: 'item-1', list_id: 'list-1', title: 'Milk', is_completed: false }]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockItems,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await getListItemsApi('list-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/list-1`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockItems)
  })

  it('setListItemCompletedApi sends POST to /lists/items/{id}/complete', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await setListItemCompletedApi('item-1', { is_completed: true })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/items/item-1/complete`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('createListApi sends POST to /lists and returns the created list', async () => {
    const mockList = { id: 'list-1', name: 'Groceries' }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockList,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await createListApi({ name: 'Groceries' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(mockList)
  })

  it('createListApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(createListApi({ name: 'x' })).rejects.toThrow('Failed')
  })

  it('createListItemApi sends POST to /lists/items and returns the created item with its server id', async () => {
    const mockItem = { id: 'item-1', list_id: '', title: 'Milk', is_completed: false }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockItem,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await createListItemApi({ list_id: 'list-1', title: 'Milk' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/items`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(mockItem)
  })

  it('updateListItemTitleApi sends POST to /lists/items/{id}/title', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await updateListItemTitleApi('item-1', { title: 'Free-range eggs' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/items/item-1/title`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('addUserToListApi sends POST to /lists/user', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await addUserToListApi({ list_id: 'list-1', email: 'user@example.com' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/user`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('removeUserFromListApi sends DELETE to /lists/user', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await removeUserFromListApi({ list_id: 'list-1', email: 'user@example.com' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/user`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteListApi sends DELETE to /lists/{id}', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await deleteListApi('list-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/list-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteListApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'List not found' }),
    } as unknown as Response)

    await expect(deleteListApi('list-1')).rejects.toThrow('List not found')
  })

  it('deleteListItemApi sends DELETE to /lists/items/{id}', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await deleteListItemApi('item-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lists/items/item-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteListItemApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Item not found' }),
    } as unknown as Response)

    await expect(deleteListItemApi('item-1')).rejects.toThrow('Item not found')
  })
})
