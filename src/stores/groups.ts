import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import { db } from '@/database/db'
import type { Group, GroupMember } from '@/types/group'
import {
  getGroupsApi,
  createGroupApi,
  renameGroupApi,
  setDefaultGroupApi,
  getGroupMembersApi,
  shareGroupApi,
  joinGroupApi,
  leaveGroupApi,
  deleteGroupApi,
} from '@/api/groups'
import { createPullTracker } from '@/utils/pullFreshness'

// The group filter on the Lists and Recipes pages is a per-device view
// preference, so it lives in localStorage rather than in Dexie.
const ACTIVE_GROUP_KEY = 'dttmr.activeGroupId'

function readActiveGroupId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY)
  } catch {
    return null
  }
}

function writeActiveGroupId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_GROUP_KEY, id)
    else localStorage.removeItem(ACTIVE_GROUP_KEY)
  } catch {
    // Storage unavailable (private mode, blocked): the filter just isn't remembered.
  }
}

function assertOnline(action: string) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(`Cannot ${action} while offline`)
  }
}

// Unlike lists and recipes, groups are not offline-first: every mutation goes
// straight to the server (same as sharing did before), and Dexie only caches
// the last GET /groups so the filter and pickers work offline. That avoids
// temporary group ids, which lists/recipes created offline would otherwise
// have to be remapped against.
export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const isLoaded = ref(false)
  const error = ref<string | null>(null)

  // null means "All groups".
  const storedActiveGroupId = ref<string | null>(readActiveGroupId())
  watch(storedActiveGroupId, writeActiveGroupId)

  // A remembered group the user no longer belongs to (deleted, other account
  // on this device) falls back to "All" instead of showing an empty page.
  const activeGroupId = computed<string | null>({
    get: () =>
      storedActiveGroupId.value && groups.value.some((g) => g.id === storedActiveGroupId.value)
        ? storedActiveGroupId.value
        : null,
    set: (id) => {
      storedActiveGroupId.value = id
    },
  })

  // Default group first, then alphabetical.
  const sortedGroups = computed(() =>
    [...groups.value].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
      return a.name.localeCompare(b.name)
    }),
  )

  const defaultGroup = computed(() => groups.value.find((g) => g.is_default) ?? null)
  const hasMultipleGroups = computed(() => groups.value.length > 1)

  function groupName(id: string | undefined): string | undefined {
    if (!id) return undefined
    return groups.value.find((g) => g.id === id)?.name
  }

  function myRole(groupId: string): string | undefined {
    return groups.value.find((g) => g.id === groupId)?.role
  }

  function upsertGroup(record: Group) {
    const existing = groups.value.find((g) => g.id === record.id)
    if (existing) Object.assign(existing, record)
    else groups.value.push(record)
  }

  async function refresh() {
    groups.value = await db.groups.toArray()
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

  async function loadGroups() {
    await ensureLoaded()
    void sync()
  }

  let ongoingSync: Promise<void> | null = null
  const pulls = createPullTracker(() => useAuthStore().currentUser?.user_id)

  // Mirrors GET /groups into Dexie. Named sync() for symmetry with the other
  // stores, but there is no queue to drain, only a pull - skipped while the
  // last one is fresh, same as the lists and recipes stores. `force` is for
  // callers that just changed the user's groups on the server.
  async function sync(options: { force?: boolean } = {}): Promise<void> {
    if (ongoingSync) {
      if (!options.force) return ongoingSync
      await ongoingSync
      return sync(options)
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!useAuthStore().isAuthenticated) return
    if (!options.force && pulls.isFresh()) return

    ongoingSync = pullFromServer().finally(() => {
      ongoingSync = null
    })
    return ongoingSync
  }

  async function pullFromServer() {
    try {
      const serverGroups = await getGroupsApi()
      const serverIds = new Set(serverGroups.map((g) => g.id))
      const staleIds = (await db.groups.toArray())
        .map((g) => g.id)
        .filter((id) => !serverIds.has(id))

      if (serverGroups.length > 0) await db.groups.bulkPut(serverGroups)
      if (staleIds.length > 0) await db.groups.bulkDelete(staleIds)

      for (const group of serverGroups) upsertGroup(group)
      groups.value = groups.value.filter((g) => serverIds.has(g.id))
      isLoaded.value = true
      error.value = null
      pulls.markPulled()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load groups'
    }
  }

  async function createGroup(name: string): Promise<Group> {
    assertOnline('create a group')
    const response = await createGroupApi({ name })
    // POST /groups reports member_count 0, but the creator is already a member
    // (and its owner).
    const created = {
      ...response,
      member_count: Math.max(1, response.member_count ?? 0),
      role: response.role ?? 'owner',
    }
    await db.groups.put(created)
    upsertGroup(created)
    return created
  }

  async function renameGroup(groupId: string, name: string) {
    assertOnline('rename a group')
    await renameGroupApi(groupId, { name })
    await db.groups.update(groupId, { name })
    const existing = groups.value.find((g) => g.id === groupId)
    if (existing) existing.name = name
  }

  async function setDefaultGroup(groupId: string) {
    assertOnline('change the default group')
    await setDefaultGroupApi(groupId)
    for (const group of groups.value) {
      const isDefault = group.id === groupId
      if (group.is_default === isDefault) continue
      group.is_default = isDefault
      await db.groups.update(group.id, { is_default: isDefault })
    }
  }

  // Why a group can't be deleted right now, or null if it can. The server
  // only deletes empty groups; checking locally first gives a clear message
  // instead of a generic 4xx. Everything in a group I'm a member of is
  // visible to me, so the local cache is enough to tell.
  function deleteBlocker(groupId: string): string | null {
    // Only owners may delete. Not enforced by the backend yet, so the
    // frontend assumes it.
    if (myRole(groupId) !== 'owner') return 'Only the group owner can delete it.'
    if (groups.value.length <= 1) return "You can't delete your only group."
    const listCount = useListsStore().lists.filter((l) => l.group_id === groupId).length
    const recipeCount = useRecipesStore().recipes.filter((r) => r.group_id === groupId).length
    if (listCount + recipeCount === 0) return null
    const parts = [
      listCount > 0 ? `${listCount} ${listCount === 1 ? 'list' : 'lists'}` : '',
      recipeCount > 0 ? `${recipeCount} ${recipeCount === 1 ? 'recipe' : 'recipes'}` : '',
    ].filter(Boolean)
    return `Move or delete its ${parts.join(' and ')} first.`
  }

  async function deleteGroup(groupId: string) {
    const blocker = deleteBlocker(groupId)
    if (blocker) throw new Error(blocker)
    assertOnline('delete a group')

    await deleteGroupApi(groupId)
    await db.groups.delete(groupId)
    groups.value = groups.value.filter((g) => g.id !== groupId)
    // The server may have picked a new default if this one was it.
    if (!groups.value.some((g) => g.is_default)) void sync({ force: true })
  }

  // Why the user can't leave a group right now, or null if they can. Leaving
  // the only group would leave nowhere for new lists and recipes to go.
  // Owners can't leave (assumed ahead of the backend enforcing it).
  function leaveBlocker(groupId: string): string | null {
    if (myRole(groupId) === 'owner') {
      return "You own this group, so you can't leave it. Delete it instead."
    }
    if (groups.value.length <= 1 && groups.value[0]?.id === groupId) {
      return "You can't leave your only group."
    }
    return null
  }

  // Leaving hides the group's lists and recipes, so pull those too; their
  // pull drops whatever the server no longer reports.
  async function leaveGroup(groupId: string) {
    const blocker = leaveBlocker(groupId)
    if (blocker) throw new Error(blocker)
    assertOnline('leave a group')

    await leaveGroupApi(groupId)
    await db.groups.delete(groupId)
    groups.value = groups.value.filter((g) => g.id !== groupId)
    await sync({ force: true })
    await Promise.all([
      useListsStore().sync({ force: true }),
      useRecipesStore().sync({ force: true }),
    ])
  }

  async function getMembers(groupId: string): Promise<GroupMember[]> {
    assertOnline('load group members')
    return getGroupMembersApi(groupId)
  }

  async function shareGroup(groupId: string): Promise<string> {
    assertOnline('share a group')
    const { code } = await shareGroupApi(groupId)
    return code
  }

  // Joining makes the group's lists and recipes visible, so pull those too.
  // Returns the joined group when it can be identified.
  async function joinGroup(code: string): Promise<Group | null> {
    assertOnline('join a group')
    await ensureLoaded()
    const before = new Set(groups.value.map((g) => g.id))
    await joinGroupApi(code)
    await sync({ force: true })
    await Promise.all([
      useListsStore().sync({ force: true }),
      useRecipesStore().sync({ force: true }),
    ])
    return groups.value.find((g) => !before.has(g.id)) ?? null
  }

  return {
    groups,
    sortedGroups,
    defaultGroup,
    hasMultipleGroups,
    activeGroupId,
    isLoaded,
    error,
    groupName,
    ensureLoaded,
    loadGroups,
    refresh,
    sync,
    createGroup,
    renameGroup,
    setDefaultGroup,
    deleteBlocker,
    deleteGroup,
    leaveBlocker,
    leaveGroup,
    getMembers,
    shareGroup,
    joinGroup,
  }
})
