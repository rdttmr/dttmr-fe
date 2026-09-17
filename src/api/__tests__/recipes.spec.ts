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
  shareRecipeApi,
  joinRecipeApi,
} from '../recipes'
import { useAuthStore } from '@/stores/auth'
import { API_BASE_URL } from '@/api/auth'

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

  it('shareRecipeApi sends POST to /recipes/{id}/share and returns the code', async () => {
    const mockCode = { code: 'abc123' }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockCode,
    } as unknown as Response)
    global.fetch = fetchMock

    const result = await shareRecipeApi('recipe-1')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/recipe-1/share`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result).toEqual(mockCode)
  })

  it('shareRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed' }),
    } as unknown as Response)

    await expect(shareRecipeApi('recipe-1')).rejects.toThrow('Failed')
  })

  it('joinRecipeApi sends POST to /recipes/{code}/join', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as unknown as Response)
    global.fetch = fetchMock

    await joinRecipeApi('abc123')

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/recipes/abc123/join`,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('joinRecipeApi throws on failure', async () => {
    global.fetch = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid code' }),
    } as unknown as Response)

    await expect(joinRecipeApi('bad-code')).rejects.toThrow('Invalid code')
  })
})
