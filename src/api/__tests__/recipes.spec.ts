import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  getRecipesApi,
  createRecipeApi,
  getRecipeItemsApi,
  deleteRecipeApi,
  addListItemToRecipeApi,
  removeListItemFromRecipeApi,
  uncheckRecipeApi,
  setRecipeGroupApi,
  orderRecipesApi,
} from '../recipes'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/auth'
import { ApiError } from '@/api/http'

describe('recipes API', () => {
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

  it('getRecipesApi sends GET to /recipes and returns the recipes', async () => {
    const mockRecipes = [{ id: 'recipe-1', name: 'Lasagna' }]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockRecipes,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await getRecipesApi()

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockRecipes)
  })

  it('getRecipesApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(getRecipesApi()).rejects.toThrow('Failed')
  })

  it('createRecipeApi sends POST to /recipes and returns the created recipe', async () => {
    const mockRecipe = { id: 'recipe-1', name: 'Lasagna' }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockRecipe,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await createRecipeApi({ name: 'Lasagna' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(mockRecipe)
  })

  it('createRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(createRecipeApi({ name: 'x' })).rejects.toThrow('Failed')
  })

  it('getRecipeItemsApi sends GET to /recipes/{id} and returns the items', async () => {
    const mockItems = [{ id: 'item-1', list_id: 'list-1', title: 'Flour', is_completed: false }]
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockItems,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await getRecipeItemsApi('recipe-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/recipe-1`,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual(mockItems)
  })

  it('getRecipeItemsApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Recipe not found' }),
    } as unknown as Response)

    await expect(getRecipeItemsApi('recipe-1')).rejects.toThrow('Recipe not found')
  })

  it('deleteRecipeApi sends DELETE to /recipes/{id}', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await deleteRecipeApi('recipe-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/recipe-1`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('deleteRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Recipe not found' }),
    } as unknown as Response)

    await expect(deleteRecipeApi('recipe-1')).rejects.toThrow('Recipe not found')
  })

  it('addListItemToRecipeApi sends POST to /recipes/items', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await addListItemToRecipeApi({ recipe_id: 'recipe-1', list_item_id: 'item-1' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/items`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('addListItemToRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(
      addListItemToRecipeApi({ recipe_id: 'recipe-1', list_item_id: 'item-1' }),
    ).rejects.toThrow('Failed')
  })

  it('removeListItemFromRecipeApi sends DELETE to /recipes/items', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await removeListItemFromRecipeApi({ recipe_id: 'recipe-1', list_item_id: 'item-1' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/items`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('uncheckRecipeApi sends POST to /recipes/{id}/uncheck', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await uncheckRecipeApi('recipe-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/recipe-1/uncheck`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('uncheckRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(uncheckRecipeApi('recipe-1')).rejects.toThrow('Failed')
  })

  it('setRecipeGroupApi sends POST to /recipes/{id}/group with the target group', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await setRecipeGroupApi('recipe-1', { group_id: 'group-2' })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/recipe-1/group`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ group_id: 'group-2' }),
      }),
    )
  })

  it('setRecipeGroupApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(setRecipeGroupApi('recipe-1', { group_id: 'group-2' })).rejects.toThrow('Failed')
  })

  it('orderRecipesApi sends POST to /recipes/order with the ordered ids', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await orderRecipesApi({ recipe_ids: ['recipe-b', 'recipe-a'] })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/order`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipe_ids: ['recipe-b', 'recipe-a'] }),
      }),
    )
  })

  it('orderRecipesApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid order' }),
    } as unknown as Response)

    await expect(orderRecipesApi({ recipe_ids: [] })).rejects.toThrow('Invalid order')
  })

  it('orderRecipesApi reports the HTTP status so callers can tell a rejection from an outage', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'stale recipe ids' }),
    } as unknown as Response)

    const error = await orderRecipesApi({ recipe_ids: ['x'] }).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: 'stale recipe ids', status: 400 })
  })
})
