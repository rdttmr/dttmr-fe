<script setup lang="ts">
import type { LocalList } from '@/database/db'
import BaseModal from '@/components/BaseModal.vue'

defineProps<{
  list: LocalList
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function handleClose() {
  emit('close')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <BaseModal
    :title="`Delete &quot;${list.name}&quot;?`"
    title-id="delete-modal-title"
    @close="handleClose"
  >
    <p class="modal-description">
      Are you sure you want to delete this list? This action cannot be undone and all items in this
      list will be deleted.
    </p>

    <template #footer>
      <button type="button" class="btn btn-secondary cancel-btn" @click="handleClose">
        Cancel
      </button>
      <button type="button" class="btn btn-danger confirm-delete-btn" @click="handleConfirm">
        Delete list
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-description {
  font-size: 0.85rem;
  color: var(--c-text-soft);
  margin-bottom: 1.25rem;
  line-height: 1.4;
}
</style>
