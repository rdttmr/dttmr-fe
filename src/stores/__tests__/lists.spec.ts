import { describe, it, expect, beforeEach, vi } from 'vitest'
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
    where(field: string) {
      return {
        equals(value: unknown) {
          return {
            async toArray() {
              return Array.from(store.values())
                .filter((v) => v[field] === value)
                .map((v) => ({ ...v }))
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
}

vi.mock('@/database/db', () => ({
  db: fakeDb,
}))

const listsApiMocks = vi.hoisted(() => ({
  getListsApi: vi.fn<() => Promise<unknown>>(),
  createListApi: vi.fn<() => Promise<unknown>>(),
  getListItemsApi: vi.fn<() => Promise<unknown>>(),
  createListItemApi: vi.fn<() => Promise<unknown>>(),
  updateListItemApi: vi.fn<() => Promise<unknown>>(),
  setListItemCompletedApi: vi.fn<() => Promise<unknown>>(),
  addUserToListApi: vi.fn<() => Promise<unknown>>(),
  removeUserFromListApi: vi.fn<() => Promise<unknown>>(),
  deleteListApi: vi.fn<() => Promise<unknown>>(),
  deleteListItemApi: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/api/lists', () => listsApiMocks)

const { useListsStore } = await import('../lists')

describe('useListsStore', () => {
  beforeEach(async () => {
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

    // Default the read endpoints to an empty result so that the pullFromServer()
    // step chained onto every sync() call doesn't interfere with unrelated tests.
    listsApiMocks.getListsApi.mockResolvedValue([])
    listsApiMocks.getListItemsApi.mockResolvedValue([])
  })

  it('creates a list locally, queues a sync entry, and remaps the id after a successful sync', async () => {
    listsApiMocks.createListApi.mockResolvedValueOnce({ id: 'server-id-1', name: 'Groceries' })

    const store = useListsStore()
    const localList = await store.createList('Groceries', [])

    // wait for the fire-and-forget sync triggered by createList to settle
    await store.sync()

    expect(listsApiMocks.createListApi).toHaveBeenCalledWith({
      name: 'Groceries',
      user_ids: [],
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

  it('updates a list item locally and pushes the change to the server', async () => {
    listsApiMocks.createListItemApi.mockResolvedValueOnce({
      id: 'server-item-2',
      list_id: '',
      title: 'Eggs',
      is_completed: false,
    })
    listsApiMocks.updateListItemApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await store.createListItem('list-1', 'Eggs')
    await store.sync()
    const created = store.listItems.find((entry) => entry.title === 'Eggs')!

    await store.updateListItem(created.id, { is_completed: true })
    await store.sync()

    expect(listsApiMocks.updateListItemApi).toHaveBeenCalledWith({
      list_item_id: created.id,
      is_completed: true,
    })
    const updated = store.listItems.find((entry) => entry.id === created.id)
    expect(updated?.is_completed).toBe(true)
    expect(updated?.pendingSync).toBe(false)
  })

  it('does not attempt to sync while offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useListsStore()
    await store.createList('Offline list')
    await store.sync()

    expect(listsApiMocks.createListApi).not.toHaveBeenCalled()
    expect(store.pendingCount).toBe(1)
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

  it('shares list with server when online without adding to sync queue', async () => {
    listsApiMocks.addUserToListApi.mockResolvedValueOnce(undefined)

    const store = useListsStore()
    await store.addUserToList('list-1', 'friend@example.com')

    expect(listsApiMocks.addUserToListApi).toHaveBeenCalledWith({
      list_id: 'list-1',
      email: 'friend@example.com',
    })
    expect(store.pendingCount).toBe(0)
  })

  it('throws error when sharing list while offline without calling API or adding to sync queue', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    const store = useListsStore()
    await expect(store.addUserToList('list-1', 'friend@example.com')).rejects.toThrow(
      'Cannot share list while offline',
    )

    expect(listsApiMocks.addUserToListApi).not.toHaveBeenCalled()
    expect(store.pendingCount).toBe(0)
  })

  it('propagates error when sharing list fails on server without adding to sync queue', async () => {
    listsApiMocks.addUserToListApi.mockRejectedValueOnce(new Error('User not found'))

    const store = useListsStore()
    await expect(store.addUserToList('list-1', 'unknown@example.com')).rejects.toThrow(
      'User not found',
    )

    expect(store.pendingCount).toBe(0)
  })
})
