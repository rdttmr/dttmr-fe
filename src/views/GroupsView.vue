<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import type { Group } from '@/types/group'
import AppIcon from '@/components/AppIcon.vue'
import GroupCard from '@/components/GroupCard.vue'
import ShareGroupModal from '@/components/ShareGroupModal.vue'
import RenameModal from '@/components/RenameModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'

const groupsStore = useGroupsStore()
const listsStore = useListsStore()
const recipesStore = useRecipesStore()

const newGroupName = ref('')
const isCreating = ref(false)
const pageError = ref('')
const sharingGroup = ref<Group | null>(null)
const renamingGroup = ref<Group | null>(null)
const deletingGroup = ref<Group | null>(null)

onMounted(() => {
  groupsStore.loadGroups()
  // The cards count each group's lists and recipes, and deleting checks
  // they're empty, so both need to be loaded.
  listsStore.loadLists()
  recipesStore.loadRecipes()
})

async function run(action: () => Promise<unknown>, fallback: string) {
  pageError.value = ''
  try {
    await action()
  } catch (err) {
    pageError.value = err instanceof Error ? err.message : fallback
  }
}

async function handleCreateGroup() {
  const name = newGroupName.value.trim()
  if (!name) return
  isCreating.value = true
  await run(async () => {
    await groupsStore.createGroup(name)
    newGroupName.value = ''
  }, 'Failed to create group')
  isCreating.value = false
}

async function handleRename(name: string) {
  const group = renamingGroup.value
  renamingGroup.value = null
  if (group) await run(() => groupsStore.renameGroup(group.id, name), 'Failed to rename group')
}

function handleMakeDefault(group: Group) {
  void run(() => groupsStore.setDefaultGroup(group.id), 'Failed to set default group')
}

function handleOpenDelete(group: Group) {
  // Checked before asking, so nobody confirms a delete that can't happen.
  const blocker = groupsStore.deleteBlocker(group.id)
  if (blocker) {
    pageError.value = `Can't delete "${group.name}". ${blocker}`
    return
  }
  pageError.value = ''
  deletingGroup.value = group
}

async function handleConfirmDelete() {
  const group = deletingGroup.value
  deletingGroup.value = null
  if (group) await run(() => groupsStore.deleteGroup(group.id), 'Failed to delete group')
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <p class="eyebrow">Sharing</p>
      <h1>Groups</h1>
      <p class="page-sub">Everyone in a group sees its lists and recipes.</p>
    </header>

    <form class="composer" @submit.prevent="handleCreateGroup">
      <div class="field">
        <AppIcon name="users" class="composer-icon" />
        <input
          v-model="newGroupName"
          type="text"
          placeholder="Name a new group…"
          aria-label="New group name"
          :disabled="isCreating"
        />
      </div>
      <button
        type="submit"
        class="btn btn-primary add-btn"
        aria-label="Create group"
        :disabled="isCreating || !newGroupName.trim()"
      >
        <AppIcon name="plus" :size="22" :stroke="2.4" />
      </button>
    </form>

    <p v-if="pageError" class="banner banner-error">{{ pageError }}</p>

    <ul v-if="groupsStore.sortedGroups.length > 0" class="groups stagger">
      <li
        v-for="(group, index) in groupsStore.sortedGroups"
        :key="group.id"
        :style="{ '--i': Math.min(index, 8) }"
      >
        <GroupCard
          :group="group"
          @share="sharingGroup = group"
          @rename="renamingGroup = group"
          @make-default="handleMakeDefault(group)"
          @delete="handleOpenDelete(group)"
        />
      </li>
    </ul>

    <p v-else-if="groupsStore.error" class="banner banner-error">{{ groupsStore.error }}</p>
    <p v-else class="loading-text">Loading groups…</p>

    <p class="footnote">
      New lists and recipes go into the default group unless you pick a group first.
    </p>

    <ShareGroupModal v-if="sharingGroup" :group="sharingGroup" @close="sharingGroup = null" />
    <RenameModal
      v-if="renamingGroup"
      kind="group"
      :current-name="renamingGroup.name"
      @close="renamingGroup = null"
      @save="handleRename"
    />
    <ConfirmDeleteModal
      v-if="deletingGroup"
      :title="`Delete &quot;${deletingGroup.name}&quot;?`"
      description="The group is removed for all of its members. This can't be undone."
      @close="deletingGroup = null"
      @confirm="handleConfirmDelete"
    />
  </main>
</template>

<style scoped>
.groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.footnote {
  margin-top: 1.25rem;
  font-size: 0.8rem;
  color: var(--c-text-soft);
  text-align: center;
}
</style>
