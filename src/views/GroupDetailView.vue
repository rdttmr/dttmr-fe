<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'
import { useListsStore } from '@/stores/lists'
import { useRecipesStore } from '@/stores/recipes'
import { useAuthStore } from '@/stores/auth'
import type { GroupMember } from '@/types/group'
import AppIcon from '@/components/AppIcon.vue'
import ShareGroupModal from '@/components/ShareGroupModal.vue'
import RenameModal from '@/components/RenameModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import { useDismissableMenu } from '@/composables/useDismissableMenu'
import { hueFromString } from '@/utils/hue'

const props = defineProps<{ id: string }>()

const router = useRouter()
const groupsStore = useGroupsStore()
const listsStore = useListsStore()
const recipesStore = useRecipesStore()
const authStore = useAuthStore()

const showShareModal = ref(false)
const showRenameModal = ref(false)
const showDeleteModal = ref(false)
const showLeaveModal = ref(false)
const actionError = ref('')
const {
  isOpen: isMenuOpen,
  containerRef: menuContainerRef,
  toggle: toggleMenu,
} = useDismissableMenu()

// Members aren't cached locally: fetched each time the page opens, like the
// share code.
const members = ref<GroupMember[]>([])
const isLoadingMembers = ref(false)
const membersError = ref('')

onMounted(() => {
  groupsStore.loadGroups()
  // The hero counts the group's lists and recipes, and deleting checks
  // they're empty, so both need to be loaded.
  listsStore.loadLists()
  recipesStore.loadRecipes()
  void loadMembers()
})

watch(
  () => props.id,
  () => {
    members.value = []
    void loadMembers()
  },
)

const group = computed(() => groupsStore.groups.find((entry) => entry.id === props.id))
const listCount = computed(
  () => listsStore.lists.filter((list) => list.group_id === props.id).length,
)
const recipeCount = computed(
  () => recipesStore.recipes.filter((recipe) => recipe.group_id === props.id).length,
)
const myRole = computed(() => group.value?.role)
const hue = computed(() => hueFromString(group.value?.name ?? ''))

async function loadMembers() {
  membersError.value = ''
  isLoadingMembers.value = true
  try {
    members.value = await groupsStore.getMembers(props.id)
  } catch (err) {
    membersError.value = err instanceof Error ? err.message : 'Failed to load group members'
  } finally {
    isLoadingMembers.value = false
  }
}

function initial(member: GroupMember): string {
  return (member.name || member.email).trim().charAt(0).toUpperCase() || '?'
}

const joinedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function joinedLabel(member: GroupMember): string {
  if (!member.created_at) return ''
  const joined = new Date(member.created_at)
  return Number.isNaN(joined.getTime()) ? '' : `Joined ${joinedFormat.format(joined)}`
}

async function run(action: () => Promise<unknown>, fallback: string): Promise<boolean> {
  actionError.value = ''
  try {
    await action()
    return true
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : fallback
    return false
  }
}

function handleOpenRename() {
  isMenuOpen.value = false
  showRenameModal.value = true
}

async function handleRename(name: string) {
  showRenameModal.value = false
  await run(() => groupsStore.renameGroup(props.id, name), 'Failed to rename group')
}

function handleMakeDefault() {
  isMenuOpen.value = false
  void run(() => groupsStore.setDefaultGroup(props.id), 'Failed to set default group')
}

function handleOpenDelete() {
  isMenuOpen.value = false
  // Checked before asking, so nobody confirms a delete that can't happen.
  const blocker = groupsStore.deleteBlocker(props.id)
  if (blocker) {
    actionError.value = `Can't delete this group. ${blocker}`
    return
  }
  actionError.value = ''
  showDeleteModal.value = true
}

function handleOpenLeave() {
  isMenuOpen.value = false
  const blocker = groupsStore.leaveBlocker(props.id)
  if (blocker) {
    actionError.value = blocker
    return
  }
  actionError.value = ''
  showLeaveModal.value = true
}

async function handleConfirmLeave() {
  showLeaveModal.value = false
  if (await run(() => groupsStore.leaveGroup(props.id), 'Failed to leave group')) {
    router.push('/groups')
  }
}

async function handleConfirmDelete() {
  showDeleteModal.value = false
  if (await run(() => groupsStore.deleteGroup(props.id), 'Failed to delete group')) {
    router.push('/groups')
  }
}
</script>

<template>
  <main class="page">
    <button type="button" class="back-link" @click="router.push('/groups')">
      <AppIcon name="chevron-left" :size="18" :stroke="2.4" />
      Groups
    </button>

    <template v-if="group">
      <section class="hero card menu-lift" :style="{ '--hue': hue }">
        <div class="group-header">
          <span class="hero-tile" aria-hidden="true">
            <AppIcon name="users" :size="24" :stroke="2.1" />
          </span>
          <div class="hero-text">
            <h1>{{ group.name }}</h1>
            <p class="hero-meta">
              <span v-if="group.is_default" class="pill pill-accent">Default</span>
              {{ listCount }} {{ listCount === 1 ? 'list' : 'lists' }} · {{ recipeCount }}
              {{ recipeCount === 1 ? 'recipe' : 'recipes' }}
            </p>
          </div>

          <div ref="menuContainerRef" class="menu-container">
            <button
              type="button"
              class="menu-trigger-btn"
              aria-label="Group options"
              aria-haspopup="true"
              :aria-expanded="isMenuOpen"
              title="More options"
              @click="toggleMenu"
            >
              <AppIcon name="more" :size="18" />
            </button>

            <div v-if="isMenuOpen" class="submenu-dropdown card" role="menu">
              <button type="button" class="submenu-item" role="menuitem" @click="handleOpenRename">
                <AppIcon name="edit" :size="16" />
                <span>Rename group</span>
              </button>
              <button
                v-if="!group.is_default"
                type="button"
                class="submenu-item"
                role="menuitem"
                @click="handleMakeDefault"
              >
                <AppIcon name="check" :size="16" />
                <span>Make default</span>
              </button>
              <button
                v-if="myRole && myRole !== 'owner'"
                type="button"
                class="submenu-item submenu-item-danger"
                role="menuitem"
                @click="handleOpenLeave"
              >
                <AppIcon name="logout" :size="16" />
                <span>Leave group</span>
              </button>
              <button
                v-if="myRole === 'owner'"
                type="button"
                class="submenu-item submenu-item-danger"
                role="menuitem"
                @click="handleOpenDelete"
              >
                <AppIcon name="trash" :size="16" />
                <span>Delete group</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="actions-row">
        <button type="button" class="btn btn-primary" @click="showShareModal = true">
          <AppIcon name="share" :size="17" /> Invite someone
        </button>
      </div>

      <p v-if="actionError" class="banner banner-error">{{ actionError }}</p>

      <h2 class="section-label">
        Members <span v-if="members.length > 0" class="count">{{ members.length }}</span>
      </h2>

      <p v-if="isLoadingMembers && members.length === 0" class="loading-text">Loading members…</p>

      <section v-else-if="members.length > 0" class="card members-card">
        <ul class="member-list">
          <li
            v-for="member in members"
            :key="member.id"
            class="member-row"
            :style="{ '--hue': hueFromString(member.email) }"
          >
            <span class="avatar" aria-hidden="true">{{ initial(member) }}</span>
            <span class="member-main">
              <span class="member-name">
                {{ member.name || member.email }}
                <span v-if="member.role === 'owner'" class="pill pill-accent">Owner</span>
                <span v-if="member.email === authStore.email" class="pill">You</span>
              </span>
              <span class="member-email">{{ member.email }}</span>
              <span v-if="joinedLabel(member)" class="member-joined">{{
                joinedLabel(member)
              }}</span>
            </span>
          </li>
        </ul>
      </section>

      <div v-if="membersError" class="banner banner-error members-error">
        {{ membersError }}
        <button type="button" class="retry-btn" @click="loadMembers">Retry</button>
      </div>

      <ShareGroupModal v-if="showShareModal" :group="group" @close="showShareModal = false" />
      <RenameModal
        v-if="showRenameModal"
        kind="group"
        :current-name="group.name"
        @close="showRenameModal = false"
        @save="handleRename"
      />
      <ConfirmDeleteModal
        v-if="showLeaveModal"
        :title="`Leave &quot;${group.name}&quot;?`"
        description="Its lists and recipes disappear from your devices. You'll need a new invite to rejoin."
        confirm-label="Leave"
        icon="logout"
        @close="showLeaveModal = false"
        @confirm="handleConfirmLeave"
      />
      <ConfirmDeleteModal
        v-if="showDeleteModal"
        :title="`Delete &quot;${group.name}&quot;?`"
        description="The group is removed for all of its members. This can't be undone."
        @close="showDeleteModal = false"
        @confirm="handleConfirmDelete"
      />
    </template>

    <p v-else-if="!groupsStore.isLoaded" class="loading-text">Loading group…</p>
    <p v-else class="empty-hint">Group not found.</p>
  </main>
</template>

<style scoped>
.hero {
  padding: 1.2rem;
  margin-top: 0.4rem;
  overflow: visible;
  background-color: var(--c-bg-soft);
  background-image:
    radial-gradient(120% 140% at 0% 0%, hsl(var(--hue) 85% 60% / 0.22), transparent 60%),
    radial-gradient(
      90% 120% at 100% 100%,
      hsl(calc(var(--hue) + 28) 85% 60% / 0.14),
      transparent 65%
    );
}

.group-header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.hero-tile {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 17px;
  color: #fff;
  background-image: linear-gradient(
    135deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 54%)
  );
  box-shadow:
    0 6px 16px hsl(var(--hue) 80% 50% / 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero h1 {
  font-size: clamp(1.5rem, 5.5vw, 1.9rem);
  line-height: 1.12;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.hero-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: var(--c-text-soft);
}

.actions-row {
  display: flex;
  gap: 0.6rem;
  margin: 1.1rem 0 0.5rem;
}

.actions-row .btn {
  flex: 1;
  width: auto;
}

.members-card {
  padding: 0.5rem;
}

.member-list {
  display: flex;
  flex-direction: column;
  list-style: none;
  padding: 0;
  margin: 0;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.55rem 0.5rem;
}

.member-row + .member-row {
  border-top: 1px solid var(--c-border);
}

.avatar {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  color: #fff;
  font-weight: 700;
  background-image: linear-gradient(
    135deg,
    hsl(var(--hue) 82% 62%),
    hsl(calc(var(--hue) + 28) 85% 54%)
  );
}

.member-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  color: var(--c-heading);
}

.member-email {
  font-size: 0.78rem;
  color: var(--c-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-joined {
  font-size: 0.72rem;
  color: var(--c-text-soft);
}

.members-error {
  margin-top: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.retry-btn {
  background: none;
  border: 1px solid var(--c-danger-border);
  color: var(--c-danger);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  flex-shrink: 0;
}
</style>
