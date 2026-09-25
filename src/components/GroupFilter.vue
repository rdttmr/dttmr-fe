<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useGroupsStore } from '@/stores/groups'
import AppIcon from '@/components/AppIcon.vue'

// Chip row that scopes the Lists and Recipes pages to one group. The choice
// is shared between both pages (it lives in the groups store). Hidden while
// the user only has one group, where it would filter nothing.
const groupsStore = useGroupsStore()
</script>

<template>
  <nav v-if="groupsStore.hasMultipleGroups" class="group-filter" aria-label="Filter by group">
    <button
      type="button"
      class="chip"
      :class="{ 'is-active': groupsStore.activeGroupId === null }"
      :aria-pressed="groupsStore.activeGroupId === null"
      @click="groupsStore.activeGroupId = null"
    >
      All
    </button>
    <button
      v-for="group in groupsStore.sortedGroups"
      :key="group.id"
      type="button"
      class="chip"
      :class="{ 'is-active': groupsStore.activeGroupId === group.id }"
      :aria-pressed="groupsStore.activeGroupId === group.id"
      @click="groupsStore.activeGroupId = group.id"
    >
      {{ group.name }}
    </button>
    <RouterLink to="/groups" class="chip chip-manage" aria-label="Manage groups">
      <AppIcon name="users" :size="15" />
    </RouterLink>
  </nav>
</template>

<style scoped>
.group-filter {
  display: flex;
  gap: 0.4rem;
  margin: 0.35rem 0 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.group-filter::-webkit-scrollbar {
  display: none;
}

.chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--c-border);
  background-color: var(--c-surface);
  color: var(--c-text);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.chip:hover {
  border-color: var(--c-border-hover);
  color: var(--c-heading);
}

.chip.is-active {
  background-color: var(--c-accent-bg);
  border-color: transparent;
  color: var(--c-accent-strong);
}

.chip-manage {
  padding: 0.4rem 0.6rem;
  color: var(--c-text-soft);
}
</style>
