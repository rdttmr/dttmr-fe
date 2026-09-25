import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Group } from '@/types/group'

// A minimal in-memory stand-in for the Dexie groups table (see lists.spec.ts
// for the fuller fake the other stores use).
function createFakeTable() {
  const store = new Map<string, Group>()
  return {
    async toArray() {
      return Array.from(store.values()).map((v) => ({ ...v }))
    },
    async put(record: Group) {
      store.set(record.id, { ...record })
    },
    async bulkPut(records: Group[]) {
      for (const record of records) store.set(record.id, { ...record })
    },
    async update(id: string, changes: Partial<Group>) {
      const existing = store.get(id)
      if (existing) store.set(id, { ...existing, ...changes })
    },
    async delete(id: string) {
      store.delete(id)
    },
    async bulkDelete(ids: string[]) {
      for (const id of ids) store.delete(id)
    },
    clear() {
      store.clear()
    },
  }
}

const fakeDb = vi.hoisted(() => ({}) as { groups: ReturnType<typeof createFakeTable> })
fakeDb.groups = createFakeTable()

vi.mock('@/database/db', () => ({ db: fakeDb }))

const groupsApiMocks = vi.hoisted(() => ({
  getGroupsApi: vi.fn<() => Promise<unknown>>(),
  createGroupApi: vi.fn<() => Promise<unknown>>(),
  renameGroupApi: vi.fn<() => Promise<unknown>>(),
  setDefaultGroupApi: vi.fn<() => Promise<unknown>>(),
  getGroupMembersApi: vi.fn<() => Promise<unknown>>(),
  shareGroupApi: vi.fn<() => Promise<unknown>>(),
  joinGroupApi: vi.fn<() => Promise<unknown>>(),
  deleteGroupApi: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/api/groups', () => groupsApiMocks)

const { useGroupsStore } = await import('../groups')
const { useListsStore } = await import('../lists')
const { useRecipesStore } = await import('../recipes')

const personal: Group = { id: 'g-personal', name: 'Personal', is_default: true, member_count: 1 }
const home: Group = { id: 'g-home', name: 'Home', is_default: false, member_count: 2 }

describe('useGroupsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(groupsApiMocks).forEach((mock) => mock.mockReset())
    fakeDb.groups.clear()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    localStorage.setItem('access_token', 'test-access-token')
    localStorage.setItem('refresh_token', 'test-refresh-token')
  })

  it('mirrors GET /groups into the cache, dropping groups the server no longer reports', async () => {
    await fakeDb.groups.put({ id: 'g-gone', name: 'Gone' })
    groupsApiMocks.getGroupsApi.mockResolvedValueOnce([home, personal])

    const store = useGroupsStore()
    await store.refresh()
    await store.sync()

    expect(store.sortedGroups.map((g) => g.id)).toEqual(['g-personal', 'g-home'])
    expect(store.defaultGroup?.id).toBe('g-personal')
    expect((await fakeDb.groups.toArray()).map((g) => g.id).sort()).toEqual([
      'g-home',
      'g-personal',
    ])
  })

  it('falls back to "All" when the remembered group no longer exists', () => {
    const store = useGroupsStore()
    store.groups = [personal, home]
    store.activeGroupId = 'g-home'
    expect(store.activeGroupId).toBe('g-home')

    store.groups = [personal]
    expect(store.activeGroupId).toBeNull()
  })

  it('moves the default flag to the chosen group', async () => {
    groupsApiMocks.setDefaultGroupApi.mockResolvedValueOnce(undefined)
    const store = useGroupsStore()
    store.groups = [{ ...personal }, { ...home }]

    await store.setDefaultGroup('g-home')

    expect(groupsApiMocks.setDefaultGroupApi).toHaveBeenCalledWith('g-home')
    expect(store.defaultGroup?.id).toBe('g-home')
    expect(store.groups.find((g) => g.id === 'g-personal')?.is_default).toBe(false)
  })

  it('refuses to delete the last group', async () => {
    const store = useGroupsStore()
    store.groups = [personal]

    await expect(store.deleteGroup('g-personal')).rejects.toThrow('only group')
    expect(groupsApiMocks.deleteGroupApi).not.toHaveBeenCalled()
  })

  it('refuses to delete a group that still has lists or recipes', async () => {
    const store = useGroupsStore()
    store.groups = [personal, home]
    useListsStore().lists = [{ id: 'l1', name: 'Groceries', group_id: 'g-home' }]
    useRecipesStore().recipes = [{ id: 'r1', name: 'Pancakes', group_id: 'g-home' }]

    await expect(store.deleteGroup('g-home')).rejects.toThrow(
      'Move or delete its 1 list and 1 recipe first.',
    )
    expect(groupsApiMocks.deleteGroupApi).not.toHaveBeenCalled()
  })

  it('deletes an empty group', async () => {
    groupsApiMocks.deleteGroupApi.mockResolvedValueOnce(undefined)
    await fakeDb.groups.bulkPut([personal, home])
    const store = useGroupsStore()
    await store.refresh()

    await store.deleteGroup('g-home')

    expect(groupsApiMocks.deleteGroupApi).toHaveBeenCalledWith('g-home')
    expect(store.groups.map((g) => g.id)).toEqual(['g-personal'])
    expect(await fakeDb.groups.toArray()).toHaveLength(1)
  })

  it('counts the creator as a member of a new group', async () => {
    // POST /groups reports member_count 0 even though the creator is in it.
    groupsApiMocks.createGroupApi.mockResolvedValueOnce({
      id: 'g-new',
      name: 'New',
      member_count: 0,
    })
    const store = useGroupsStore()

    const created = await store.createGroup('New')

    expect(created.member_count).toBe(1)
    expect(store.groups.find((g) => g.id === 'g-new')?.member_count).toBe(1)
  })

  it('does group mutations online only', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const store = useGroupsStore()

    await expect(store.createGroup('Home')).rejects.toThrow('offline')
    await expect(store.shareGroup('g-home')).rejects.toThrow('offline')
    expect(groupsApiMocks.createGroupApi).not.toHaveBeenCalled()
    expect(groupsApiMocks.shareGroupApi).not.toHaveBeenCalled()
  })

  it('joins a group by code, pulls everything and returns the new group', async () => {
    groupsApiMocks.joinGroupApi.mockResolvedValueOnce(undefined)
    groupsApiMocks.getGroupsApi.mockResolvedValueOnce([personal, home])
    await fakeDb.groups.put(personal)
    const store = useGroupsStore()
    const listsSync = vi.spyOn(useListsStore(), 'sync').mockResolvedValue()
    const recipesSync = vi.spyOn(useRecipesStore(), 'sync').mockResolvedValue()

    const joined = await store.joinGroup('abc123')

    expect(groupsApiMocks.joinGroupApi).toHaveBeenCalledWith('abc123')
    expect(joined?.id).toBe('g-home')
    expect(listsSync).toHaveBeenCalled()
    expect(recipesSync).toHaveBeenCalled()
  })
})
