import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useRecipesStore } from '@/stores/recipes'
import { useGroupsStore } from '@/stores/groups'
import {
  db,
  type LocalList,
  type LocalListItem,
  type SyncQueueEntry,
  type SyncOperationType,
  type NewSyncQueueEntry,
} from '@/database/db'
import {
  getListsApi,
  createListApi,
  getListItemsApi,
  createListItemApi,
  updateListItemTitleApi,
  renameListApi,
  setListItemCompletedApi,
  setListGroupApi,
  deleteListApi,
  deleteListItemApi,
  orderListsApi,
} from '@/api/lists'
import { isServerRejection } from '@/api/http'
import { rebaseOrder } from '@/utils/orderRebase'
import { createPullTracker } from '@/utils/pullFreshness'

// A burst of rapid edits (ticking off several items, typing then blurring a
// few titles) would otherwise trigger one sync pass per edit. Debouncing
// collapses a burst into a single pass a short moment after the last edit.
const SYNC_DEBOUNCE_MS = 400

// This store owns exactly these queue operations; the recipes store owns the
// rest (stores/recipes.ts RECIPE_OP_TYPES). Both share one sync queue table,
// so each must only ever read - and delete - its own entries.
const LIST_OP_TYPES: SyncOperationType[] = [
  'createList',
  'renameList',
  'createListItem',
  'updateListItemTitle',
  'setListItemCompleted',
  'deleteList',
  'deleteListItem',
  'orderLists',
]

// A queued reorder that keeps failing for reasons other than a server
// rejection (server down, 5xx) is retried on the next few sync passes, then
// dropped in favour of the server's order rather than retried forever.
const MAX_ORDER_ATTEMPTS = 3

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

  // When GET /lists (key "") and each GET /lists/{id} (key: the list id) last
  // succeeded, so screen visits and edits within PULL_FRESH_MS don't
  // re-download them.
  const pulls = createPullTracker(() => useAuthStore().currentUser?.user_id)

  // Lists carry a server-assigned `position`, rearranged via reorderLists().
  // New lists (local-only or freshly synced) always come back as position 0
  // - by design, so a new list always lands at the top - which means several
  // lists can share a position. created_at desc breaks that tie, newest
  // first, and also covers a local list created but not yet synced (no
  // position of its own yet: defaults to 0 below).
  const sortedLists = computed(() =>
    [...lists.value].sort((a, b) => {
      const positionDiff = (a.position ?? 0) - (b.position ?? 0)
      if (positionDiff !== 0) return positionDiff
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    }),
  )

  function itemsForList(listId: string) {
    return listItems.value
      .filter((item) => item.list_id === listId)
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  }

  // --- targeted local-state helpers -----------------------------------
  // Mutations patch `lists`/`listItems` in place instead of reloading the
  // whole table from Dexie after every write. This keeps unrelated rows'
  // object identity stable (so unrelated components don't re-render) and
  // avoids two full-table scans per keystroke-triggered save.

  function upsertList(record: LocalList) {
    const existing = lists.value.find((entry) => entry.id === record.id)
    if (existing) {
      Object.assign(existing, record)
    } else {
      lists.value.push(record)
    }
  }

  function removeLocalList(id: string) {
    const idx = lists.value.findIndex((entry) => entry.id === id)
    if (idx !== -1) lists.value.splice(idx, 1)
  }

  function upsertListItem(record: LocalListItem) {
    const existing = listItems.value.find((entry) => entry.id === record.id)
    if (existing) {
      Object.assign(existing, record)
    } else {
      listItems.value.push(record)
    }
  }

  function removeLocalListItem(id: string) {
    const idx = listItems.value.findIndex((entry) => entry.id === id)
    if (idx !== -1) listItems.value.splice(idx, 1)
  }

  // Keeps the server-provided total_items/completed_items (what the overview
  // cards show) in step with local item edits, so an edit doesn't need a
  // GET /lists round trip to update them - same idea as adjustTotalItems in
  // stores/recipes.ts. Reads the row from Dexie rather than `lists`, since
  // recipe screens edit items without this store's lists necessarily loaded.
  // Counts the server never reported are left alone; ListCard falls back to
  // counting local items for those.
  async function adjustListCounts(listId: string, delta: { total?: number; completed?: number }) {
    const list = await db.lists.get(listId)
    if (!list) return
    const patch: Pick<LocalList, 'total_items' | 'completed_items'> = {}
    if (delta.total && list.total_items !== undefined) {
      patch.total_items = Math.max(0, list.total_items + delta.total)
    }
    if (delta.completed && list.completed_items !== undefined) {
      patch.completed_items = Math.max(0, list.completed_items + delta.completed)
    }
    if (Object.keys(patch).length === 0) return
    await db.lists.update(listId, patch)
    const existing = lists.value.find((entry) => entry.id === listId)
    if (existing) Object.assign(existing, patch)
  }

  async function refresh() {
    lists.value = await db.lists.toArray()
    listItems.value = await db.listItems.toArray()
    pendingCount.value = await db.syncQueue.where('type').anyOf(LIST_OP_TYPES).count()
    isLoaded.value = true
  }

  // Dedupes concurrent first-load refreshes: loadLists() and loadListItems()
  // are both called from ListDetailView's onMounted and would otherwise each
  // see isLoaded === false and kick off their own full-table Dexie scan.
  let loadPromise: Promise<void> | null = null

  async function ensureLoaded() {
    if (isLoaded.value) return
    if (!loadPromise) {
      loadPromise = refresh().finally(() => {
        loadPromise = null
      })
    }
    await loadPromise
  }

  async function loadLists() {
    await ensureLoaded()
    void sync()
  }

  async function enqueue(entry: NewSyncQueueEntry) {
    await db.syncQueue.add({
      ...entry,
      createdAt: Date.now(),
      attempts: 0,
    })
    pendingCount.value++
  }

  let syncDebounceHandle: ReturnType<typeof setTimeout> | null = null

  function scheduleSync() {
    if (syncDebounceHandle !== null) {
      clearTimeout(syncDebounceHandle)
    }
    syncDebounceHandle = setTimeout(() => {
      syncDebounceHandle = null
      void sync()
    }, SYNC_DEBOUNCE_MS)
  }

  // Without a groupId the server puts the list into the user's default
  // group; the local row assumes the same so group filters show it right away.
  async function createList(name: string, groupId?: string): Promise<LocalList> {
    const now = new Date().toISOString()
    const id = generateId()
    const localList: LocalList = {
      id,
      clientId: id,
      group_id: groupId ?? useGroupsStore().defaultGroup?.id,
      name,
      created_at: now,
      modified_at: now,
      pendingSync: true,
    }

    await db.lists.add(localList)
    upsertList(localList)
    await enqueue({
      type: 'createList',
      payload: groupId ? { name, group_id: groupId } : { name },
      localListId: localList.id,
    })
    scheduleSync()

    return localList
  }

  async function renameList(listId: string, name: string) {
    const patch = {
      name,
      modified_at: new Date().toISOString(),
      pendingSync: true,
    }
    await db.lists.update(listId, patch)
    const existingList = lists.value.find((entry) => entry.id === listId)
    if (existingList) Object.assign(existingList, patch)
    await enqueue({
      type: 'renameList',
      payload: { name },
      localListId: listId,
    })
    scheduleSync()
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
    upsertListItem(localItem)
    await adjustListCounts(listId, { total: 1 })
    await enqueue({
      type: 'createListItem',
      payload: { list_id: listId, title },
      // Lets remapListId rewrite payload.list_id when the list itself was
      // created offline and hasn't got its server id yet.
      localListId: listId,
      localListItemId: localItem.id,
    })
    scheduleSync()

    return localItem
  }

  async function updateListItemTitle(itemId: string, title: string) {
    const patch = {
      title,
      modified_at: new Date().toISOString(),
      pendingSync: true,
    }
    await db.listItems.update(itemId, patch)
    const existingItem = listItems.value.find((entry) => entry.id === itemId)
    if (existingItem) Object.assign(existingItem, patch)
    await enqueue({
      type: 'updateListItemTitle',
      payload: { title },
      localListItemId: itemId,
    })
    scheduleSync()
  }

  async function setListItemCompleted(itemId: string, isCompleted: boolean) {
    const patch = {
      is_completed: isCompleted,
      modified_at: new Date().toISOString(),
      pendingSync: true,
    }
    const before = await db.listItems.get(itemId)
    await db.listItems.update(itemId, patch)
    if (before && before.is_completed !== isCompleted) {
      await adjustListCounts(before.list_id, { completed: isCompleted ? 1 : -1 })
    }
    const existingItem = listItems.value.find((entry) => entry.id === itemId)
    if (existingItem) Object.assign(existingItem, patch)
    await enqueue({
      type: 'setListItemCompleted',
      payload: { is_completed: isCompleted },
      localListItemId: itemId,
    })
    scheduleSync()
  }

  // Moving is online-only, like group management: the server drops recipe
  // links that would now cross groups, and it's simpler to mirror that once
  // it happened than to replay it offline. Queued edits are flushed first so
  // a list created offline has its server id by the time it's moved.
  async function moveListToGroup(listId: string, groupId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Cannot move a list while offline')
    }

    const clientId = lists.value.find((entry) => entry.id === listId)?.clientId ?? listId
    await sync()
    const list = lists.value.find((entry) => entry.id === clientId || entry.clientId === clientId)
    if (!list) throw new Error('List not found')
    const pendingCreates = await db.syncQueue.where('type').equals('createList').toArray()
    if (pendingCreates.some((entry) => entry.localListId === list.id)) {
      throw new Error("This list hasn't synced yet. Try again once it has.")
    }

    await setListGroupApi(list.id, { group_id: groupId })
    await db.lists.update(list.id, { group_id: groupId })
    list.group_id = groupId

    const recipesStore = useRecipesStore()
    await recipesStore.removeLinksAcrossGroups()
    void recipesStore.sync({ force: true })
  }

  async function deleteList(listId: string) {
    const removedItemIds = listItems.value
      .filter((item) => item.list_id === listId)
      .map((item) => item.id)

    await db.lists.delete(listId)
    await db.listItems.where('list_id').equals(listId).delete()
    removeLocalList(listId)
    listItems.value = listItems.value.filter((item) => item.list_id !== listId)
    await enqueue({
      type: 'deleteList',
      payload: { id: listId },
      localListId: listId,
    })
    scheduleSync()

    const recipesStore = useRecipesStore()
    for (const itemId of removedItemIds) {
      await recipesStore.removeItemFromAllRecipes(itemId)
    }
  }

  // Applies a full reordering of the user's lists (e.g. from a drag-and-drop
  // gesture). Positions are reassigned optimistically to every list in
  // `orderedIds`, and marked pendingSync so a pull racing the queued
  // "orderLists" entry can't clobber the optimistic order before it syncs.
  async function reorderLists(orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) => db.lists.update(id, { position: index, pendingSync: true })),
    )
    for (const [index, id] of orderedIds.entries()) {
      const existing = lists.value.find((entry) => entry.id === id)
      if (existing) {
        existing.position = index
        existing.pendingSync = true
      }
    }

    // Only the latest requested order matters, so any not-yet-synced
    // "orderLists" entry is superseded rather than left to also replay.
    const staleEntries = await db.syncQueue.where('type').equals('orderLists').toArray()
    if (staleEntries.length > 0) {
      await db.syncQueue.bulkDelete(staleEntries.map((entry) => entry.id!))
      pendingCount.value = Math.max(0, pendingCount.value - staleEntries.length)
    }

    await enqueue({
      type: 'orderLists',
      payload: { list_ids: orderedIds },
    })
    scheduleSync()
  }

  async function deleteListItem(itemId: string) {
    const before = await db.listItems.get(itemId)
    await db.listItems.delete(itemId)
    removeLocalListItem(itemId)
    if (before) {
      await adjustListCounts(before.list_id, {
        total: -1,
        completed: before.is_completed ? -1 : 0,
      })
    }
    await enqueue({
      type: 'deleteListItem',
      payload: { id: itemId },
      // The item row is gone locally, so this is how pullFromServer still
      // knows the list has an edit the server hasn't seen yet.
      localListId: before?.list_id,
      localListItemId: itemId,
    })
    scheduleSync()

    await useRecipesStore().removeItemFromAllRecipes(itemId)
  }

  // Remaps a client-generated temporary list id to the id assigned by the
  // server once the "createList" sync operation succeeds. This keeps any
  // items or queued operations referencing the temporary id consistent.
  async function remapListId(oldId: string, newId: string) {
    if (oldId === newId) return

    const existing = await db.lists.get(oldId)
    if (existing) {
      await db.lists.delete(oldId)
      const updated = { ...existing, id: newId, pendingSync: false }
      await db.lists.put(updated)
      removeLocalList(oldId)
      upsertList(updated)
    }

    await db.listItems.where('list_id').equals(oldId).modify({ list_id: newId })
    for (const item of listItems.value) {
      if (item.list_id === oldId) item.list_id = newId
    }

    const affectedQueueEntries = await db.syncQueue
      .filter((entry) => entry.localListId === oldId)
      .toArray()
    for (const entry of affectedQueueEntries) {
      const payload = entry.payload
      // Item operations also carry localListId, and deleteListItem's
      // payload.id is the item's id, so only a deleteList's `id` is rewritten.
      const updatedPayload =
        'list_id' in payload
          ? { ...payload, list_id: newId }
          : entry.type === 'deleteList'
            ? { ...payload, id: newId }
            : payload
      await db.syncQueue.update(entry.id!, {
        localListId: newId,
        payload: updatedPayload,
      })
    }

    // "orderLists" entries aren't tied to a single localListId (they carry
    // every list's id in payload.list_ids), so they need their own remap pass.
    const affectedOrderEntries = await db.syncQueue.where('type').equals('orderLists').toArray()
    for (const orderEntry of affectedOrderEntries) {
      if (orderEntry.type !== 'orderLists' || !orderEntry.payload.list_ids.includes(oldId)) continue
      await db.syncQueue.update(orderEntry.id!, {
        payload: {
          list_ids: orderEntry.payload.list_ids.map((id) => (id === oldId ? newId : id)),
        },
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
      const updated = { ...existing, id: newId, pendingSync: false }
      await db.listItems.put(updated)
      removeLocalListItem(oldId)
      upsertListItem(updated)
    }

    const affectedQueueEntries = await db.syncQueue
      .filter((queueEntry) => queueEntry.localListItemId === oldId)
      .toArray()
    for (const queueEntry of affectedQueueEntries) {
      const payload = queueEntry.payload
      const updatedPayload =
        'list_item_id' in payload
          ? { ...payload, list_item_id: newId }
          : 'id' in payload
            ? { ...payload, id: newId }
            : payload
      await db.syncQueue.update(queueEntry.id!, {
        localListItemId: newId,
        payload: updatedPayload,
      })
    }

    await useRecipesStore().remapListItemReferences(oldId, newId)
  }

  async function markListSynced(listId: string) {
    await db.lists.update(listId, { pendingSync: false })
    const existingList = lists.value.find((entry) => entry.id === listId)
    if (existingList) existingList.pendingSync = false
  }

  async function markListItemSynced(itemId: string) {
    await db.listItems.update(itemId, { pendingSync: false })
    const existingItem = listItems.value.find((entry) => entry.id === itemId)
    if (existingItem) existingItem.pendingSync = false
  }

  async function processSyncEntry(entry: SyncQueueEntry) {
    switch (entry.type) {
      case 'createList': {
        const created = await createListApi(entry.payload)
        if (entry.localListId) {
          await remapListId(entry.localListId, created.id)
        }
        break
      }
      case 'renameList': {
        if (!entry.localListId) break
        await renameListApi(entry.localListId, entry.payload)
        await markListSynced(entry.localListId)
        break
      }
      case 'createListItem': {
        // The server is the source of truth for item ids: it returns the
        // created item (with its own real id) in the response body, so we
        // remap our client-generated placeholder id to it instead of keeping
        // the made-up one around.
        const created = await createListItemApi(entry.payload)
        if (entry.localListItemId) {
          await remapListItemId(entry.localListItemId, created.id)
        }
        break
      }
      case 'updateListItemTitle': {
        if (!entry.localListItemId) break
        await updateListItemTitleApi(entry.localListItemId, entry.payload)
        await markListItemSynced(entry.localListItemId)
        break
      }
      case 'setListItemCompleted': {
        if (!entry.localListItemId) break
        await setListItemCompletedApi(entry.localListItemId, entry.payload)
        await markListItemSynced(entry.localListItemId)
        break
      }
      case 'deleteList': {
        await deleteListApi(entry.payload.id)
        break
      }
      case 'deleteListItem': {
        await deleteListItemApi(entry.payload.id)
        break
      }
      case 'orderLists': {
        await pushListOrder(entry.payload.list_ids)
        await settleListOrder(entry.payload.list_ids)
        break
      }
    }
  }

  // Sends a reorder. The server rejects an id list that doesn't match its
  // current set of lists exactly, which is what a reorder queued offline
  // turns into once another device adds or deletes a list. A rejection is
  // therefore not final: rebase the user's order onto the lists the server
  // actually has and send that once. Anything that still fails propagates.
  async function pushListOrder(ids: string[]) {
    try {
      await orderListsApi({ list_ids: ids })
      return
    } catch (err) {
      if (!isServerRejection(err)) throw err
    }

    await orderListsApi({ list_ids: rebaseOrder(ids, await getListsApi()) })
  }

  // Clears the optimistic "pendingSync" flag reorderLists() put on every
  // list in the order, so the pull that follows a sync pass is allowed to
  // overwrite their positions again - with the values just accepted by the
  // server, or (when a reorder is abandoned) the server's own order.
  async function settleListOrder(ids: string[]) {
    await Promise.all(ids.map((id) => db.lists.update(id, { pendingSync: false })))
    const affectedIds = new Set(ids)
    for (const list of lists.value) {
      if (affectedIds.has(list.id)) list.pendingSync = false
    }
  }

  // A reorder is a display preference, not data other queued operations
  // depend on, so its failure must never stall the queue. A server rejection
  // (even after the rebase above) can't succeed on retry and is dropped
  // immediately; other failures get a few attempts. Dropping settles the
  // optimistic order so the pull that follows picks up the server's.
  async function handleFailedOrder(entry: SyncQueueEntry, err: unknown) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    const giveUp = isServerRejection(err) || entry.attempts + 1 >= MAX_ORDER_ATTEMPTS

    if (!giveUp) {
      if (entry.id !== undefined) {
        await db.syncQueue.update(entry.id, { attempts: entry.attempts + 1, lastError: message })
      }
      error.value = message
      return
    }

    if (entry.id !== undefined) {
      await db.syncQueue.delete(entry.id)
      pendingCount.value = Math.max(0, pendingCount.value - 1)
    }
    if (entry.type === 'orderLists') await settleListOrder(entry.payload.list_ids)
    // The pull that follows this pass must actually happen for that.
    pulls.invalidate()
    error.value = `Couldn't save the new list order (${message}). Showing the server's order instead.`
  }

  async function runSync() {
    isSyncing.value = true
    error.value = null

    try {
      const queue = (await db.syncQueue.where('type').anyOf(LIST_OP_TYPES).toArray()).sort(
        (a, b) => a.createdAt - b.createdAt,
      )

      for (const snapshotEntry of queue) {
        // Re-read the entry rather than trusting the queue snapshot: an
        // earlier iteration this same pass may have remapped a temporary id
        // referenced in this entry's payload (e.g. remapListId rewriting a
        // queued "orderLists" entry after its "createList" entry synced).
        const entry =
          snapshotEntry.id !== undefined
            ? ((await db.syncQueue.get(snapshotEntry.id)) ?? snapshotEntry)
            : snapshotEntry
        try {
          await processSyncEntry(entry)
          if (entry.id !== undefined) {
            await db.syncQueue.delete(entry.id)
            pendingCount.value = Math.max(0, pendingCount.value - 1)
          }
        } catch (err) {
          if (entry.type === 'orderLists') {
            await handleFailedOrder(entry, err)
            continue
          }

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
    }
  }

  // Serializes sync() and pullListItems() against each other so a queued
  // mutation is never pushed to the server (runSync) at the same moment a
  // pull is merging fresh server state into the same rows - both touch
  // Dexie and the reactive local state without any other coordination.
  let operationChain: Promise<void> = Promise.resolve()

  function enqueueOperation<T>(fn: () => Promise<T>): Promise<T> {
    const result = operationChain.then(fn, fn)
    operationChain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  let ongoingSync: Promise<void> | null = null

  // Ensures overlapping calls to sync() (e.g. one triggered automatically by
  // a mutation while another is triggered by the "online" event) share the
  // same in-flight run instead of silently no-oping.
  //
  // The queue is always drained, but GET /lists is skipped while the last
  // pull is still fresh (see utils/pullFreshness.ts): local edits are
  // already applied, counts included. `force` is for callers that just
  // changed server state the local copy can't know about (joining a group).
  async function sync(options: { force?: boolean } = {}): Promise<void> {
    if (ongoingSync) {
      if (!options.force) return ongoingSync
      // The in-flight pass may already be past its pull, and so miss the
      // change a forced sync is meant to pick up: run another one after it.
      await ongoingSync.catch(() => undefined)
      return sync(options)
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!useAuthStore().isAuthenticated) return

    if (options.force) pulls.invalidate()
    ongoingSync = enqueueOperation(async () => {
      await runSync()
      if (!pulls.isFresh()) await pullFromServer()
    })
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
      const [serverLists, localLists] = await Promise.all([getListsApi(), db.lists.toArray()])
      const localById = new Map(localLists.map((list) => [list.id, list]))
      const serverListIds = new Set(serverLists.map((serverList) => serverList.id))
      // A list with item edits the server hasn't seen yet keeps its locally
      // adjusted counts; the server's numbers don't include those edits.
      const listsWithPendingItemEdits = await listIdsWithPendingItemEdits()

      const toPut: LocalList[] = []
      for (const serverList of serverLists) {
        const existingList = localById.get(serverList.id)
        if (!existingList || !existingList.pendingSync) {
          const keepLocalCounts =
            existingList?.total_items !== undefined && listsWithPendingItemEdits.has(serverList.id)
          // Counts that moved without a local edit mean someone else changed
          // the list's items, so the copy of them cached here is out of date.
          if (
            existingList &&
            !keepLocalCounts &&
            (existingList.total_items !== serverList.total_items ||
              existingList.completed_items !== serverList.completed_items)
          ) {
            pulls.invalidate(serverList.id)
          }
          toPut.push({
            ...serverList,
            ...(keepLocalCounts
              ? {
                  total_items: existingList.total_items,
                  completed_items: existingList.completed_items,
                }
              : {}),
            pendingSync: false,
            clientId: existingList?.clientId ?? serverList.id,
          })
        }
      }
      if (toPut.length > 0) {
        await db.lists.bulkPut(toPut)
      }

      // Lists that were already synced but are no longer reported by the
      // server have been deleted there (e.g. from another device), so
      // remove them locally too, along with their items. Lists that still
      // have pending local changes (not yet synced, e.g. a not-yet-pushed
      // "createList") are left alone since the server doesn't know about
      // them yet.
      const idsToDelete = localLists
        .filter((list) => !list.pendingSync && !serverListIds.has(list.id))
        .map((list) => list.id)

      if (idsToDelete.length > 0) {
        await db.lists.bulkDelete(idsToDelete)
        for (const id of idsToDelete) {
          await db.listItems.where('list_id').equals(id).delete()
        }
      }

      for (const record of toPut) upsertList(record)
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) removeLocalList(id)
        const deletedIds = new Set(idsToDelete)
        listItems.value = listItems.value.filter((item) => !deletedIds.has(item.list_id))
      }
      pulls.markPulled()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load lists from server'
    }
  }

  async function listIdsWithPendingItemEdits(): Promise<Set<string>> {
    const [pendingItems, queuedDeletes] = await Promise.all([
      db.listItems.filter((item) => !!item.pendingSync).toArray(),
      db.syncQueue.where('type').equals('deleteListItem').toArray(),
    ])
    const ids = new Set(pendingItems.map((item) => item.list_id))
    for (const entry of queuedDeletes) {
      if (entry.localListId) ids.add(entry.localListId)
    }
    return ids
  }

  // Pulls the authoritative items of a single list from the server and
  // merges them into local storage. Used by the list detail view, which is
  // the only place that needs the full item set for a list.
  async function pullListItemsInternal(listId: string): Promise<void> {
    try {
      const [serverItems, localItemsForList] = await Promise.all([
        getListItemsApi(listId),
        db.listItems.where('list_id').equals(listId).toArray(),
      ])
      const localById = new Map(localItemsForList.map((item) => [item.id, item]))
      const serverItemIds = new Set(serverItems.map((item) => item.id))

      const toPut: LocalListItem[] = []
      for (const serverItem of serverItems) {
        const existingItem = localById.get(serverItem.id)
        if (!existingItem || !existingItem.pendingSync) {
          toPut.push({ ...serverItem, pendingSync: false })
        }
      }
      if (toPut.length > 0) {
        await db.listItems.bulkPut(toPut)
      }

      // Items that were already synced but are no longer reported by the
      // server for this list have been deleted there, so remove them
      // locally too. Items with pending local changes are left alone since
      // the server doesn't know about them yet.
      const idsToDelete = localItemsForList
        .filter((item) => !item.pendingSync && !serverItemIds.has(item.id))
        .map((item) => item.id)
      if (idsToDelete.length > 0) {
        await db.listItems.bulkDelete(idsToDelete)
      }

      for (const record of toPut) upsertListItem(record)
      for (const id of idsToDelete) removeLocalListItem(id)

      const recipesStore = useRecipesStore()
      for (const id of idsToDelete) {
        await recipesStore.removeItemFromAllRecipes(id)
      }

      // The list's full item set is local now, which makes it the better
      // source for the counts (it also includes edits not yet synced).
      const items = await db.listItems.where('list_id').equals(listId).toArray()
      const counts = {
        total_items: items.length,
        completed_items: items.filter((item) => item.is_completed).length,
      }
      await db.lists.update(listId, counts)
      const list = lists.value.find((entry) => entry.id === listId)
      if (list) Object.assign(list, counts)

      pulls.markPulled(listId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load list items from server'
    }
  }

  async function pullListItems(listId: string, options: { force?: boolean } = {}): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    // Checked once it's this pull's turn, so two quick visits to the same
    // list don't both queue a fetch.
    return enqueueOperation(() =>
      options.force || !pulls.isFresh(listId) ? pullListItemsInternal(listId) : Promise.resolve(),
    )
  }

  async function loadListItems(listId: string) {
    await ensureLoaded()
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
    ensureLoaded,
    loadLists,
    loadListItems,
    refresh,
    createList,
    createListItem,
    renameList,
    updateListItemTitle,
    setListItemCompleted,
    moveListToGroup,
    deleteList,
    deleteListItem,
    reorderLists,
    sync,
    pullFromServer,
    pullListItems,
    upsertListItem,
    adjustListCounts,
  }
})
