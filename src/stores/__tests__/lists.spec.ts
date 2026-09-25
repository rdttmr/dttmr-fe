import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ApiError } from '@/api/http'

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
    orderBy(field: string) {
      return {
        async toArray() {
          return Array.from(store.values())
            .sort((a, b) => Number(a[field]) - Number(b[field]))
            .map((v) => ({ ...v }))
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

const fakeDb = {
  lists: createFakeTable(),
  listItems: createFakeTable(),
  syncQueue: createFakeTable(true),
  // lists.ts cross-notifies the recipes store (e.g. deleteList/deleteListItem
  // drop any recipe membership referencing a removed item) - these tests
  // don't exercise recipes themselves, so empty fake tables are enough to
  // satisfy those calls.
  recipes: createFakeTable(),
  recipeItems: createFakeTable(),
}

vi.mock('@/database/db', () => ({
  db: fakeDb,
}))

const listsApiMocks = vi.hoisted(() => ({
  getListsApi: vi.fn<() => Promise<unknown>>(),
  createListApi: vi.fn<() => Promise<unknown>>(),
  renameListApi: vi.fn<() => Promise<unknown>>(),
  getListItemsApi: vi.fn<() => Promise<unknown>>(),
  createListItemApi: vi.fn<() => Promise<unknown>>(),
  updateListItemTitleApi: vi.fn<() => Promise<unknown>>(),
  setListItemCompletedApi: vi.fn<() => Promise<unknown>>(),
  setListGroupApi: vi.fn<() => Promise<unknown>>(),
  deleteListApi: vi.fn<() => Promise<unknown>>(),
  deleteListItemApi: vi.fn<() => Promise<unknown>>(),
  orderListsApi: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/api/lists', () => listsApiMocks)

const { useListsStore } = await import('../lists')
const { useGroupsStore } = await import('../groups')
const { useRecipesStore } = await import('../recipes')
const { useAuthStore } = await import('../auth')
const { PULL_FRESH_MS } = await import('@/utils/pullFreshness')

// Only the claims matter here; the app never verifies the signature.
function fakeJwt(userId: string) {
  return `header.${btoa(JSON.stringify({ user_id: userId }))}.signature`
}

describe('useListsStore', () => {
  beforeEach(async () => {
    // Mutations schedule a debounced sync() via setTimeout; faking timers
    // keeps that pending timer from firing against a later test's mocks
    // instead of the ones set up here (tests trigger sync() explicitly).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    Object.values(listsApiMocks).forEach((mock) => mock.mockReset())

    for (const table of Object.values(fakeDb)) {
      const all = await table.toArray()
      for (const record of all) {
        await table.delete(record.id)
      }
    }

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

    // sync() is a no-op for anonymous visitors (see lists.ts); these tests
    // exercise the authenticated sync path, so seed a logged-in session.
    localStorage.setItem('access_token', 'test-access-token')
    localStorage.setItem('refresh_token', 'test-refresh-token')

    // Default the read endpoints to an empty result so that the pullFromServer()
    // step chained onto every sync() call doesn't interfere with unrelated tests.
    listsApiMocks.getListsApi.mockResolvedValue([])
    listsApiMocks.getListItemsApi.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a list locally, queues a sync entry, and remaps the id after a successful sync', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-id-1', name: 'Groceries' })
    // The chained pullFromServer() call needs to report the just-created list
    // back, otherwise it would look like the server deleted it.
    listsApiMocks.getListsApi.mockResolvedValueOnce([{ id: 'server-id-1', name: 'Groceries' }])

    const store = useListsStore()
    const localList = await store.createList('Groceries')

    // wait for the fire-and-forget sync triggered by createList to settle
    await store.sync()

    expect(listsApiMocks.createListApi).toHaveBeenCalledWith({
      name: 'Groceries',
    })
    expect(store.lists.find((list) => list.id === localList.id)).toBeUndefined()
    const synced = store.lists.find((list) => list.id === 'server-id-1')
    expect(synced).toBeDefined()
    expect(synced?.pendingSync).toBe(false)
    expect(store.pendingCount).toBe(0)
  })

  it('creates a list item locally and remaps it to the server-assigned id once synced', async () => {
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-1',
      list_id: '',
      title: 'Milk',
      is_completed: false,
    })

    const store = useListsStore()
    const item = await store.createListItem('list-1', 'Milk')
    await store.sync()

    expect(listsApiMocks.createListItemApi).toHaveBeenCalledWith({
      list_id: 'list-1',
      title: 'Milk',
    })
    expect(store.listItems.find((entry) => entry.id === item.id)).toBeUndefined()
    const synced = store.listItems.find((entry) => entry.id === 'server-item-1')
    expect(synced).toBeDefined()
    expect(synced?.pendingSync).toBe(false)
    expect(store.pendingCount).toBe(0)
  })

  it('keeps the entry in the sync queue and records the error when the API call fails', async () => {
    listsApiMocks.createListItemApi.mockRejectedValueOnce(new Error('Network error'))

    const store = useListsStore()
    await store.createListItem('list-1', 'Bread')
    await store.sync()

    expect(store.pendingCount).toBe(1)
    expect(store.error).toBe('Network error')
  })

  it('updates a list item title locally and pushes the change via the dedicated endpoint', async () => {
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-2',
      list_id: '',
      title: 'Eggs',
      is_completed: false,
    })
    listsApiMocks.updateListItemTitleApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await store.createListItem('list-1', 'Eggs')
    await store.sync()
    const created = store.listItems.find((entry) => entry.title === 'Eggs')!

    await store.updateListItemTitle(created.id, 'Free-range eggs')
    await store.sync()

    expect(listsApiMocks.updateListItemTitleApi).toHaveBeenCalledWith(created.id, {
      title: 'Free-range eggs',
    })
    const updated = store.listItems.find((entry) => entry.id === created.id)
    expect(updated?.title).toBe('Free-range eggs')
    expect(updated?.pendingSync).toBe(false)
  })

  it('renames a list locally and pushes the change via the dedicated endpoint', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-id-9', name: 'Groceries' })
    listsApiMocks.renameListApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValue([{ id: 'server-id-9', name: 'Groceries' }])

    const store = useListsStore()
    await store.createList('Groceries')
    await store.sync()

    await store.renameList('server-id-9', 'Weekly shop')
    expect(store.lists.find((entry) => entry.id === 'server-id-9')?.name).toBe('Weekly shop')
    expect(store.lists.find((entry) => entry.id === 'server-id-9')?.pendingSync).toBe(true)

    listsApiMocks.getListsApi.mockResolvedValue([{ id: 'server-id-9', name: 'Weekly shop' }])
    await store.sync()

    expect(listsApiMocks.renameListApi).toHaveBeenCalledWith('server-id-9', {
      name: 'Weekly shop',
    })
    const renamed = store.lists.find((entry) => entry.id === 'server-id-9')
    expect(renamed?.name).toBe('Weekly shop')
    expect(renamed?.pendingSync).toBe(false)
    expect(store.pendingCount).toBe(0)
  })

  it('renames a list created offline against its server id once the create has synced', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-id-10', name: 'Groceries' })
    listsApiMocks.renameListApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValue([{ id: 'server-id-10', name: 'Weekly shop' }])

    const store = useListsStore()
    const local = await store.createList('Groceries')
    await store.renameList(local.id, 'Weekly shop')
    await store.sync()

    expect(listsApiMocks.renameListApi).toHaveBeenCalledWith('server-id-10', {
      name: 'Weekly shop',
    })
    expect(store.lists.find((entry) => entry.id === 'server-id-10')?.name).toBe('Weekly shop')
  })

  it('does not attempt to sync while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useListsStore()
    await store.createList('Offline list')
    await store.sync()

    expect(listsApiMocks.createListApi).not.toHaveBeenCalled()
    expect(store.pendingCount).toBe(1)
  })

  it('does not attempt to sync when logged out, e.g. an anonymous visitor on a public invite link', async () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')

    const store = useListsStore()
    await store.sync()

    expect(listsApiMocks.getListsApi).not.toHaveBeenCalled()
  })

  it('sets a list item completed locally and pushes it via the dedicated endpoint', async () => {
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-3',
      list_id: '',
      title: 'Eggs',
      is_completed: false,
    })
    listsApiMocks.setListItemCompletedApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await store.createListItem('list-1', 'Eggs')
    await store.sync()
    const created = store.listItems.find((entry) => entry.title === 'Eggs')!

    await store.setListItemCompleted(created.id, true)
    await store.sync()

    expect(listsApiMocks.setListItemCompletedApi).toHaveBeenCalledWith(created.id, {
      is_completed: true,
    })
    const updated = store.listItems.find((entry) => entry.id === created.id)
    expect(updated?.is_completed).toBe(true)
    expect(updated?.pendingSync).toBe(false)
  })

  it('pulls lists from the server, including total/completed item counts, without fetching every item', async () => {
    listsApiMocks.getListsApi.mockResolvedValueOnce([
      { id: 'server-list-1', name: 'Groceries', total_items: 3, completed_items: 1 },
    ])

    const store = useListsStore()
    await store.pullFromServer()

    const pulledList = store.lists.find((list) => list.id === 'server-list-1')
    expect(pulledList).toBeDefined()
    expect(pulledList?.total_items).toBe(3)
    expect(pulledList?.completed_items).toBe(1)
    expect(listsApiMocks.getListItemsApi).not.toHaveBeenCalled()
  })

  it('pulls the items of a single list on demand via pullListItems', async () => {
    listsApiMocks.getListItemsApi.mockResolvedValueOnce([
      { id: 'server-item-1', list_id: 'server-list-1', title: 'Milk', is_completed: false },
    ])

    const store = useListsStore()
    await store.pullListItems('server-list-1')

    expect(listsApiMocks.getListItemsApi).toHaveBeenCalledWith('server-list-1')
    expect(store.listItems.find((item) => item.id === 'server-item-1')).toBeDefined()
  })

  it('deletes a previously synced list locally when it is missing from the server', async () => {
    const store = useListsStore()
    await fakeDb.lists.put({ id: 'server-list-1', name: 'Groceries', pendingSync: false })
    await fakeDb.listItems.put({
      id: 'server-item-1',
      list_id: 'server-list-1',
      title: 'Milk',
      pendingSync: false,
    })
    await store.refresh()

    listsApiMocks.getListsApi.mockResolvedValueOnce([])

    await store.pullFromServer()

    expect(store.lists.find((list) => list.id === 'server-list-1')).toBeUndefined()
    expect(store.listItems.find((item) => item.id === 'server-item-1')).toBeUndefined()
  })

  it('deletes a previously synced list item locally when it is missing from the server', async () => {
    const store = useListsStore()
    await fakeDb.listItems.put({
      id: 'server-item-2',
      list_id: 'server-list-1',
      title: 'Bread',
      pendingSync: false,
    })
    await store.refresh()

    listsApiMocks.getListItemsApi.mockResolvedValueOnce([])

    await store.pullListItems('server-list-1')

    expect(store.listItems.find((item) => item.id === 'server-item-2')).toBeUndefined()
  })

  it('does not delete a locally pending list even when it is missing from the server', async () => {
    listsApiMocks.createListApi.mockImplementation(() => new Promise(() => {}))

    const store = useListsStore()
    const localList = await store.createList('Local only')

    listsApiMocks.getListsApi.mockResolvedValueOnce([])

    await store.pullFromServer()

    expect(store.lists.find((list) => list.id === localList.id)).toBeDefined()
  })

  it('does not overwrite a locally pending list with stale server data', async () => {
    listsApiMocks.createListApi.mockImplementation(() => new Promise(() => {}))

    const store = useListsStore()
    const localList = await store.createList('Local only')

    listsApiMocks.getListsApi.mockResolvedValueOnce([{ id: localList.id, name: 'Server version' }])

    await store.pullFromServer()

    const stillLocal = store.lists.find((list) => list.id === localList.id)
    expect(stillLocal?.name).toBe('Local only')
    expect(stillLocal?.pendingSync).toBe(true)
  })

  it('deletes a list locally and syncs deletion to the server', async () => {
    listsApiMocks.deleteListApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-to-delete', name: 'Delete Me' })
    await fakeDb.listItems.put({ id: 'item-in-list', list_id: 'list-to-delete', title: 'Item' })
    await store.refresh()

    expect(store.lists.find((l) => l.id === 'list-to-delete')).toBeDefined()
    expect(store.listItems.find((i) => i.id === 'item-in-list')).toBeDefined()

    await store.deleteList('list-to-delete')

    expect(store.lists.find((l) => l.id === 'list-to-delete')).toBeUndefined()
    expect(store.listItems.find((i) => i.id === 'item-in-list')).toBeUndefined()

    await store.sync()

    expect(listsApiMocks.deleteListApi).toHaveBeenCalledWith('list-to-delete')
    expect(store.pendingCount).toBe(0)
  })

  it('deletes a list item locally and syncs deletion to the server', async () => {
    listsApiMocks.deleteListItemApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await fakeDb.listItems.put({ id: 'item-to-delete', list_id: 'list-1', title: 'Delete Me' })
    await store.refresh()

    expect(store.listItems.find((i) => i.id === 'item-to-delete')).toBeDefined()

    await store.deleteListItem('item-to-delete')

    expect(store.listItems.find((i) => i.id === 'item-to-delete')).toBeUndefined()

    await store.sync()

    expect(listsApiMocks.deleteListItemApi).toHaveBeenCalledWith('item-to-delete')
    expect(store.pendingCount).toBe(0)
  })

  it('creates a list in the given group and sends its group_id', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({
      id: 'server-id-g',
      group_id: 'group-home',
      name: 'Groceries',
    })

    const store = useListsStore()
    const local = await store.createList('Groceries', 'group-home')
    expect(local.group_id).toBe('group-home')

    await store.sync()

    expect(listsApiMocks.createListApi).toHaveBeenCalledWith({
      name: 'Groceries',
      group_id: 'group-home',
    })
  })

  it('leaves group_id out of the create payload without a group, assuming the default group locally', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-id-d', name: 'Groceries' })
    useGroupsStore().groups = [
      { id: 'group-personal', name: 'Personal', is_default: true },
      { id: 'group-home', name: 'Home', is_default: false },
    ]

    const store = useListsStore()
    const local = await store.createList('Groceries')
    expect(local.group_id).toBe('group-personal')

    await store.sync()

    expect(listsApiMocks.createListApi).toHaveBeenCalledWith({ name: 'Groceries' })
  })

  it('moves a list to another group and drops recipe links that now cross groups', async () => {
    listsApiMocks.setListGroupApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValue([
      { id: 'list-1', group_id: 'group-a', name: 'Groceries' },
    ])
    await fakeDb.lists.put({ id: 'list-1', group_id: 'group-a', name: 'Groceries' })
    await fakeDb.listItems.put({ id: 'item-1', list_id: 'list-1', title: 'Milk' })

    const store = useListsStore()
    await store.refresh()
    const recipesStore = useRecipesStore()
    vi.spyOn(recipesStore, 'sync').mockResolvedValue()
    recipesStore.recipes = [
      { id: 'recipe-a', group_id: 'group-a', name: 'Pancakes', total_items: 1 },
      { id: 'recipe-b', group_id: 'group-b', name: 'Porridge', total_items: 0 },
    ]
    recipesStore.recipeItemLinks = [{ recipeId: 'recipe-a', listItemId: 'item-1' }]

    await store.moveListToGroup('list-1', 'group-b')

    expect(listsApiMocks.setListGroupApi).toHaveBeenCalledWith('list-1', { group_id: 'group-b' })
    expect(store.lists.find((list) => list.id === 'list-1')?.group_id).toBe('group-b')
    expect((await fakeDb.lists.get('list-1'))?.group_id).toBe('group-b')
    expect(recipesStore.recipeItemLinks).toEqual([])
    expect(recipesStore.recipes.find((r) => r.id === 'recipe-a')?.total_items).toBe(0)
  })

  it('refuses to move a list while offline without calling the API', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useListsStore()
    await expect(store.moveListToGroup('list-1', 'group-b')).rejects.toThrow(
      'Cannot move a list while offline',
    )

    expect(listsApiMocks.setListGroupApi).not.toHaveBeenCalled()
  })

  it('refuses to move a list whose create has not synced yet', async () => {
    listsApiMocks.createListApi.mockRejectedValue(new Error('Network error'))

    const store = useListsStore()
    const local = await store.createList('Groceries')

    await expect(store.moveListToGroup(local.id, 'group-b')).rejects.toThrow("hasn't synced yet")
    expect(listsApiMocks.setListGroupApi).not.toHaveBeenCalled()
  })

  it("leaves the recipes store's queued operations alone instead of consuming them", async () => {
    await fakeDb.syncQueue.add({
      type: 'createRecipe',
      payload: { name: 'Lasagna' },
      localRecipeId: 'recipe-1',
      createdAt: 1,
      attempts: 0,
    })

    const store = useListsStore()
    await store.sync()

    expect(await fakeDb.syncQueue.toArray()).toHaveLength(1)
  })

  it('does not sync before the debounce delay elapses, then syncs once it does', async () => {
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-1',
      list_id: 'list-1',
      title: 'Milk',
      is_completed: false,
    })

    const store = useListsStore()
    await store.createListItem('list-1', 'Milk')

    await vi.advanceTimersByTimeAsync(399)
    expect(listsApiMocks.createListItemApi).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(listsApiMocks.createListItemApi).toHaveBeenCalledTimes(1)
  })

  it('collapses a burst of mutations within the debounce window into a single sync pass', async () => {
    listsApiMocks.createListItemApi
      .mockResolvedValueOnce({
        id: 'server-item-a',
        list_id: 'list-1',
        title: 'A',
        is_completed: false,
      })
      .mockResolvedValueOnce({
        id: 'server-item-b',
        list_id: 'list-1',
        title: 'B',
        is_completed: false,
      })

    const store = useListsStore()
    await store.createListItem('list-1', 'A')
    await store.createListItem('list-1', 'B')

    expect(listsApiMocks.createListItemApi).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(400)

    expect(listsApiMocks.createListItemApi).toHaveBeenCalledTimes(2)
    expect(store.pendingCount).toBe(0)
  })

  it('sorts lists by position, breaking ties (e.g. two lists both at position 0) by newest first', async () => {
    const store = useListsStore()
    await fakeDb.lists.put({
      id: 'list-b',
      name: 'B',
      position: 1,
      created_at: '2024-01-01T00:00:00.000Z',
      pendingSync: false,
    })
    await fakeDb.lists.put({
      id: 'list-a',
      name: 'A',
      position: 0,
      created_at: '2024-01-02T00:00:00.000Z',
      pendingSync: false,
    })
    // Newly created lists always come back from the server at position 0 (so
    // a new list is always on top), so a not-yet-synced local list (no
    // position of its own yet, defaulting to 0) must also win the tiebreak
    // against any existing position-0 list by virtue of being newest.
    await fakeDb.lists.put({
      id: 'list-new',
      name: 'New',
      created_at: '2024-01-03T00:00:00.000Z',
      pendingSync: true,
    })
    await store.refresh()

    expect(store.sortedLists.map((list) => list.id)).toEqual(['list-new', 'list-a', 'list-b'])
  })

  it('reorders lists optimistically and pushes the new order via the dedicated endpoint', async () => {
    listsApiMocks.orderListsApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValueOnce([
      { id: 'list-a', name: 'A', position: 1 },
      { id: 'list-b', name: 'B', position: 0 },
    ])

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await fakeDb.lists.put({ id: 'list-b', name: 'B', position: 1, pendingSync: false })
    await store.refresh()

    await store.reorderLists(['list-b', 'list-a'])

    expect(store.sortedLists.map((list) => list.id)).toEqual(['list-b', 'list-a'])
    expect(store.lists.every((list) => list.pendingSync)).toBe(true)

    await store.sync()

    expect(listsApiMocks.orderListsApi).toHaveBeenCalledWith({ list_ids: ['list-b', 'list-a'] })
    expect(store.lists.find((list) => list.id === 'list-a')?.pendingSync).toBe(false)
    expect(store.lists.find((list) => list.id === 'list-b')?.pendingSync).toBe(false)
    expect(store.pendingCount).toBe(0)
  })

  it('supersedes a stale queued reorder instead of replaying both', async () => {
    listsApiMocks.orderListsApi.mockResolvedValue(undefined)

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await fakeDb.lists.put({ id: 'list-b', name: 'B', position: 1, pendingSync: false })
    await store.refresh()

    await store.reorderLists(['list-b', 'list-a'])
    await store.reorderLists(['list-a', 'list-b'])
    expect(store.pendingCount).toBe(1)

    await store.sync()

    expect(listsApiMocks.orderListsApi).toHaveBeenCalledTimes(1)
    expect(listsApiMocks.orderListsApi).toHaveBeenCalledWith({ list_ids: ['list-a', 'list-b'] })
  })

  it('remaps a queued reorder entry when one of its lists gets its server id assigned mid-flight', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-list-1', name: 'New list' })
    listsApiMocks.orderListsApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValueOnce([
      { id: 'server-list-1', name: 'New list', position: 0 },
      { id: 'list-a', name: 'A', position: 1 },
    ])

    const store = useListsStore()
    const localList = await store.createList('New list')
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await store.refresh()

    // Queues an "orderLists" entry referencing the not-yet-synced localList.id,
    // created after the still-pending "createList" entry.
    await store.reorderLists([localList.id, 'list-a'])
    await store.sync()

    expect(listsApiMocks.orderListsApi).toHaveBeenCalledWith({
      list_ids: ['server-list-1', 'list-a'],
    })
  })

  it('rebases a reorder the server rejected as stale onto its current lists and resends it once', async () => {
    // "list-c" was created on another device after this one queued its reorder.
    listsApiMocks.getListsApi.mockResolvedValue([
      { id: 'list-a', name: 'A', position: 1, created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'list-b', name: 'B', position: 2, created_at: '2024-01-02T00:00:00.000Z' },
      { id: 'list-c', name: 'C', position: 0, created_at: '2024-01-03T00:00:00.000Z' },
    ])
    listsApiMocks.orderListsApi
      .mockRejectedValueOnce(new ApiError('stale list ids', 400))
      .mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await fakeDb.lists.put({ id: 'list-b', name: 'B', position: 1, pendingSync: false })
    await store.refresh()

    await store.reorderLists(['list-b', 'list-a'])
    await store.sync()

    expect(listsApiMocks.orderListsApi).toHaveBeenCalledTimes(2)
    expect(listsApiMocks.orderListsApi).toHaveBeenNthCalledWith(1, {
      list_ids: ['list-b', 'list-a'],
    })
    expect(listsApiMocks.orderListsApi).toHaveBeenNthCalledWith(2, {
      list_ids: ['list-c', 'list-b', 'list-a'],
    })
    expect(await fakeDb.syncQueue.toArray()).toHaveLength(0)
    expect(store.pendingCount).toBe(0)
    expect(store.error).toBeNull()
  })

  it('drops a reorder the server keeps rejecting, without blocking later changes or retrying it', async () => {
    listsApiMocks.getListsApi.mockResolvedValue([
      { id: 'list-a', name: 'A', position: 0 },
      { id: 'list-b', name: 'B', position: 1 },
    ])
    listsApiMocks.orderListsApi.mockRejectedValue(new ApiError('stale list ids', 400))
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-1',
      list_id: 'list-a',
      title: 'Milk',
      is_completed: false,
    })

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await fakeDb.lists.put({ id: 'list-b', name: 'B', position: 1, pendingSync: false })
    await store.refresh()

    await store.reorderLists(['list-b', 'list-a'])
    await store.createListItem('list-a', 'Milk')
    await store.sync()

    // The reorder came first in the queue but must not stall what follows it.
    expect(listsApiMocks.createListItemApi).toHaveBeenCalledTimes(1)
    // The original attempt plus exactly one rebased resend, then it is dropped.
    expect(listsApiMocks.orderListsApi).toHaveBeenCalledTimes(2)
    expect(await fakeDb.syncQueue.toArray()).toHaveLength(0)
    expect(store.pendingCount).toBe(0)
    expect(store.error).toContain("Couldn't save the new list order")
    // The abandoned optimistic order gives way to the server's.
    expect(store.sortedLists.map((list) => list.id)).toEqual(['list-a', 'list-b'])
    expect(store.lists.some((list) => list.pendingSync)).toBe(false)

    listsApiMocks.orderListsApi.mockClear()
    await store.sync()
    expect(listsApiMocks.orderListsApi).not.toHaveBeenCalled()
  })

  it('retries a reorder failing for a non-rejection reason only a few times, without blocking later changes', async () => {
    listsApiMocks.getListsApi.mockResolvedValue([
      { id: 'list-a', name: 'A', position: 0 },
      { id: 'list-b', name: 'B', position: 1 },
    ])
    listsApiMocks.orderListsApi.mockRejectedValue(new Error('Failed to fetch'))
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-1',
      list_id: 'list-a',
      title: 'Milk',
      is_completed: false,
    })

    const store = useListsStore()
    await fakeDb.lists.put({ id: 'list-a', name: 'A', position: 0, pendingSync: false })
    await fakeDb.lists.put({ id: 'list-b', name: 'B', position: 1, pendingSync: false })
    await store.refresh()

    await store.reorderLists(['list-b', 'list-a'])
    await store.createListItem('list-a', 'Milk')

    await store.sync()
    expect(listsApiMocks.createListItemApi).toHaveBeenCalledTimes(1)
    expect(store.pendingCount).toBe(1)
    // Still waiting to be retried, so the optimistic order stays on screen.
    expect(store.sortedLists.map((list) => list.id)).toEqual(['list-b', 'list-a'])

    await store.sync()
    expect(store.pendingCount).toBe(1)

    await store.sync()
    expect(store.pendingCount).toBe(0)
    expect(listsApiMocks.orderListsApi).toHaveBeenCalledTimes(3)
    expect(store.sortedLists.map((list) => list.id)).toEqual(['list-a', 'list-b'])

    await store.sync()
    expect(listsApiMocks.orderListsApi).toHaveBeenCalledTimes(3)
  })

  it('serializes pullListItems() behind an in-flight sync() so they never race on the same rows', async () => {
    let resolveGetLists!: (value: unknown[]) => void
    listsApiMocks.getListsApi.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGetLists = resolve
        }),
    )
    listsApiMocks.getListItemsApi.mockResolvedValueOnce([
      { id: 'server-item-1', list_id: 'list-1', title: 'Milk', is_completed: false },
    ])

    const store = useListsStore()

    const syncPromise = store.sync()
    const pullPromise = store.pullListItems('list-1')

    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // pullListItems is chained behind sync() via the shared operation queue,
    // so its own (already-mocked, instantly resolvable) API call must not
    // fire while sync()'s getListsApi call is still pending.
    expect(listsApiMocks.getListItemsApi).not.toHaveBeenCalled()

    resolveGetLists([])
    await syncPromise
    await pullPromise

    expect(listsApiMocks.getListItemsApi).toHaveBeenCalledWith('list-1')
    expect(store.listItems.find((item) => item.id === 'server-item-1')).toBeDefined()
  })

  describe('pull freshness', () => {
    it('skips GET /lists while the last pull is fresh, but still pushes queued edits', async () => {
      listsApiMocks.getListsApi.mockResolvedValue([
        { id: 'list-1', name: 'Groceries', total_items: 1, completed_items: 0 },
      ])
      await fakeDb.listItems.put({
        id: 'item-1',
        list_id: 'list-1',
        title: 'Milk',
        is_completed: false,
      })
      listsApiMocks.setListItemCompletedApi.mockResolvedValue(undefined)

      const store = useListsStore()
      await store.sync()
      await store.sync()
      await store.setListItemCompleted('item-1', true)
      await store.sync()

      expect(listsApiMocks.getListsApi).toHaveBeenCalledTimes(1)
      expect(listsApiMocks.setListItemCompletedApi).toHaveBeenCalledTimes(1)
      expect(store.pendingCount).toBe(0)
    })

    it('pulls again once the window has passed, or right away when forced', async () => {
      const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
      const store = useListsStore()

      await store.sync()
      await store.sync({ force: true })
      expect(listsApiMocks.getListsApi).toHaveBeenCalledTimes(2)

      now.mockReturnValue(1_000_000 + PULL_FRESH_MS)
      await store.sync()
      expect(listsApiMocks.getListsApi).toHaveBeenCalledTimes(3)
    })

    it('does not count a failed pull as fresh', async () => {
      listsApiMocks.getListsApi.mockRejectedValueOnce(new Error('Network error'))
      const store = useListsStore()

      await store.sync()
      await store.sync()

      expect(listsApiMocks.getListsApi).toHaveBeenCalledTimes(2)
    })

    it("does not let one account's fresh pull stand in for another's after a re-login", async () => {
      const auth = useAuthStore()
      auth.setTokens({ access_token: fakeJwt('user-a'), refresh_token: 'r' })
      const store = useListsStore()
      await store.sync()

      auth.setTokens({ access_token: fakeJwt('user-b'), refresh_token: 'r' })
      await store.sync()

      expect(listsApiMocks.getListsApi).toHaveBeenCalledTimes(2)
    })

    it("skips re-pulling a list's items while fresh, and recounts the list from them", async () => {
      await fakeDb.lists.put({
        id: 'list-1',
        name: 'Groceries',
        total_items: 5,
        completed_items: 5,
      })
      listsApiMocks.getListItemsApi.mockResolvedValue([
        { id: 'item-1', list_id: 'list-1', title: 'Milk', is_completed: true },
        { id: 'item-2', list_id: 'list-1', title: 'Eggs', is_completed: false },
      ])

      const store = useListsStore()
      await store.ensureLoaded()
      await store.pullListItems('list-1')
      await store.pullListItems('list-1')

      expect(listsApiMocks.getListItemsApi).toHaveBeenCalledTimes(1)
      const list = store.lists.find((entry) => entry.id === 'list-1')
      expect(list?.total_items).toBe(2)
      expect(list?.completed_items).toBe(1)

      await store.pullListItems('list-1', { force: true })
      expect(listsApiMocks.getListItemsApi).toHaveBeenCalledTimes(2)
    })

    it("re-pulls a list's items once GET /lists shows its counts changed elsewhere", async () => {
      await fakeDb.lists.put({
        id: 'list-1',
        name: 'Groceries',
        total_items: 0,
        completed_items: 0,
      })
      const store = useListsStore()
      await store.ensureLoaded()
      await store.pullListItems('list-1')

      listsApiMocks.getListsApi.mockResolvedValueOnce([
        { id: 'list-1', name: 'Groceries', total_items: 1, completed_items: 0 },
      ])
      await store.sync()
      await store.pullListItems('list-1')

      expect(listsApiMocks.getListItemsApi).toHaveBeenCalledTimes(2)
    })
  })

  describe('local item counts', () => {
    beforeEach(async () => {
      await fakeDb.lists.put({
        id: 'list-1',
        name: 'Groceries',
        total_items: 2,
        completed_items: 1,
      })
      await fakeDb.listItems.put({
        id: 'item-1',
        list_id: 'list-1',
        title: 'Milk',
        is_completed: true,
      })
      await fakeDb.listItems.put({
        id: 'item-2',
        list_id: 'list-1',
        title: 'Eggs',
        is_completed: false,
      })
    })

    function counts(store: ReturnType<typeof useListsStore>) {
      const list = store.lists.find((entry) => entry.id === 'list-1')
      return [list?.total_items, list?.completed_items]
    }

    it('updates counts when items are created, completed and deleted', async () => {
      const store = useListsStore()
      await store.ensureLoaded()

      await store.createListItem('list-1', 'Bread')
      expect(counts(store)).toEqual([3, 1])
      await store.setListItemCompleted('item-2', true)
      expect(counts(store)).toEqual([3, 2])
      // Completing an item that already is completed changes nothing.
      await store.setListItemCompleted('item-2', true)
      expect(counts(store)).toEqual([3, 2])
      await store.deleteListItem('item-1')
      expect(counts(store)).toEqual([2, 1])
      expect((await fakeDb.lists.get('list-1'))?.total_items).toBe(2)
    })

    it("keeps local counts through a pull while the server hasn't seen an item edit yet", async () => {
      listsApiMocks.deleteListItemApi.mockRejectedValue(new Error('Network error'))
      listsApiMocks.getListsApi.mockResolvedValue([
        { id: 'list-1', name: 'Groceries', total_items: 2, completed_items: 1 },
      ])

      const store = useListsStore()
      await store.ensureLoaded()
      await store.deleteListItem('item-2')
      await store.sync()

      expect(listsApiMocks.getListsApi).toHaveBeenCalled()
      expect(counts(store)).toEqual([1, 1])
    })
  })

  it("sends an item added to a list created offline with the list's server id", async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-list-1', name: 'Groceries' })
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-1',
      list_id: 'server-list-1',
      title: 'Milk',
      is_completed: false,
    })
    listsApiMocks.getListsApi.mockResolvedValue([{ id: 'server-list-1', name: 'Groceries' }])

    const store = useListsStore()
    const list = await store.createList('Groceries')
    await store.createListItem(list.id, 'Milk')
    await store.sync()

    expect(listsApiMocks.createListItemApi).toHaveBeenCalledWith({
      list_id: 'server-list-1',
      title: 'Milk',
    })
  })

  it("leaves a queued item delete's item id alone when its list gets its server id", async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-list-1', name: 'Groceries' })
    listsApiMocks.deleteListItemApi.mockResolvedValueOnce(undefined)
    listsApiMocks.getListsApi.mockResolvedValue([{ id: 'server-list-1', name: 'Groceries' }])

    const store = useListsStore()
    const list = await store.createList('Groceries')
    await fakeDb.listItems.put({
      id: 'item-9',
      list_id: list.id,
      title: 'Milk',
      is_completed: false,
    })
    await store.deleteListItem('item-9')
    await store.sync()

    expect(listsApiMocks.deleteListItemApi).toHaveBeenCalledWith('item-9')
  })
})
