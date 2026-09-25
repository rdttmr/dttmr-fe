<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'
import AppIcon from '@/components/AppIcon.vue'
import BaseModal from '@/components/BaseModal.vue'

const props = defineProps<{
  kind: 'list' | 'recipe'
  name: string
  currentGroupId?: string
}>()

const emit = defineEmits<{
  close: []
  move: [groupId: string]
}>()

const groupsStore = useGroupsStore()
const selectedGroupId = ref<string | null>(null)

onMounted(() => {
  groupsStore.loadGroups()
})

const targets = computed(() =>
  groupsStore.sortedGroups.filter((group) => group.id !== props.currentGroupId),
)

// The server drops recipe links that would cross groups after a move, so say
// what will disappear before it does.
const warning = computed(() =>
  props.kind === 'list'
    ? 'Its items will be removed from recipes in other groups.'
    : 'Items from lists outside the new group will be removed from this recipe.',
)

function handleClose() {
  emit('close')
}

function handleMove() {
  if (selectedGroupId.value) emit('move', selectedGroupId.value)
}
</script>

<template>
  <BaseModal
    :title="`Move &quot;${name}&quot;`"
    title-id="move-to-group-modal-title"
    icon="users"
    @close="handleClose"
  >
    <template v-if="targets.length > 0">
      <p class="modal-description">
        Everyone in the group you pick will see this {{ kind }}.
        <template v-if="groupsStore.groupName(currentGroupId)">
          It's currently in <strong>{{ groupsStore.groupName(currentGroupId) }}</strong
          >.
        </template>
      </p>

      <ul class="group-options" role="radiogroup" aria-label="Target group">
        <li v-for="group in targets" :key="group.id">
          <label class="group-option" :class="{ 'is-selected': selectedGroupId === group.id }">
            <input v-model="selectedGroupId" type="radio" name="target-group" :value="group.id" />
            <span class="option-name">{{ group.name }}</span>
            <span class="option-meta">
              {{ group.member_count ?? 1 }}
              {{ (group.member_count ?? 1) === 1 ? 'member' : 'members' }}
            </span>
          </label>
        </li>
      </ul>

      <p class="disclaimer">
        <AppIcon name="alert" :size="16" />
        <span>{{ warning }}</span>
      </p>
    </template>

    <p v-else class="modal-description">
      You only have one group. Create another one on the
      <RouterLink to="/groups" @click="handleClose">Groups</RouterLink> page to share this
      {{ kind }} with other people.
    </p>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="handleClose">Cancel</button>
      <button
        v-if="targets.length > 0"
        type="button"
        class="btn btn-primary"
        :disabled="!selectedGroupId"
        @click="handleMove"
      >
        Move
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-description {
  font-size: 0.92rem;
  color: var(--c-text-soft);
  margin-bottom: 1rem;
}

.modal-description strong {
  color: var(--c-heading);
}

.group-options {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
}

.group-option {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background-color: var(--c-surface);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.group-option:hover {
  border-color: var(--c-border-hover);
}

.group-option.is-selected {
  border-color: var(--c-accent);
  background-color: var(--c-accent-bg);
}

.group-option input {
  accent-color: var(--c-accent);
}

.option-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  color: var(--c-heading);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-meta {
  font-size: 0.75rem;
  color: var(--c-text-soft);
}

.disclaimer {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.7rem 0.85rem;
  border-radius: var(--radius-md);
  background-color: var(--c-warning-bg);
  color: var(--c-warning);
  font-size: 0.78rem;
  line-height: 1.45;
}

.disclaimer .icon {
  margin-top: 0.1rem;
}
</style>
