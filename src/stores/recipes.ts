import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import {
  db,
  type LocalRecipe,
  type RecipeItemLink,
  type SyncQueueEntry,
  type SyncOperationType,
  type NewSyncQueueEntry,
} from '@/database/db'
import type { LocalListItem } from '@/database/db'
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
  orderRecipesApi,
} from '@/api/recipes'
import { isServerRejection } from '@/api/http'
import { rebaseOrder } from '@/utils/orderRebase'

// Mirrors the debounce in stores/lists.ts: collapses a burst of edits
// (checking several items into a recipe in a row) into a single sync pass.
const SYNC_DEBOUNCE_MS = 400

const RECIPE_OP_TYPES: SyncOperationType[] = [
  'createRecipe',
  'addRecipeItem',
  'removeRecipeItem',
  'deleteRecipe',
  'uncheckRecipe',
  'orderRecipes',
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

export const useRecipesStore = defineStore('recipes', () => {
  const recipes = ref<LocalRecipe[]>([])
  const recipeItemLinks = ref<RecipeItemLink[]>([])
  const isLoaded = ref(false)
  const isSyncing = ref(false)
  const error = ref<string | null>(null)
  const pendingCount = ref(0)

  // Recipes carry a server-assigned `position`, rearranged via
  // reorderRecipes(). New recipes (local-only or freshly synced) always come
  // back as position 0 - by design, so a new recipe always lands at the top -
  // which means several recipes can share a position. created_at desc breaks
  // that tie, newest first, and also covers a local recipe created but not
  // yet synced (no position of its own yet: defaults to 0 below).
  const sortedRecipes = computed(() =>
    [...recipes.value].sort((a, b) => {
      const positionDiff = (a.position ?? 0) - (b.position ?? 0)
      if (positionDiff !== 0) return positionDiff
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    }),
  )

  function itemsForRecipe(recipeId: string): LocalListItem[] {
    const listsStore = useListsStore()
    const linkedIds = new Set(
      recipeItemLinks.value
        .filter((link) => link.recipeId === recipeId)
        .map((link) => link.listItemId),
    )
    return listsStore.listItems.filter((item) => linkedIds.has(item.id))
  }

  function isItemInRecipe(recipeId: string, listItemId: string): boolean {
    return recipeItemLinks.value.some(
      (link) => link.recipeId === recipeId && link.listItemId === listItemId,
    )
  }

  // --- targeted local-state helpers (see stores/lists.ts for rationale) ---

  function upsertRecipe(record: LocalRecipe) {
    const existing = recipes.value.find((entry) => entry.id === record.id)
    if (existing) {
      Object.assign(existing, record)
    } else {
      recipes.value.push(record)
    }
  }

  function removeLocalRecipe(id: string) {
    const idx = recipes.value.findIndex((entry) => entry.id === id)
    if (idx !== -1) recipes.value.splice(idx, 1)
  }

  function upsertLink(link: RecipeItemLink) {
    const existing = recipeItemLinks.value.find(
      (entry) => entry.recipeId === link.recipeId && entry.listItemId === link.listItemId,
    )
    if (existing) {
      Object.assign(existing, link)
    } else {
      recipeItemLinks.value.push(link)
    }
  }

  function removeLocalLink(recipeId: string, listItemId: string) {
    const idx = recipeItemLinks.value.findIndex(
      (entry) => entry.recipeId === recipeId && entry.listItemId === listItemId,
    )
    if (idx !== -1) recipeItemLinks.value.splice(idx, 1)
  }

  async function refresh() {
    recipes.value = await db.recipes.toArray()
    recipeItemLinks.value = await db.recipeItems.toArray()
    pendingCount.value = await db.syncQueue.where('type').anyOf(RECIPE_OP_TYPES).count()
    isLoaded.value = true
  }

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

  async function loadRecipes() {
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

  async function createRecipe(name: string): Promise<LocalRecipe> {
    const now = new Date().toISOString()
    const id = generateId()
    const localRecipe: LocalRecipe = {
      id,
      clientId: id,
      name,
      created_at: now,
      modified_at: now,
      pendingSync: true,
    }

    await db.recipes.add(localRecipe)
    upsertRecipe(localRecipe)
    await enqueue({
      type: 'createRecipe',
      payload: { name },
      localRecipeId: localRecipe.id,
    })
    scheduleSync()

    return localRecipe
  }

  async function deleteRecipe(recipeId: string) {
    await db.recipes.delete(recipeId)
    removeLocalRecipe(recipeId)

    const links = await db.recipeItems.where('recipeId').equals(recipeId).toArray()
    await db.recipeItems.where('recipeId').equals(recipeId).delete()
    for (const link of links) removeLocalLink(link.recipeId, link.listItemId)

    await enqueue({
      type: 'deleteRecipe',
      payload: { id: recipeId },
      localRecipeId: recipeId,
    })
    scheduleSync()
  }

  // Applies a full reordering of the user's recipes (e.g. from a
  // drag-and-drop gesture). Same approach as reorderLists in stores/lists.ts:
  // positions are reassigned optimistically to every recipe in `orderedIds`
  // and marked pendingSync, so a pull racing the queued "orderRecipes" entry
  // can't clobber the optimistic order before it syncs.
  async function reorderRecipes(orderedIds: string[]) {
    await Promise.all(
      orderedIds.map((id, index) => db.recipes.update(id, { position: index, pendingSync: true })),
    )
    for (const [index, id] of orderedIds.entries()) {
      const existing = recipes.value.find((entry) => entry.id === id)
      if (existing) {
        existing.position = index
        existing.pendingSync = true
      }
    }

    // Only the latest requested order matters, so any not-yet-synced
    // "orderRecipes" entry is superseded rather than left to also replay.
    const staleEntries = await db.syncQueue.where('type').equals('orderRecipes').toArray()
    if (staleEntries.length > 0) {
      await db.syncQueue.bulkDelete(staleEntries.map((entry) => entry.id!))
      pendingCount.value = Math.max(0, pendingCount.value - staleEntries.length)
    }

    await enqueue({
      type: 'orderRecipes',
      payload: { recipe_ids: orderedIds },
    })
    scheduleSync()
  }

  async function addItemToRecipe(recipeId: string, listItemId: string) {
    if (isItemInRecipe(recipeId, listItemId)) return

    const link: RecipeItemLink = { recipeId, listItemId, pendingSync: true }
    await db.recipeItems.put(link)
    upsertLink(link)
    await enqueue({
      type: 'addRecipeItem',
      payload: { recipe_id: recipeId, list_item_id: listItemId },
      localRecipeId: recipeId,
      localListItemId: listItemId,
    })
    scheduleSync()
  }

  async function removeItemFromRecipe(recipeId: string, listItemId: string) {
    await db.recipeItems.delete([recipeId, listItemId])
    removeLocalLink(recipeId, listItemId)

    // If the "add" for this exact pair hasn't synced yet, cancel it outright
    // instead of round-tripping an add-then-remove through the server (same
    // idea as reorderLists superseding a stale queued entry).
    const pendingAdds = await db.syncQueue.where('type').equals('addRecipeItem').toArray()
    const staleAdd = pendingAdds.find(
      (entry) =>
        entry.type === 'addRecipeItem' &&
        entry.localRecipeId === recipeId &&
        entry.localListItemId === listItemId,
    )
    if (staleAdd?.id !== undefined) {
      await db.syncQueue.delete(staleAdd.id)
      pendingCount.value = Math.max(0, pendingCount.value - 1)
      return
    }

    await enqueue({
      type: 'removeRecipeItem',
      payload: { recipe_id: recipeId, list_item_id: listItemId },
      localRecipeId: recipeId,
      localListItemId: listItemId,
    })
    scheduleSync()
  }

  // Local-only cleanup: drops any recipe membership referencing a list item
  // that's gone (deleted outright, or deleted on another device and pulled
  // away). The server already cascades this on its side, so there's nothing
  // to enqueue here.
  async function removeItemFromAllRecipes(listItemId: string) {
    const links = await db.recipeItems.where('listItemId').equals(listItemId).toArray()
    if (links.length === 0) return
    await db.recipeItems.where('listItemId').equals(listItemId).delete()
    for (const link of links) removeLocalLink(link.recipeId, link.listItemId)
  }

  // Unchecks every item currently linked to the recipe, optimistically and
  // in one shot, mirroring "one click uncheck all" - each affected item is
  // flipped locally and marked pendingSync so its row shows the same
  // "syncing…" indicator a normal edit would, then a single queued
  // "uncheckRecipe" op reconciles with the server.
  async function uncheckRecipe(recipeId: string) {
    const listsStore = useListsStore()
    const now = new Date().toISOString()
    const affected = itemsForRecipe(recipeId).filter((item) => item.is_completed)

    for (const item of affected) {
      const patch = { is_completed: false, modified_at: now, pendingSync: true }
      await db.listItems.update(item.id, patch)
      const existing = listsStore.listItems.find((entry) => entry.id === item.id)
      if (existing) Object.assign(existing, patch)
    }

    await enqueue({
      type: 'uncheckRecipe',
      payload: { id: recipeId },
      localRecipeId: recipeId,
    })
    scheduleSync()
  }

  // Sharing/joining go straight to the server, same as list sharing
  // (stores/lists.ts addUserToList/removeUserFromList) - there's no local
  // representation of "the current share code" worth keeping offline.
  async function shareRecipe(recipeId: string): Promise<string> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Cannot share recipe while offline')
    }
    const { code } = await shareRecipeApi(recipeId)
    return code
  }

  async function joinRecipe(code: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Cannot join recipe while offline')
    }
    await joinRecipeApi(code)
    await sync()
  }

  // Remaps a client-generated temporary recipe id to the server-assigned id
  // once "createRecipe" syncs (see stores/lists.ts remapListId).
  async function remapRecipeId(oldId: string, newId: string) {
    if (oldId === newId) return

    const existing = await db.recipes.get(oldId)
    if (existing) {
      await db.recipes.delete(oldId)
      const updated = { ...existing, id: newId, pendingSync: false }
      await db.recipes.put(updated)
      removeLocalRecipe(oldId)
      upsertRecipe(updated)
    }

    const links = await db.recipeItems.where('recipeId').equals(oldId).toArray()
    for (const link of links) {
      await db.recipeItems.delete([oldId, link.listItemId])
      const updatedLink = { ...link, recipeId: newId }
      await db.recipeItems.put(updatedLink)
      removeLocalLink(oldId, link.listItemId)
      upsertLink(updatedLink)
    }

    const affectedQueueEntries = await db.syncQueue
      .filter((entry) => entry.localRecipeId === oldId)
      .toArray()
    for (const entry of affectedQueueEntries) {
      const payload = entry.payload
      const updatedPayload =
        'recipe_id' in payload
          ? { ...payload, recipe_id: newId }
          : 'id' in payload
            ? { ...payload, id: newId }
            : payload
      await db.syncQueue.update(entry.id!, {
        localRecipeId: newId,
        payload: updatedPayload,
      })
    }

    // "orderRecipes" entries aren't tied to a single localRecipeId (they carry
    // every recipe's id in payload.recipe_ids), so they need their own remap
    // pass.
    const affectedOrderEntries = await db.syncQueue.where('type').equals('orderRecipes').toArray()
    for (const orderEntry of affectedOrderEntries) {
      if (orderEntry.type !== 'orderRecipes' || !orderEntry.payload.recipe_ids.includes(oldId)) {
        continue
      }
      await db.syncQueue.update(orderEntry.id!, {
        payload: {
          recipe_ids: orderEntry.payload.recipe_ids.map((id) => (id === oldId ? newId : id)),
        },
      })
    }
  }

  // Called by stores/lists.ts remapListItemId once a list item's
  // client-generated id is swapped for its server-assigned one, so a recipe
  // link (and any queued recipe-item op) created against the temporary id
  // keeps pointing at the right item. The syncQueue side of this is already
  // handled generically by remapListItemId itself (it rewrites any entry -
  // regardless of type - whose localListItemId/payload.list_item_id
  // matches), so this only needs to fix up the local link table.
  async function remapListItemReferences(oldId: string, newId: string) {
    if (oldId === newId) return

    const links = await db.recipeItems.where('listItemId').equals(oldId).toArray()
    for (const link of links) {
      await db.recipeItems.delete([link.recipeId, oldId])
      const updatedLink = { ...link, listItemId: newId }
      await db.recipeItems.put(updatedLink)
      removeLocalLink(link.recipeId, oldId)
      upsertLink(updatedLink)
    }
  }

  async function processSyncEntry(entry: SyncQueueEntry) {
    switch (entry.type) {
      case 'createRecipe': {
        const created = await createRecipeApi(entry.payload)
        if (entry.localRecipeId) {
          await remapRecipeId(entry.localRecipeId, created.id)
        }
        break
      }
      case 'addRecipeItem': {
        await addListItemToRecipeApi(entry.payload)
        if (entry.localRecipeId && entry.localListItemId) {
          await db.recipeItems.update([entry.localRecipeId, entry.localListItemId], {
            pendingSync: false,
          })
          const link = recipeItemLinks.value.find(
            (l) => l.recipeId === entry.localRecipeId && l.listItemId === entry.localListItemId,
          )
          if (link) link.pendingSync = false
        }
        break
      }
      case 'removeRecipeItem': {
        await removeListItemFromRecipeApi(entry.payload)
        break
      }
      case 'deleteRecipe': {
        await deleteRecipeApi(entry.payload.id)
        break
      }
      case 'uncheckRecipe': {
        await uncheckRecipeApi(entry.payload.id)
        // The server is authoritative on which items ended up uncompleted,
        // so reconcile by re-pulling rather than trusting the optimistic
        // local flip.
        await pullRecipeItemsInternal(entry.payload.id)
        break
      }
      case 'orderRecipes': {
        await pushRecipeOrder(entry.payload.recipe_ids)
        await settleRecipeOrder(entry.payload.recipe_ids)
        break
      }
    }
  }

  // Sends a reorder. The server rejects an id list that doesn't match its
  // current set of recipes exactly, which is what a reorder queued offline
  // turns into once another device adds or deletes a recipe. A rejection is
  // therefore not final: rebase the user's order onto the recipes the server
  // actually has and send that once. Anything that still fails propagates.
  async function pushRecipeOrder(ids: string[]) {
    try {
      await orderRecipesApi({ recipe_ids: ids })
      return
    } catch (err) {
      if (!isServerRejection(err)) throw err
    }

    await orderRecipesApi({ recipe_ids: rebaseOrder(ids, await getRecipesApi()) })
  }

  // Clears the optimistic "pendingSync" flag reorderRecipes() put on every
  // recipe in the order, so the pull that follows a sync pass is allowed to
  // overwrite their positions again - with the values just accepted by the
  // server, or (when a reorder is abandoned) the server's own order.
  async function settleRecipeOrder(ids: string[]) {
    await Promise.all(ids.map((id) => db.recipes.update(id, { pendingSync: false })))
    const affectedIds = new Set(ids)
    for (const recipe of recipes.value) {
      if (affectedIds.has(recipe.id)) recipe.pendingSync = false
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
    if (entry.type === 'orderRecipes') await settleRecipeOrder(entry.payload.recipe_ids)
    error.value = `Couldn't save the new recipe order (${message}). Showing the server's order instead.`
  }

  async function runSync() {
    isSyncing.value = true
    error.value = null

    try {
      const snapshotQueue = (
        await db.syncQueue.where('type').anyOf(RECIPE_OP_TYPES).toArray()
      ).sort((a, b) => a.createdAt - b.createdAt)

      for (const snapshotEntry of snapshotQueue) {
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
          if (entry.type === 'orderRecipes') {
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
          break
        }
      }
    } finally {
      isSyncing.value = false
    }
  }

  // Serializes this store's own sync()/pull operations against each other,
  // same pattern as stores/lists.ts. Writes into db.listItems (from
  // pullRecipeItemsInternal) aren't serialized against the lists store's own
  // operationChain - an actual collision (both stores touching the very same
  // item id at the very same instant) is a low-probability edge case this
  // app doesn't try to close.
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

  async function sync(): Promise<void> {
    if (ongoingSync) {
      return ongoingSync
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!useAuthStore().isAuthenticated) return

    ongoingSync = enqueueOperation(() => runSync().then(() => pullRecipesFromServer()))
    try {
      await ongoingSync
    } finally {
      ongoingSync = null
    }
  }

  async function pullRecipesFromServer(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    try {
      const [serverRecipes, localRecipes] = await Promise.all([
        getRecipesApi(),
        db.recipes.toArray(),
      ])
      const localById = new Map(localRecipes.map((recipe) => [recipe.id, recipe]))
      const serverRecipeIds = new Set(serverRecipes.map((recipe) => recipe.id))

      const toPut: LocalRecipe[] = []
      for (const serverRecipe of serverRecipes) {
        const existingRecipe = localById.get(serverRecipe.id)
        if (!existingRecipe || !existingRecipe.pendingSync) {
          toPut.push({
            ...serverRecipe,
            pendingSync: false,
            clientId: existingRecipe?.clientId ?? serverRecipe.id,
          })
        }
      }
      if (toPut.length > 0) {
        await db.recipes.bulkPut(toPut)
      }

      const idsToDelete = localRecipes
        .filter((recipe) => !recipe.pendingSync && !serverRecipeIds.has(recipe.id))
        .map((recipe) => recipe.id)

      if (idsToDelete.length > 0) {
        await db.recipes.bulkDelete(idsToDelete)
        for (const id of idsToDelete) {
          await db.recipeItems.where('recipeId').equals(id).delete()
        }
      }

      for (const record of toPut) upsertRecipe(record)
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) removeLocalRecipe(id)
        const deletedIds = new Set(idsToDelete)
        recipeItemLinks.value = recipeItemLinks.value.filter(
          (link) => !deletedIds.has(link.recipeId),
        )
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load recipes from server'
    }
  }

  // Pulls the authoritative item membership (and the items' own data) of a
  // single recipe. Fetched items are also merged into stores/lists.ts's
  // listItems, the same way pullListItemsInternal there does, so a recipe
  // item stays a first-class list item you can edit/complete from either
  // screen.
  async function pullRecipeItemsInternal(recipeId: string): Promise<void> {
    const listsStore = useListsStore()

    try {
      const [serverItems, localLinks] = await Promise.all([
        getRecipeItemsApi(recipeId),
        db.recipeItems.where('recipeId').equals(recipeId).toArray(),
      ])
      const localLinkedIds = new Map(localLinks.map((link) => [link.listItemId, link]))
      const serverItemIds = new Set(serverItems.map((item) => item.id))

      const itemsToPut = serverItems.map((item) => ({ ...item, pendingSync: false }))
      if (itemsToPut.length > 0) {
        await db.listItems.bulkPut(itemsToPut)
        for (const item of itemsToPut) listsStore.upsertListItem(item)
      }

      const linksToPut: RecipeItemLink[] = serverItems
        .filter((item) => !localLinkedIds.get(item.id)?.pendingSync)
        .map((item) => ({ recipeId, listItemId: item.id, pendingSync: false }))
      if (linksToPut.length > 0) {
        await db.recipeItems.bulkPut(linksToPut)
        for (const link of linksToPut) upsertLink(link)
      }

      const linksToDelete = localLinks.filter(
        (link) => !link.pendingSync && !serverItemIds.has(link.listItemId),
      )
      if (linksToDelete.length > 0) {
        await db.recipeItems.bulkDelete(
          linksToDelete.map((link) => [link.recipeId, link.listItemId]),
        )
        for (const link of linksToDelete) removeLocalLink(link.recipeId, link.listItemId)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load recipe items from server'
    }
  }

  async function pullRecipeItems(recipeId: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    return enqueueOperation(() => pullRecipeItemsInternal(recipeId))
  }

  async function loadRecipeItems(recipeId: string) {
    await ensureLoaded()
    void pullRecipeItems(recipeId)
  }

  return {
    recipes,
    recipeItemLinks,
    sortedRecipes,
    isLoaded,
    isSyncing,
    pendingCount,
    error,
    itemsForRecipe,
    isItemInRecipe,
    ensureLoaded,
    loadRecipes,
    loadRecipeItems,
    refresh,
    createRecipe,
    deleteRecipe,
    reorderRecipes,
    addItemToRecipe,
    removeItemFromRecipe,
    removeItemFromAllRecipes,
    uncheckRecipe,
    shareRecipe,
    joinRecipe,
    remapListItemReferences,
    sync,
    pullRecipesFromServer,
    pullRecipeItems,
  }
})
