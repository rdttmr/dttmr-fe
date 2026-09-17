import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

type Record = { id?: unknown; [key: string]: unknown }

function createFakeTable(autoIncrement = false) {
  const store = new Map<unknown, Record>()
  let nextId = 1

  const table = {
    async toArray() {
      return Array.from(store.values()).map((v) => ({ ...v }))
    },
    async add(record: Record) {
      const id = autoIncrement ? nextId++ : record.id
      const toStore = autoIncrement ? { ...record, id } : record
      store.set(id, { ...toStore })
      return id
    },
    async get(id: unknown) {
      const found = store.get(id)
      return found ? { ...found } : undefined
    },
    async put(record: Record) {
      store.set(record.id, { ...record })
      return record.id
    },
    async delete(id: unknown) {
      store.delete(id)
    },
    async update(id: unknown, changes: Record) {
      const existing = store.get(id)
      if (!existing) return 0
      store.set(id, { ...existing, ...changes })
      return 1
    },
    async count() {
      return store.size
    },
    async bulkPut(records: Record[]) {
      for (const record of records) {
        store.set(record.id, { ...record })
      }
      return records.map((record) => record.id)
    },
    async bulkDelete(ids: unknown[]) {
      for (const id of ids) {
        store.delete(id)
      }
    },
    where(field: string) {
      return {
        equals(value: unknown) {
          return {
            async toArray() {
              return Array.from(store.values())
                .filter((v) => v[field] === value)
                .map((v) => ({ ...v }))
            },
            async delete() {
              const matches = Array.from(store.entries()).filter(([, v]) => v[field] === value)
              for (const [key] of matches) store.delete(key)
              return matches.length
            },
            async modify(changes: Record) {
              const matches = Array.from(store.entries()).filter(([, v]) => v[field] === value)
              for (const [key, v] of matches) store.set(key, { ...v, ...changes })
              return matches.length
            },
          }
        },
        anyOf(values: unknown[]) {
          return {
            async toArray() {
              return Array.from(store.values())
                .filter((v) => values.includes(v[field]))
                .map((v) => ({ ...v }))
            },
            async count() {
              return Array.from(store.values()).filter((v) => values.includes(v[field])).length
            },
          }
        },
      }
    },
    filter(predicate: (record: Record) => boolean) {
      return {
        async toArray() {
          return Array.from(store.values())
            .filter(predicate)
            .map((v) => ({ ...v }))
        },
      }
    },
  }

  return table
}

// Recipe item links are keyed by the compound [recipeId, listItemId], so put
// and delete need to key the fake store on that pair rather than a plain id.
function createFakeLinkTable() {
  const store = new Map<string, Record>()

  const keyFor = (recipeId: unknown, listItemId: unknown) => `${recipeId}::${listItemId}`

  return {
    async toArray() {
      return Array.from(store.values()).map((v) => ({ ...v }))
    },
    async put(record: Record) {
      store.set(keyFor(record.recipeId, record.listItemId), { ...record })
      return [record.recipeId, record.listItemId]
    },
    async delete(key: [unknown, unknown]) {
      store.delete(keyFor(key[0], key[1]))
    },
    async update(key: [unknown, unknown], changes: Record) {
      const existing = store.get(keyFor(key[0], key[1]))
      if (!existing) return 0
      store.set(keyFor(key[0], key[1]), { ...existing, ...changes })
      return 1
    },
    async bulkPut(records: Record[]) {
      for (const record of records) {
        store.set(keyFor(record.recipeId, record.listItemId), { ...record })
      }
      return records.map((record) => [record.recipeId, record.listItemId])
    },
    async bulkDelete(keys: [unknown, unknown][]) {
      for (const key of keys) {
        store.delete(keyFor(key[0], key[1]))
      }
    },
    where(field: string) {
      return {
        equals(value: unknown) {
          return {
            async toArray() {
              return Array.from(store.values())
                .filter((v) => v[field] === value)
                .map((v) => ({ ...v }))
            },
            async delete() {
              const matches = Array.from(store.entries()).filter(([, v]) => v[field] === value)
              for (const [key] of matches) store.delete(key)
              return matches.length
            },
          }
        },
      }
    },
  }
}

const fakeDb = {
  recipes: createFakeTable(),
  recipeItems: createFakeLinkTable(),
  syncQueue: createFakeTable(true),
  // recipes.ts cross-notifies the lists store (recipe items are first-class
  // list items pulled via pullRecipeItemsInternal), so the lists store's own
  // tables need to exist too, even though these tests don't exercise lists
  // directly.
  lists: createFakeTable(),
  listItems: createFakeTable(),
}

vi.mock('@/database/db', () => ({
  db: fakeDb,
}))

const recipesApiMocks = vi.hoisted(() => ({
  getRecipesApi: vi.fn<() => Promise<unknown>>(),
  createRecipeApi: vi.fn<() => Promise<unknown>>(),
  getRecipeItemsApi: vi.fn<() => Promise<unknown>>(),
  deleteRecipeApi: vi.fn<() => Promise<unknown>>(),
  addListItemToRecipeApi: vi.fn<() => Promise<unknown>>(),
  removeListItemFromRecipeApi: vi.fn<() => Promise<unknown>>(),
  uncheckRecipeApi: vi.fn<() => Promise<unknown>>(),
  shareRecipeApi: vi.fn<() => Promise<unknown>>(),
  joinRecipeApi: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/api/recipes', () => recipesApiMocks)

const { useRecipesStore } = await import('../recipes')
const { useListsStore } = await import('../lists')

describe('useRecipesStore', () => {
  beforeEach(async () => {
    // Mutations schedule a debounced sync() via setTimeout; faking timers
    // keeps that pending timer from firing against a later test's mocks
    // instead of the ones set up here (tests trigger sync() explicitly).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    Object.values(recipesApiMocks).forEach((mock) => mock.mockReset())

    for (const table of [fakeDb.recipes, fakeDb.syncQueue, fakeDb.lists, fakeDb.listItems]) {
      const all = await table.toArray()
      for (const record of all) {
        await table.delete(record.id)
      }
    }
    // The recipe item link table is keyed by [recipeId, listItemId] rather
    // than a plain id, so it needs its own compound-key cleanup.
    for (const link of await fakeDb.recipeItems.toArray()) {
      await fakeDb.recipeItems.delete([link.recipeId, link.listItemId])
    }

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    // sync() is a no-op for anonymous visitors; these tests exercise the
    // authenticated sync path, so seed a logged-in session.
    localStorage.setItem('access_token', 'test-access-token')
    localStorage.setItem('refresh_token', 'test-refresh-token')

    // Default the read endpoint to an empty result so the pullRecipesFromServer()
    // step chained onto every sync() call doesn't interfere with unrelated tests.
    recipesApiMocks.getRecipesApi.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('creates a recipe locally, queues a sync entry, and remaps the id after a successful sync', async () => {
    recipesApiMocks.createRecipeApi.mockResolvedValueOnce({ id: 'server-recipe-1', name: 'Lasagna' })
    recipesApiMocks.getRecipesApi.mockResolvedValueOnce([{ id: 'server-recipe-1', name: 'Lasagna' }])

    const store = useRecipesStore()
    const localRecipe = await store.createRecipe('Lasagna')

    await store.sync()

    expect(recipesApiMocks.createRecipeApi).toHaveBeenCalledWith({ name: 'Lasagna' })
    expect(store.recipes.find((r) => r.id === localRecipe.id)).toBeUndefined()
    const synced = store.recipes.find((r) => r.id === 'server-recipe-1')
    expect(synced).toBeDefined()
    expect(synced?.pendingSync).toBe(false)
    expect(store.pendingCount).toBe(0)
  })

  it('keeps the entry in the sync queue and records the error when the API call fails', async () => {
    recipesApiMocks.createRecipeApi.mockRejectedValueOnce(new Error('Network error'))

    const store = useRecipesStore()
    await store.createRecipe('Broken recipe')
    await store.sync()

    expect(store.pendingCount).toBe(1)
    expect(store.error).toBe('Network error')
  })

  it('does not attempt to sync while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useRecipesStore()
    await store.createRecipe('Offline recipe')
    await store.sync()

    expect(recipesApiMocks.createRecipeApi).not.toHaveBeenCalled()
    expect(store.pendingCount).toBe(1)
  })

  it('does not attempt to sync when logged out, e.g. an anonymous visitor on a public invite link', async () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')

    const store = useRecipesStore()
    await store.sync()

    expect(recipesApiMocks.getRecipesApi).not.toHaveBeenCalled()
  })

  it('adds an item to a recipe locally and syncs the link to the server', async () => {
    recipesApiMocks.addListItemToRecipeApi.mockResolvedValueOnce(undefined)

    const store = useRecipesStore()
    await store.addItemToRecipe('recipe-1', 'item-1')

    expect(store.isItemInRecipe('recipe-1', 'item-1')).toBe(true)

    await store.sync()

    expect(recipesApiMocks.addListItemToRecipeApi).toHaveBeenCalledWith({
      recipe_id: 'recipe-1',
      list_item_id: 'item-1',
    })
    expect(store.pendingCount).toBe(0)
    expect(store.recipeItemLinks.find((l) => l.recipeId === 'recipe-1' && l.listItemId === 'item-1')?.pendingSync).toBe(
      false,
    )
  })

  it('does not add a duplicate link when the item is already in the recipe', async () => {
    const store = useRecipesStore()
    await store.addItemToRecipe('recipe-1', 'item-1')
    await store.addItemToRecipe('recipe-1', 'item-1')

    expect(store.recipeItemLinks.filter((l) => l.recipeId === 'recipe-1' && l.listItemId === 'item-1')).toHaveLength(
      1,
    )
    expect(store.pendingCount).toBe(1)
  })

  it('removes an item from a recipe locally and syncs the removal to the server', async () => {
    recipesApiMocks.addListItemToRecipeApi.mockResolvedValueOnce(undefined)
    recipesApiMocks.removeListItemFromRecipeApi.mockResolvedValueOnce(undefined)

    const store = useRecipesStore()
    await store.addItemToRecipe('recipe-1', 'item-1')
    await store.sync()

    await store.removeItemFromRecipe('recipe-1', 'item-1')
    expect(store.isItemInRecipe('recipe-1', 'item-1')).toBe(false)

    await store.sync()

    expect(recipesApiMocks.removeListItemFromRecipeApi).toHaveBeenCalledWith({
      recipe_id: 'recipe-1',
      list_item_id: 'item-1',
    })
    expect(store.pendingCount).toBe(0)
  })

  it('cancels a still-pending add instead of syncing an add-then-remove round trip', async () => {
    const store = useRecipesStore()
    await store.addItemToRecipe('recipe-1', 'item-1')
    expect(store.pendingCount).toBe(1)

    await store.removeItemFromRecipe('recipe-1', 'item-1')

    expect(store.pendingCount).toBe(0)
    await store.sync()
    expect(recipesApiMocks.addListItemToRecipeApi).not.toHaveBeenCalled()
    expect(recipesApiMocks.removeListItemFromRecipeApi).not.toHaveBeenCalled()
  })

  it('deletes a recipe locally, drops its item links, and syncs the deletion', async () => {
    recipesApiMocks.deleteRecipeApi.mockResolvedValueOnce(undefined)

    const store = useRecipesStore()
    await fakeDb.recipes.put({ id: 'recipe-to-delete', name: 'Delete Me', pendingSync: false })
    await fakeDb.recipeItems.put({ recipeId: 'recipe-to-delete', listItemId: 'item-1', pendingSync: false })
    await store.refresh()

    expect(store.recipes.find((r) => r.id === 'recipe-to-delete')).toBeDefined()
    expect(store.isItemInRecipe('recipe-to-delete', 'item-1')).toBe(true)

    await store.deleteRecipe('recipe-to-delete')

    expect(store.recipes.find((r) => r.id === 'recipe-to-delete')).toBeUndefined()
    expect(store.isItemInRecipe('recipe-to-delete', 'item-1')).toBe(false)

    await store.sync()

    expect(recipesApiMocks.deleteRecipeApi).toHaveBeenCalledWith('recipe-to-delete')
    expect(store.pendingCount).toBe(0)
  })

  it('unchecks every completed item linked to a recipe and syncs a single uncheck op', async () => {
    recipesApiMocks.uncheckRecipeApi.mockResolvedValueOnce(undefined)
    recipesApiMocks.getRecipeItemsApi.mockResolvedValueOnce([
      { id: 'item-1', list_id: 'list-1', title: 'Flour', is_completed: false },
      { id: 'item-2', list_id: 'list-1', title: 'Eggs', is_completed: false },
    ])

    const listsStore = useListsStore()
    await fakeDb.listItems.put({
      id: 'item-1',
      list_id: 'list-1',
      title: 'Flour',
      is_completed: true,
      pendingSync: false,
    })
    await fakeDb.listItems.put({
      id: 'item-2',
      list_id: 'list-1',
      title: 'Eggs',
      is_completed: false,
      pendingSync: false,
    })
    await listsStore.refresh()

    const store = useRecipesStore()
    await fakeDb.recipes.put({ id: 'recipe-1', name: 'Omelette', pendingSync: false })
    await fakeDb.recipeItems.put({ recipeId: 'recipe-1', listItemId: 'item-1', pendingSync: false })
    await fakeDb.recipeItems.put({ recipeId: 'recipe-1', listItemId: 'item-2', pendingSync: false })
    await store.refresh()

    await store.uncheckRecipe('recipe-1')

    expect(listsStore.listItems.find((i) => i.id === 'item-1')?.is_completed).toBe(false)
    expect(listsStore.listItems.find((i) => i.id === 'item-1')?.pendingSync).toBe(true)
    // Item 2 wasn't completed to begin with, so it's left untouched.
    expect(listsStore.listItems.find((i) => i.id === 'item-2')?.pendingSync).toBe(false)

    await store.sync()

    expect(recipesApiMocks.uncheckRecipeApi).toHaveBeenCalledWith('recipe-1')
    expect(store.pendingCount).toBe(0)
  })

  it('shares a recipe with the server when online and returns the share code', async () => {
    recipesApiMocks.shareRecipeApi.mockResolvedValueOnce({ code: 'abc123' })

    const store = useRecipesStore()
    const code = await store.shareRecipe('recipe-1')

    expect(recipesApiMocks.shareRecipeApi).toHaveBeenCalledWith('recipe-1')
    expect(code).toBe('abc123')
  })

  it('throws when sharing a recipe while offline without calling the API', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useRecipesStore()
    await expect(store.shareRecipe('recipe-1')).rejects.toThrow('Cannot share recipe while offline')

    expect(recipesApiMocks.shareRecipeApi).not.toHaveBeenCalled()
  })

  it('joins a recipe by code and pulls the latest state from the server', async () => {
    recipesApiMocks.joinRecipeApi.mockResolvedValueOnce(undefined)
    recipesApiMocks.getRecipesApi.mockResolvedValueOnce([{ id: 'shared-recipe', name: 'Shared' }])

    const store = useRecipesStore()
    await store.joinRecipe('abc123')

    expect(recipesApiMocks.joinRecipeApi).toHaveBeenCalledWith('abc123')
    expect(store.recipes.find((r) => r.id === 'shared-recipe')).toBeDefined()
  })

  it('throws when joining a recipe while offline without calling the API', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useRecipesStore()
    await expect(store.joinRecipe('abc123')).rejects.toThrow('Cannot join recipe while offline')

    expect(recipesApiMocks.joinRecipeApi).not.toHaveBeenCalled()
  })

  it('deletes a previously synced recipe locally when it is missing from the server', async () => {
    const store = useRecipesStore()
    await fakeDb.recipes.put({ id: 'server-recipe-1', name: 'Lasagna', pendingSync: false })
    await fakeDb.recipeItems.put({ recipeId: 'server-recipe-1', listItemId: 'item-1', pendingSync: false })
    await store.refresh()

    recipesApiMocks.getRecipesApi.mockResolvedValueOnce([])

    await store.pullRecipesFromServer()

    expect(store.recipes.find((r) => r.id === 'server-recipe-1')).toBeUndefined()
    expect(store.isItemInRecipe('server-recipe-1', 'item-1')).toBe(false)
  })

  it('does not overwrite a locally pending recipe with stale server data', async () => {
    recipesApiMocks.createRecipeApi.mockImplementation(() => new Promise(() => {}))

    const store = useRecipesStore()
    const localRecipe = await store.createRecipe('Local only')

    recipesApiMocks.getRecipesApi.mockResolvedValueOnce([
      { id: localRecipe.id, name: 'Server version' },
    ])

    await store.pullRecipesFromServer()

    const stillLocal = store.recipes.find((r) => r.id === localRecipe.id)
    expect(stillLocal?.name).toBe('Local only')
    expect(stillLocal?.pendingSync).toBe(true)
  })

  it('sorts recipes by newest created_at first', async () => {
    const store = useRecipesStore()
    await fakeDb.recipes.put({
      id: 'recipe-a',
      name: 'A',
      created_at: '2024-01-01T00:00:00.000Z',
      pendingSync: false,
    })
    await fakeDb.recipes.put({
      id: 'recipe-b',
      name: 'B',
      created_at: '2024-01-02T00:00:00.000Z',
      pendingSync: false,
    })
    await store.refresh()

    expect(store.sortedRecipes.map((r) => r.id)).toEqual(['recipe-b', 'recipe-a'])
  })

  it('does not sync before the debounce delay elapses, then syncs once it does', async () => {
    recipesApiMocks.createRecipeApi.mockResolvedValueOnce({ id: 'server-recipe-1', name: 'Lasagna' })

    const store = useRecipesStore()
    await store.createRecipe('Lasagna')

    await vi.advanceTimersByTimeAsync(399)
    expect(recipesApiMocks.createRecipeApi).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(recipesApiMocks.createRecipeApi).toHaveBeenCalledTimes(1)
  })
})
