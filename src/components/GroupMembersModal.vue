<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Group, GroupMember } from '@/types/group'
import { useGroupsStore } from '@/stores/groups'
import { useAuthStore } from '@/stores/auth'
import { hueFromString } from '@/utils/hue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  group: Group
}>()

const emit = defineEmits<{
  close: []
}>()

const groupsStore = useGroupsStore()
const authStore = useAuthStore()

// Members aren't cached locally: fetched each time the sheet opens, like the
// share code.
const members = ref<GroupMember[]>([])
const isLoading = ref(false)
const error = ref('')

onMounted(() => {
  void loadMembers()
})

async function loadMembers() {
  error.value = ''
  isLoading.value = true
  try {
    members.value = await groupsStore.getMembers(props.group.id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load group members'
  } finally {
    isLoading.value = false
  }
}

function initial(member: GroupMember): string {
  return (member.name || member.email).trim().charAt(0).toUpperCase() || '?'
}
</script>

<template>
  <BaseModal
    :title="`Members of &quot;${group.name}&quot;`"
    title-id="group-members-modal-title"
    icon="users"
    @close="emit('close')"
  >
    <p v-if="isLoading" class="loading-text">Loading members…</p>

    <ul v-else-if="members.length > 0" class="member-list">
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
            <span v-if="member.email === authStore.email" class="pill">You</span>
          </span>
          <span class="member-email">{{ member.email }}</span>
        </span>
      </li>
    </ul>

    <div v-if="error" class="banner banner-error">
      {{ error }}
      <button type="button" class="retry-btn" @click="loadMembers">Retry</button>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Done</button>
    </template>
  </BaseModal>
</template>

<style scoped>
.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
  padding: 0;
  margin: 0;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
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

.banner-error {
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
