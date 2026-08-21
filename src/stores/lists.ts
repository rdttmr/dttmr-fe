import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { db, type LocalList, type LocalListItem, type SyncQueueEntry } from '@/database/db'
import {
  getListsApi,
  createListApi,
  getListItemsApi,
  createListItemApi,
  updateListItemApi,
  setListItemCompletedApi,
  addUserToListApi,
  removeUserFromListApi,
  deleteListApi,
  deleteListItemApi,
} from '@/api/lists'

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const useListsStore = defineStore('lists', () => {
  const lists = ref<LocalList[]>([])
  const listItems = ref<LocalListItem[]>([])
  const isLoaded = ref(false)
  const isSyncing = ref(false)
  const error = ref<string | null>(null)
  const pendingCount = ref(0)

  const sortedLists = computed(() =>
    [...lists.value].sort((a, b) => (b.modified_at ?? '').localeCompare(a.modified_at ?? '')),
  )

  function itemsForList(listId: string) {
    return listItems.value
      .filter((item) => item.list_id === listId)
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  }

  async function refresh() {
    lists.value = await db.lists.toArray()
    listItems.value = await db.listItems.toArray()
    pendingCount.value = await db.syncQueue.count()
    isLoaded.value = true
  }

  async function loadLists() {
    if (!isLoaded.value) {
      await refresh()
    }
    // The server is the source of truth: even though we already have a
    // local snapshot to render instantly (including while offline), always
    // kick off a background sync/pull so views reflect the latest server
    // state on every visit, not just on the first load of the session.
    void sync()
  }

  async function enqueue(entry: Omit<SyncQueueEntry, 'id' | 'createdAt' | 'attempts'>) {
    await db.syncQueue.add({
      ...entry,
      createdAt: Date.now(),
      attempts: 0,
    })
  }

  async function createList(name: string, userIds: string[] = []): Promise<LocalList> {
    const now = new Date().toISOString()
    const localList: LocalList = {
      id: generateId(),
      name,
      created_at: now,
      modified_at: now,
      pendingSync: true,
    }

    await db.lists.add(localList)
    await enqueue({
      type: 'createList',
      payload: { name, user_ids: userIds },
      localListId: localList.id,
    })
    await refresh()
    void sync()

    return localList
  }

  async function createListItem(listId: string, title: string): Promise<LocalListItem> {
    const now = new Date().toISOString()
    const localItem: LocalListItem = {
      id: generateId(),
      list_id: listId,
      title,
      is_completed: false,
      created_at: now,
      modified_at: now,
      pendingSync: true,
    }

    await db.listItems.add(localItem)
    await enqueue({
      type: 'createListItem',
      payload: { list_id: listId, title },
      localListItemId: localItem.id,
    })
    await refresh()
    void sync()

    return localItem
  }

  async function updateListItem(
    itemId: string,
    changes: { title?: string; is_completed?: boolean },
  ) {
    await db.listItems.update(itemId, {
      ...changes,
      modified_at: new Date().toISOString(),
      pendingSync: true,
    })
    await enqueue({
      type: 'updateListItem',
      payload: { list_item_id: itemId, ...changes },
      localListItemId: itemId,
    })
    await refresh()
    void sync()
  }

  async function setListItemCompleted(itemId: string, isCompleted: boolean) {
    await db.listItems.update(itemId, {
      is_completed: isCompleted,
      modified_at: new Date().toISOString(),
      pendingSync: true,
    })
    await enqueue({
      type: 'setListItemCompleted',
      payload: { is_completed: isCompleted },
      localListItemId: itemId,
    })
    await refresh()
    void sync()
  }

  async function addUserToList(listId: string, email: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Cannot share list while offline')
    }
    await addUserToListApi({ list_id: listId, email })
  }

  async function removeUserFromList(listId: string, email: string) {
    await enqueue({
      type: 'removeUserFromList',
      payload: { list_id: listId, email },
      localListId: listId,
    })
    await refresh()
    void sync()
  }

  async function deleteList(listId: string) {
    await db.lists.delete(listId)
    const affectedItems = await db.listItems.where('list_id').equals(listId).toArray()
    for (const item of affectedItems) {
      await db.listItems.delete(item.id)
    }
    await enqueue({
      type: 'deleteList',
      payload: { id: listId },
      localListId: listId,
    })
    await refresh()
    void sync()
  }

  async function deleteListItem(itemId: string) {
    await db.listItems.delete(itemId)
    await enqueue({
      type: 'deleteListItem',
      payload: { id: itemId },
      localListItemId: itemId,
    })
    await refresh()
    void sync()
  }

  // Remaps a client-generated temporary list id to the id assigned by the
  // server once the "createList" sync operation succeeds. This keeps any
  // items or queued operations referencing the temporary id consistent.
  async function remapListId(oldId: string, newId: string) {
    if (oldId === newId) return

    const existing = await db.lists.get(oldId)
    if (existing) {
      await db.lists.delete(oldId)
      await db.lists.put({ ...existing, id: newId, pendingSync: false })
    }

    const affectedItems = await db.listItems.where('list_id').equals(oldId).toArray()
    for (const item of affectedItems) {
      await db.listItems.update(item.id, { list_id: newId })
    }

    const affectedQueueEntries = await db.syncQueue
      .filter((entry) => entry.localListId === oldId)
      .toArray()
    for (const entry of affectedQueueEntries) {
      const payload = entry.payload as { list_id?: string; id?: string }
      await db.syncQueue.update(entry.id!, {
        localListId: newId,
        payload: payload?.list_id
          ? { ...payload, list_id: newId }
          : payload?.id
            ? { ...payload, id: newId }
            : entry.payload,
      })
    }
  }

  // Remaps a client-generated temporary list item id to the id assigned by
  // the server, keeping any queued operations referencing the temporary id
  // consistent. This is what lets the server remain the source of truth for
  // item ids instead of the client-generated placeholder living on forever.
  async function remapListItemId(oldId: string, newId: string) {
    if (oldId === newId) return

    const existing = await db.listItems.get(oldId)
    if (existing) {
      await db.listItems.delete(oldId)
      await db.listItems.put({ ...existing, id: newId, pendingSync: false })
    }

    const affectedQueueEntries = await db.syncQueue
      .filter((queueEntry) => queueEntry.localListItemId === oldId)
      .toArray()
    for (const queueEntry of affectedQueueEntries) {
      const payload = queueEntry.payload as { list_item_id?: string; id?: string }
      await db.syncQueue.update(queueEntry.id!, {
        localListItemId: newId,
        payload: payload?.list_item_id
          ? { ...payload, list_item_id: newId }
          : payload?.id
            ? { ...payload, id: newId }
            : queueEntry.payload,
      })
    }
  }

  async function processSyncEntry(entry: SyncQueueEntry) {
    switch (entry.type) {
      case 'createList': {
        const created = await createListApi(entry.payload as { name: string; user_ids?: string[] })
        if (entry.localListId) {
          await remapListId(entry.localListId, created.id)
        }
        break
      }
      case 'createListItem': {
        // The server is the source of truth for item ids: it returns the
        // created item (with its own real id) in the response body, so we
        // remap our client-generated placeholder id to it instead of keeping
        // the made-up one around.
        const created = await createListItemApi(entry.payload as { list_id: string; title: string })
        if (entry.localListItemId) {
          await remapListItemId(entry.localListItemId, created.id)
        }
        break
      }
      case 'updateListItem': {
        await updateListItemApi(
          entry.payload as { list_item_id: string; title?: string; is_completed?: boolean },
        )
        if (entry.localListItemId) {
          await db.listItems.update(entry.localListItemId, { pendingSync: false })
        }
        break
      }
      case 'setListItemCompleted': {
        if (!entry.localListItemId) break
        await setListItemCompletedApi(
          entry.localListItemId,
          entry.payload as { is_completed: boolean },
        )
        await db.listItems.update(entry.localListItemId, { pendingSync: false })
        break
      }
      case 'removeUserFromList': {
        await removeUserFromListApi(entry.payload as { list_id: string; email: string })
        break
      }
      case 'deleteList': {
        const payload = entry.payload as { id: string }
        await deleteListApi(payload.id)
        break
      }
      case 'deleteListItem': {
        const payload = entry.payload as { id: string }
        await deleteListItemApi(payload.id)
        break
      }
    }
  }

  let ongoingSync: Promise<void> | null = null

  async function runSync() {
    isSyncing.value = true
    error.value = null

    try {
      const queue = await db.syncQueue.orderBy('createdAt').toArray()

      for (const entry of queue) {
        try {
          await processSyncEntry(entry)
          if (entry.id !== undefined) {
            await db.syncQueue.delete(entry.id)
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Sync failed'
          if (entry.id !== undefined) {
            await db.syncQueue.update(entry.id, {
              attempts: entry.attempts + 1,
              lastError: message,
            })
          }
          error.value = message
          // Stop processing further entries to preserve ordering; the next
          // sync attempt (e.g. triggered by the "online" event) will retry.
          break
        }
      }
    } finally {
      isSyncing.value = false
      await refresh()
    }
  }

  // Ensures overlapping calls to sync() (e.g. one triggered automatically by
  // a mutation while another is triggered by the "online" event) share the
  // same in-flight run instead of silently no-oping.
  async function sync(): Promise<void> {
    if (ongoingSync) {
      return ongoingSync
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    ongoingSync = runSync().then(() => pullFromServer())
    try {
      await ongoingSync
    } finally {
      ongoingSync = null
    }
  }

  // Pulls the authoritative lists from the server and merges them into local
  // storage. Entries that still have local unsynced changes (pendingSync)
  // are left untouched so we never clobber pending edits.
  //
  // This no longer eagerly fetches every item of every list: the server now
  // reports total_items/completed_items directly on each list, which is all
  // the overview page needs. Items for a specific list are only pulled on
  // demand via pullListItems (e.g. when opening its detail view).
  async function pullFromServer(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    try {
      const serverLists = await getListsApi()
      const serverListIds = new Set(serverLists.map((serverList) => serverList.id))

      for (const serverList of serverLists) {
        const existingList = await db.lists.get(serverList.id)
        if (!existingList || !existingList.pendingSync) {
          await db.lists.put({ ...serverList, pendingSync: false })
        }
      }

      // Lists that were already synced but are no longer reported by the
      // server have been deleted there (e.g. from another device), so
      // remove them locally too, along with their items. Lists that still
      // have pending local changes (not yet synced, e.g. a not-yet-pushed
      // "createList") are left alone since the server doesn't know about
      // them yet.
      const localLists = await db.lists.toArray()
      for (const localList of localLists) {
        if (!localList.pendingSync && !serverListIds.has(localList.id)) {
          await db.lists.delete(localList.id)
          const orphanedItems = await db.listItems.where('list_id').equals(localList.id).toArray()
          for (const item of orphanedItems) {
            await db.listItems.delete(item.id)
          }
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load lists from server'
    } finally {
      await refresh()
    }
  }

  // Pulls the authoritative items of a single list from the server and
  // merges them into local storage. Used by the list detail view, which is
  // the only place that needs the full item set for a list.
  async function pullListItems(listId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    try {
      const serverItems = await getListItemsApi(listId)
      const serverItemIds = new Set(serverItems.map((serverItem) => serverItem.id))

      for (const serverItem of serverItems) {
        const existingItem = await db.listItems.get(serverItem.id)
        if (!existingItem || !existingItem.pendingSync) {
          await db.listItems.put({ ...serverItem, pendingSync: false })
        }
      }

      // Items that were already synced but are no longer reported by the
      // server for this list have been deleted there, so remove them
      // locally too. Items with pending local changes are left alone since
      // the server doesn't know about them yet.
      const localItems = await db.listItems.where('list_id').equals(listId).toArray()
      for (const localItem of localItems) {
        if (!localItem.pendingSync && !serverItemIds.has(localItem.id)) {
          await db.listItems.delete(localItem.id)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load list items from server'
    } finally {
      await refresh()
    }
  }

  async function loadListItems(listId: string) {
    if (!isLoaded.value) {
      await refresh()
    }
    void pullListItems(listId)
  }

  return {
    lists,
    listItems,
    sortedLists,
    isLoaded,
    isSyncing,
    pendingCount,
    error,
    itemsForList,
    loadLists,
    loadListItems,
    refresh,
    createList,
    createListItem,
    updateListItem,
    setListItemCompleted,
    addUserToList,
    removeUserFromList,
    deleteList,
    deleteListItem,
    sync,
    pullFromServer,
    pullListItems,
  }
})
